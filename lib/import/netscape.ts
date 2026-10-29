import { exportFileSchema } from "@/lib/export"
import { decodeEntities } from "@/lib/enrich/extract"

export interface ImportedBookmark {
  url: string
  title: string
  /** Folder names from the root down, with the browser's container folder dropped. */
  folder: string[]
  addedAt: string | null
  tags: string[]
}

export type ImportKind = "netscape" | "bookmark-ai-json" | "unknown"

export interface ParsedImport {
  kind: ImportKind
  items: ImportedBookmark[]
}

// ---------------------------------------------------------------------------
// Entities

// One entity decoder for the whole app; the extractor's handles the numeric edge cases.
export { decodeEntities }

// ---------------------------------------------------------------------------
// Tokenizer

type Token =
  | { type: "open"; name: string; attrs: Record<string, string> }
  | { type: "close"; name: string }
  | { type: "text"; value: string }

const isSpace = (ch: string): boolean => /\s/.test(ch)

const readTagName = (html: string, at: number): [string, number] => {
  let i = at
  while (i < html.length && !isSpace(html[i] ?? "") && html[i] !== ">" && html[i] !== "/") i += 1
  return [html.slice(at, i).toUpperCase(), i]
}

const readAttrValue = (html: string, at: number): [string, number] => {
  const quote = html[at]
  if (quote === '"' || quote === "'") {
    const end = html.indexOf(quote, at + 1)
    return end === -1 ? [html.slice(at + 1), html.length] : [html.slice(at + 1, end), end + 1]
  }
  let i = at
  while (i < html.length && !isSpace(html[i] ?? "") && html[i] !== ">") i += 1
  return [html.slice(at, i), i]
}

/** Reads attributes up to and including the closing `>`; tolerant of missing values. */
const readAttrs = (html: string, at: number): [Record<string, string>, number] => {
  const attrs: Record<string, string> = {}
  let i = at
  while (i < html.length) {
    const ch = html[i] ?? ""
    if (ch === ">") return [attrs, i + 1]
    if (isSpace(ch) || ch === "/") {
      i += 1
      continue
    }
    let j = i
    while (j < html.length && !isSpace(html[j] ?? "") && html[j] !== "=" && html[j] !== ">") j += 1
    const name = html.slice(i, j).toUpperCase()
    i = j
    while (i < html.length && isSpace(html[i] ?? "")) i += 1
    if (html[i] === "=") {
      i += 1
      while (i < html.length && isSpace(html[i] ?? "")) i += 1
      const [value, after] = readAttrValue(html, i)
      attrs[name] = decodeEntities(value)
      i = after
    } else if (name !== "") {
      attrs[name] = ""
    }
  }
  return [attrs, i]
}

const skipDeclaration = (html: string, at: number): number => {
  if (html.startsWith("<!--", at)) {
    const end = html.indexOf("-->", at + 4)
    return end === -1 ? html.length : end + 3
  }
  const end = html.indexOf(">", at)
  return end === -1 ? html.length : end + 1
}

export const tokenize = (html: string): Token[] => {
  const tokens: Token[] = []
  let i = 0
  while (i < html.length) {
    const lt = html.indexOf("<", i)
    if (lt === -1) {
      tokens.push({ type: "text", value: html.slice(i) })
      break
    }
    if (lt > i) tokens.push({ type: "text", value: html.slice(i, lt) })

    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      i = skipDeclaration(html, lt)
    } else if (html[lt + 1] === "/") {
      const [name, after] = readTagName(html, lt + 2)
      const end = html.indexOf(">", after)
      tokens.push({ type: "close", name })
      i = end === -1 ? html.length : end + 1
    } else {
      const [name, afterName] = readTagName(html, lt + 1)
      if (name === "") {
        // A bare "<" in text; keep it literal.
        tokens.push({ type: "text", value: "<" })
        i = lt + 1
        continue
      }
      const [attrs, after] = readAttrs(html, afterName)
      tokens.push({ type: "open", name, attrs })
      i = after
    }
  }
  return tokens
}

// ---------------------------------------------------------------------------
// Structure

const CONTAINER_NAMES = new Set([
  "bookmarks bar",
  "bookmarks toolbar",
  "bookmarks menu",
  "other bookmarks",
  "mobile bookmarks",
  "favorites bar",
])

const isContainerFolder = (name: string, attrs: Record<string, string>): boolean =>
  CONTAINER_NAMES.has(name.toLowerCase()) ||
  "PERSONAL_TOOLBAR_FOLDER" in attrs ||
  "UNFILED_BOOKMARKS_FOLDER" in attrs

const cleanText = (raw: string): string => decodeEntities(raw).replace(/\s+/g, " ").trim()

