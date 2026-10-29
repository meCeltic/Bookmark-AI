/**
 * Pure HTML metadata and text extraction. No DOM, no dependencies, runs in a
 * Node route handler on whatever `safeFetch` returned.
 *
 * Regex over a parser is a deliberate trade: we only need tag-level
 * information (meta/link attributes, which blocks to drop) and never nested
 * structure, so a tokenizer would add weight without changing results on
 * real pages. The known weak spot is a `<nav>` nested inside another `<nav>`,
 * where the inner closing tag ends the match early; that costs a few stray
 * words, never the article.
 */

export interface ExtractedPage {
  title: string
  description: string | null
  faviconUrl: string | null
  imageUrl: string | null
  text: string
  readingMinutes: number | null
  lang: string | null
}

export const TITLE_MAX = 300
export const DESCRIPTION_MAX = 1000
export const TEXT_MAX = 8000
/** Average adult reading speed used by most "x min read" estimates. */
const WORDS_PER_MINUTE = 220
const MIN_WORDS_FOR_READING_TIME = 30

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  bull: "•",
  middot: "·",
}

const ENTITY_PATTERN = /&(?:#x([0-9a-f]{1,6})|#(\d{1,7})|([a-z][a-z0-9]{1,31}));/gi

function decodeCodePoint(codePoint: number, raw: string): string {
  const isSurrogate = codePoint >= 0xd800 && codePoint <= 0xdfff
  if (codePoint === 0 || codePoint > 0x10ffff || isSurrogate) return raw
  return String.fromCodePoint(codePoint)
}

/** Decode the entities that show up in titles and body copy; unknown ones are left as-is. */
export function decodeEntities(input: string): string {
  return input.replace(ENTITY_PATTERN, (raw, hex: string | undefined, dec: string | undefined, named: string | undefined) => {
    if (hex !== undefined) return decodeCodePoint(Number.parseInt(hex, 16), raw)
    if (dec !== undefined) return decodeCodePoint(Number.parseInt(dec, 10), raw)
    if (named !== undefined) return NAMED_ENTITIES[named.toLowerCase()] ?? raw
    return raw
  })
}

function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim()
}

/** Entity-decode and whitespace-collapse an attribute value or title. */
function cleanInline(input: string): string {
  return collapseWhitespace(decodeEntities(input))
}

type Attributes = ReadonlyMap<string, string>

const ATTRIBUTE_PATTERN = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

function parseAttributes(tag: string): Attributes {
  const attributes = new Map<string, string>()
  // Skip the tag name itself ("<meta", "<link") before reading attributes.
  const body = tag.replace(/^<[a-z][a-z0-9-]*/i, "")
  for (const match of body.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1]?.toLowerCase()
    if (name === undefined || name === "/") continue
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "")
  }
  return attributes
}

function tagsNamed(html: string, tagName: string): Attributes[] {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, "gi")
  return [...html.matchAll(pattern)].map((match) => parseAttributes(match[0]))
}

/** First non-empty `content` among meta tags whose name or property matches, in key order. */
function metaContent(metas: ReadonlyArray<Attributes>, keys: ReadonlyArray<string>): string | null {
  for (const key of keys) {
    for (const meta of metas) {
      const identity = (meta.get("property") ?? meta.get("name") ?? "").toLowerCase()
      const content = meta.get("content")
      if (identity === key && content !== undefined && cleanInline(content).length > 0) {
        return cleanInline(content)
      }
    }
  }
  return null
}

function parseBase(baseUrl: string): URL | null {
  try {
    return new URL(baseUrl)
  } catch {
    return null
  }
}

/** Resolve a candidate against the page URL; only absolute http(s) results are usable. */
function resolveHttpUrl(candidate: string | null, base: URL | null): string | null {
  if (candidate === null || base === null) return null
  const trimmed = candidate.trim()
  if (trimmed.length === 0) return null
  try {
    const resolved = new URL(trimmed, base)
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.href : null
  } catch {
    return null
  }
}

