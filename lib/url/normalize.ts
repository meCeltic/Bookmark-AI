/**
 * URL normalisation for user input and deduplication.
 *
 * Two different jobs, two different functions:
 *  - `normalizeUrl` turns what a human pastes into a valid absolute http(s) URL
 *    that we can store and open. It is forgiving (adds the scheme, trims) but
 *    never guesses beyond that.
 *  - `canonicalKey` collapses URLs that point at the same page into one string
 *    so the database can enforce `unique (user_id, url_normalized)`.
 */

const HTTP_SCHEMES = new Set(["http:", "https:"])

/** Query parameters that only carry analytics state, never page identity. */
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref_src",
  "yclid",
  "_hsenc",
  "_hsmiq",
  "mkt_tok",
])

const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):(.*)$/i
const PORT_ONLY_PATTERN = /^\d{1,5}(?:[/?#]|$)/

/** Add a scheme where a human left one out, reject schemes we cannot open. */
function withScheme(input: string): string | null {
  if (input.startsWith("//")) return `https:${input}`

  const match = SCHEME_PATTERN.exec(input)
  if (!match) return `https://${input}`

  const scheme = `${match[1]?.toLowerCase() ?? ""}:`
  const rest = match[2] ?? ""
  if (HTTP_SCHEMES.has(scheme)) return input
  // "localhost:3000/x" or "example.com:8080" look like a scheme to the URL
  // parser but are host:port to a person. Anything else ("mailto:", "ftp://")
  // is a real scheme we do not accept.
  if (PORT_ONLY_PATTERN.test(rest)) return `https://${input}`
  return null
}

/** A host a person meant as a web address: dotted name, localhost or an IP literal. */
function isPlausibleHost(hostname: string): boolean {
  if (hostname === "localhost") return true
  if (hostname.startsWith("[")) return true // IPv6 literal
  return hostname.includes(".") && !hostname.startsWith(".") && !hostname.endsWith(".")
}

function parseHttpUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null

  const candidate = withScheme(trimmed)
  if (candidate === null) return null

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if (!HTTP_SCHEMES.has(url.protocol)) return null
  if (!isPlausibleHost(url.hostname)) return null
  return url
}

/**
 * Turn user input into an absolute http(s) URL string, or null when it cannot
 * be one. Keeps "www.", case of the path and all query parameters: this is the
 * URL we will actually open, not the dedupe key.
 */
export function normalizeUrl(raw: string): string | null {
  return parseHttpUrl(raw)?.href ?? null
}

function stripWww(hostname: string): string {
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname
}

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.startsWith("utm_") || TRACKING_PARAMS.has(lower)
}

function canonicalQuery(params: URLSearchParams): string {
  const kept = [...params.entries()].filter(([name]) => !isTrackingParam(name))
  kept.sort(([aName, aValue], [bName, bValue]) =>
    aName === bName ? aValue.localeCompare(bValue) : aName.localeCompare(bName),
  )
  return new URLSearchParams(kept).toString()
}

/**
 * The dedupe key for a URL. Two URLs that differ only in scheme (http is
 * folded into https: almost every site redirects one to the other and a person
 * saving both means one page), host case, "www.", default port, fragment,
 * tracking parameters, query order or trailing slash share a key. Path case is
 * preserved because paths are case-sensitive on most servers.
 * Idempotent: canonicalKey(canonicalKey(x)) === canonicalKey(x).
 *
 * Input that is not a URL is returned trimmed so the caller still gets a
 * stable string; validate with `normalizeUrl` first if that matters.
 */
export function canonicalKey(url: string): string {
  const parsed = parseHttpUrl(url)
  if (parsed === null) return url.trim()

  // URL already lower-cases the host, punycodes IDN labels and drops default ports.
  const host = stripWww(parsed.hostname)
  const port = parsed.port.length > 0 ? `:${parsed.port}` : ""
  const path = parsed.pathname.replace(/\/+$/, "")
  const query = canonicalQuery(parsed.searchParams)

  return `https://${host}${port}${path}${query.length > 0 ? `?${query}` : ""}`
}

/** Host for display: no "www.", no port. Empty string when the input is not a URL. */
export function domainOf(url: string): string {
  const parsed = parseHttpUrl(url)
  return parsed === null ? "" : stripWww(parsed.hostname)
}

/**
 * The registrable part of a host, by a cheap rule rather than the public-suffix list:
 * the last two labels, or three when the second-level one is short beside a country code
 * (cheatsheetseries.owasp.org → owasp.org, news.bbc.co.uk → bbc.co.uk).
 */
export function registrableDomain(host: string): string {
  const labels = host.replace(/^www\./, "").split(".").filter(Boolean)
  if (labels.length <= 2 || /^\d+$/.test(labels.at(-1)!)) return labels.join(".")
  const keep = labels.at(-2)!.length <= 3 && labels.at(-1)!.length === 2 ? 3 : 2
  return labels.slice(-keep).join(".")
}

/** The registrable domain without its public suffix: smashingmagazine.com → smashingmagazine. */
export function bareName(host: string): string {
  const reg = registrableDomain(host)
  const labels = reg.split(".")
  return labels.length > 1 ? labels[0]! : reg
}