const toIsoFromEpoch = (raw: string | undefined): string | null => {
  if (raw === undefined) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  // Browsers write seconds; anything past year 5138 in seconds is really milliseconds.
  const ms = n > 1e11 ? n : n * 1000
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const parseTags = (raw: string | undefined): string[] => {
  if (raw === undefined) return []
  const seen = new Set<string>()
  for (const part of raw.split(",")) {
    const tag = part.trim().toLowerCase()
    if (tag !== "") seen.add(tag)
  }
  return [...seen]
}

const isWebUrl = (href: string): boolean => {
  try {
    const { protocol } = new URL(href)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

interface Frame {
  /** Folder name contributed by this <DL>, or null for the root / container level. */
  name: string | null
}

interface PendingAnchor {
  attrs: Record<string, string>
  text: string
}

/**
 * Walks the token stream with a folder stack. Browsers leave <DT> and <p>
 * unclosed, so only <H3>, <A> and <DL> carry structure here.
 */
export const parseNetscapeHtml = (html: string): ImportedBookmark[] => {
  const items: ImportedBookmark[] = []
  const stack: Frame[] = []
  let pendingFolder: { name: string; attrs: Record<string, string> } | null = null
  let heading: { attrs: Record<string, string>; text: string } | null = null
  let anchor: PendingAnchor | null = null

  const currentPath = (): string[] =>
    stack.flatMap((frame) => (frame.name === null ? [] : [frame.name]))

  const emit = (a: PendingAnchor): void => {
    const href = (a.attrs.HREF ?? "").trim()
    if (href === "" || !isWebUrl(href)) return
    const title = cleanText(a.text)
    items.push({
      url: href,
      title: title === "" ? href : title,
      folder: currentPath(),
      addedAt: toIsoFromEpoch(a.attrs.ADD_DATE),
      tags: parseTags(a.attrs.TAGS),
    })
  }

  for (const token of tokenize(html)) {
    if (token.type === "text") {
      if (anchor) anchor.text += token.value
      else if (heading) heading.text += token.value
      continue
    }

    if (token.type === "open") {
      switch (token.name) {
        case "A":
          if (anchor) emit(anchor)
          anchor = { attrs: token.attrs, text: "" }
          break
        case "H3":
          heading = { attrs: token.attrs, text: "" }
          break
        case "DL": {
          // Safari writes its top-level <H3>s outside any root <DL>, so "top level"
          // means "no named folder above us" rather than a fixed stack depth.
          const isTopLevel = stack.every((frame) => frame.name === null)
          const dropped =
            pendingFolder !== null && isTopLevel && isContainerFolder(pendingFolder.name, pendingFolder.attrs)
          stack.push({ name: pendingFolder === null || dropped ? null : pendingFolder.name })
          pendingFolder = null
          break
        }
        default:
          break
      }
      continue
    }

    switch (token.name) {
      case "A":
        if (anchor) emit(anchor)
        anchor = null
        break
      case "H3":
        if (heading) {
          const name = cleanText(heading.text)
          pendingFolder = name === "" ? null : { name, attrs: heading.attrs }
        }
        heading = null
        break
      case "DL":
        if (anchor) {
          emit(anchor)
          anchor = null
        }
        stack.pop()
        break
      default:
        break
    }
  }
  if (anchor) emit(anchor)
  return items
}

// ---------------------------------------------------------------------------
// File detection

const looksLikeNetscape = (text: string): boolean =>
  /<!DOCTYPE\s+NETSCAPE-Bookmark-file-1/i.test(text) ||
  /<DL\b/i.test(text) ||
  /<DT>\s*<A\s+HREF/i.test(text)

const fromExportJson = (text: string): ImportedBookmark[] | null => {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = exportFileSchema.safeParse(raw)
  if (!parsed.success) return null
  const names = new Map(parsed.data.collections.map((c) => [c.id, c.name]))
  return parsed.data.bookmarks.map((b) => {
    const name = b.collectionId === null ? undefined : names.get(b.collectionId)
    return {
      url: b.url,
      title: b.title,
      folder: name === undefined ? [] : [name],
      addedAt: b.createdAt,
      tags: b.tags,
    }
  })
}

export const parseImportFile = (text: string): ParsedImport => {
  const trimmed = text.trim()
  if (trimmed.startsWith("{")) {
    const items = fromExportJson(trimmed)
    return items === null ? { kind: "unknown", items: [] } : { kind: "bookmark-ai-json", items }
  }
  if (looksLikeNetscape(trimmed)) return { kind: "netscape", items: parseNetscapeHtml(trimmed) }
  return { kind: "unknown", items: [] }
}

// ---------------------------------------------------------------------------
// Dedupe

export const dedupeImports = (
  items: ImportedBookmark[],
  existingKeys: Set<string>,
  keyOf: (url: string) => string,
): { fresh: ImportedBookmark[]; skipped: number } => {
  const seen = new Set<string>()
  const fresh: ImportedBookmark[] = []
  for (const item of items) {
    const key = keyOf(item.url)
    if (existingKeys.has(key) || seen.has(key)) continue
    seen.add(key)
    fresh.push(item)
  }
  return { fresh, skipped: items.length - fresh.length }
}