function relValues(link: Attributes): string[] {
  return (link.get("rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean)
}

function extractFavicon(links: ReadonlyArray<Attributes>, base: URL | null): string | null {
  if (base === null) return null
  const iconLinks = links.filter((link) => relValues(link).includes("icon"))
  const touchLinks = links.filter((link) => relValues(link).includes("apple-touch-icon"))
  for (const link of [...iconLinks, ...touchLinks]) {
    const resolved = resolveHttpUrl(link.get("href") ?? null, base)
    if (resolved !== null) return resolved
  }
  return `${base.origin}/favicon.ico`
}

function extractTitleTag(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)
  const title = match?.[1] === undefined ? "" : cleanInline(match[1])
  return title.length > 0 ? title : null
}

function extractLang(html: string): string | null {
  const htmlTag = /<html\b[^>]*>/i.exec(html)?.[0]
  if (htmlTag === undefined) return null
  const lang = parseAttributes(htmlTag).get("lang")?.trim() ?? ""
  return lang.length > 0 && lang.length <= 35 ? lang : null
}

/* ---------- readable text ---------- */

/** Elements whose content is never prose. Removed everywhere, before anything else. */
const NOISE_TAGS = ["script", "style", "noscript", "svg", "template", "iframe", "object"]
/** Page chrome. Removed from the body before choosing the main content block. */
const CHROME_TAGS = ["nav", "header", "footer", "aside", "form"]
const BLOCK_TAGS =
  "p|div|br|hr|h[1-6]|li|ul|ol|dl|dt|dd|tr|td|th|table|thead|tbody|blockquote|pre|section|article|main|figure|figcaption|details|summary"

function removeElements(html: string, tagNames: ReadonlyArray<string>): string {
  return tagNames.reduce(
    (acc, tag) => acc.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), " "),
    html,
  )
}

function innerOf(html: string, tagName: string): string | null {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}\\s*>`, "i").exec(html)
  return match?.[1] ?? null
}

function selectMainContent(html: string): string {
  const withoutNoise = removeElements(html.replace(/<!--[\s\S]*?-->/g, " "), NOISE_TAGS)
  const body = removeElements(innerOf(withoutNoise, "body") ?? withoutNoise, CHROME_TAGS)
  return innerOf(body, "article") ?? innerOf(body, "main") ?? body
}

function htmlToText(fragment: string): string {
  const withBreaks = fragment.replace(new RegExp(`<\\/?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n")
  const stripped = withBreaks.replace(/<[^>]+>/g, "")
  return decodeEntities(stripped)
    .split("\n")
    .map(collapseWhitespace)
    .filter((line) => line.length > 0)
    .join("\n")
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length
}

/** Cut at a word boundary so the last token is not a torn word. */
function truncateText(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const boundary = cut.search(/\s\S*$/)
  return (boundary > max / 2 ? cut.slice(0, boundary) : cut).trimEnd()
}

/* ---------- public entry point ---------- */

export function extractPage(html: string, baseUrl: string): ExtractedPage {
  const base = parseBase(baseUrl)
  const metas = tagsNamed(html, "meta")
  const links = tagsNamed(html, "link")

  const title =
    metaContent(metas, ["og:title", "twitter:title"]) ?? extractTitleTag(html) ?? base?.hostname ?? ""
  const description = metaContent(metas, ["description", "og:description", "twitter:description"])
  const image = metaContent(metas, ["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"])

  const fullText = htmlToText(selectMainContent(html))
  const words = countWords(fullText)

  return {
    title: title.slice(0, TITLE_MAX),
    description: description === null ? null : description.slice(0, DESCRIPTION_MAX),
    faviconUrl: extractFavicon(links, base),
    imageUrl: resolveHttpUrl(image, base),
    text: truncateText(fullText, TEXT_MAX),
    readingMinutes: words < MIN_WORDS_FOR_READING_TIME ? null : Math.ceil(words / WORDS_PER_MINUTE),
    lang: extractLang(html),
  }
}
