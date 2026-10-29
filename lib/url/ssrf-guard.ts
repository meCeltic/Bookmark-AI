import dns from "node:dns/promises"
import net from "node:net"
import { fail, ok, type Result } from "@/lib/domain/result"

/**
 * Server-side request forgery guard for the enrichment fetch. Node only
 * (node:dns, node:net): import it from route handlers and server actions, never
 * from client components.
 *
 * The enrichment route fetches whatever URL a user saved, which makes it a
 * proxy into our own network unless every hop is checked: the literal host,
 * every address DNS resolves it to, and every redirect target.
 *
 * Known limit: DNS is resolved here and again inside fetch, so a rebinding
 * attack with a sub-second TTL could still slip through. Closing that gap
 * needs a custom dispatcher that pins the connection to the checked address.
 */

const MAX_REDIRECTS = 3
const DEFAULT_TIMEOUT_MS = 5_000
const DEFAULT_MAX_BYTES = 1024 * 1024
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
const DEFAULT_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"]
/** Hostnames that are only digits, dots and hex prefixes are IP literals in disguise. */
const NUMERIC_HOST_PATTERN = /^[0-9a-fx.]+$/i

type Octets = readonly [number, number, number, number]

function parseIPv4(ip: string): Octets | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN))
  const [a, b, c, d] = octets
  if ([a, b, c, d].some((n) => n === undefined || Number.isNaN(n) || n > 255)) return null
  return [a as number, b as number, c as number, d as number]
}

function isPrivateIPv4(octets: Octets): boolean {
  const [a, b, c] = octets
  return (
    a === 0 || // "this" network
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local and cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 192 && b === 0 && c === 2) || // TEST-NET-1
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast and reserved, up to 255.255.255.255
  )
}

/** Expand an IPv6 literal (with optional embedded IPv4 tail) into 16 bytes. */
function parseIPv6(ip: string): Uint8Array | null {
  const withoutZone = ip.split("%")[0] ?? ""
  if (net.isIPv6(withoutZone) === false) return null

  const halves = withoutZone.split("::")
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(":") : []
  const tail = halves[1] ? halves[1].split(":") : []

  const groups: number[] = []
  const pushGroup = (group: string, isLast: boolean): boolean => {
    if (isLast && group.includes(".")) {
      const v4 = parseIPv4(group)
      if (v4 === null) return false
      groups.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3])
      return true
    }
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return false
    groups.push(Number.parseInt(group, 16))
    return true
  }

  for (const [index, group] of head.entries()) {
    if (!pushGroup(group, halves.length === 1 && index === head.length - 1)) return null
  }
  const headGroups = groups.length
  for (const [index, group] of tail.entries()) {
    if (!pushGroup(group, index === tail.length - 1)) return null
  }
  const tailGroups = groups.length - headGroups

  if (halves.length === 2) {
    const missing = 8 - headGroups - tailGroups
    if (missing < 1) return null
    groups.splice(headGroups, 0, ...new Array<number>(missing).fill(0))
  }
  if (groups.length !== 8) return null

  const bytes = new Uint8Array(16)
  groups.forEach((group, i) => {
    bytes[i * 2] = group >> 8
    bytes[i * 2 + 1] = group & 0xff
  })
  return bytes
}

function bytesAreZero(bytes: Uint8Array, from: number, to: number): boolean {
  for (let i = from; i < to; i++) if (bytes[i] !== 0) return false
  return true
}

function tailAsIPv4(bytes: Uint8Array): Octets {
  return [bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0]
}

function isPrivateIPv6(bytes: Uint8Array): boolean {
  const b0 = bytes[0] ?? 0
  const b1 = bytes[1] ?? 0

  if (bytesAreZero(bytes, 0, 15)) return true // :: and ::1
  if (bytesAreZero(bytes, 0, 10) && b0 === 0 && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isPrivateIPv4(tailAsIPv4(bytes)) // ::ffff:a.b.c.d
  }
  if (bytesAreZero(bytes, 0, 12)) return isPrivateIPv4(tailAsIPv4(bytes)) // deprecated ::a.b.c.d
  if (b0 === 0 && b1 === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) {
    // 64:ff9b::/96 (NAT64) and 64:ff9b:1::/48 (local-use NAT64) carry an IPv4 in the tail.
    return isPrivateIPv4(tailAsIPv4(bytes))
  }
  if ((b0 & 0xfe) === 0xfc) return true // fc00::/7 unique local
  if (b0 === 0xfe && (b1 & 0xc0) === 0x80) return true // fe80::/10 link-local
  if (b0 === 0xff) return true // ff00::/8 multicast
  if (b0 === 0x20 && b1 === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return true // 2001:db8::/32 docs
  return false
}

/**
 * Normalise the odd IPv4 spellings browsers accept (hex, octal, decimal,
 * short forms) to dotted-quad by running them through the URL parser.
 */
function normaliseNumericHost(host: string): string | null {
  try {
    const parsed = new URL(`http://${host}/`)
    return net.isIPv4(parsed.hostname) ? parsed.hostname : null
  } catch {
    return null
  }
}

/**
 * True when connecting to this address could reach something that is not the
 * public internet. Conservative: anything that is not a recognisable public
 * IPv4 or IPv6 literal is treated as private.
 */
export function isPrivateAddress(ip: string): boolean {
  const literal = ip.trim().replace(/^\[|\]$/g, "")
  if (net.isIPv4(literal)) {
    const octets = parseIPv4(literal)
    return octets === null ? true : isPrivateIPv4(octets)
  }
  if (net.isIPv6(literal.split("%")[0] ?? "")) {
    const bytes = parseIPv6(literal)
    return bytes === null ? true : isPrivateIPv6(bytes)
  }
  const dotted = normaliseNumericHost(literal)
  return dotted === null ? true : isPrivateAddress(dotted)
}

function isBlockedHostname(hostname: string): boolean {
  if (hostname.length === 0 || hostname === "localhost") return true
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return true
  // The URL parser already rewrites hex/octal/decimal hosts to dotted quads, so
  // anything numeric that is still not an IP literal is malformed; reject it.
  return NUMERIC_HOST_PATTERN.test(hostname) && !net.isIP(hostname)
}

/**
 * Check that a URL is http(s) and that its host, and every address it resolves
 * to, is on the public internet. Returns the parsed URL on success.
 */
export async function assertPublicUrl(url: string): Promise<Result<URL>> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return fail("VALIDATION", "not a valid URL")
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return fail("BLOCKED_URL", "only http and https URLs can be fetched")
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "")
  if (isBlockedHostname(hostname)) {
    return fail("BLOCKED_URL", "host is not reachable from the public internet")
  }
  if (net.isIP(hostname)) {
    return isPrivateAddress(hostname)
      ? fail("BLOCKED_URL", "host is a private address")
      : ok(parsed)
  }

  let addresses: ReadonlyArray<{ address: string }>
  try {
    addresses = await dns.lookup(hostname, { all: true })
  } catch {
    return fail("UPSTREAM", "could not resolve host")
  }
  if (addresses.length === 0) return fail("UPSTREAM", "host did not resolve to any address")
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    return fail("BLOCKED_URL", "host resolves to a private address")
  }
  return ok(parsed)
}

export interface SafeFetchInit {
  method?: "GET" | "HEAD"
  timeoutMs?: number
  maxBytes?: number
  accept?: string
}

export interface SafeFetchResponse {
  finalUrl: string
  status: number
  contentType: string
  body: string
  redirected: boolean
}

function decoderFor(contentType: string): TextDecoder {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1]
  if (charset) {
    try {
      return new TextDecoder(charset)
    } catch {
      // Unknown label: fall through to UTF-8 rather than fail the whole fetch.
    }
  }
  return new TextDecoder("utf-8")
}

/** Read a body stream up to `maxBytes`, truncating instead of failing. */
async function readBodyCapped(response: Response, maxBytes: number): Promise<string> {
  if (response.body === null) return ""
  const decoder = decoderFor(response.headers.get("content-type") ?? "")
  const reader = response.body.getReader()
  let text = ""
  let received = 0
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      const room = maxBytes - received
      const chunk = value.byteLength > room ? value.subarray(0, room) : value
      received += chunk.byteLength
      text += decoder.decode(chunk, { stream: true })
    }
  } finally {
    // Stop the download once we have what we need; the stream may be unbounded.
    await reader.cancel().catch(() => undefined)
  }
  return text + decoder.decode()
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function upstreamMessage(error: unknown): string {
  if (isAbortError(error)) return "timed out"
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : null
  return cause ?? (error instanceof Error ? error.message : "fetch failed")
}

/**
 * Fetch a public URL with the guard applied to every hop: at most 3 redirects,
 * each target re-validated, a hard timeout for the whole exchange and a byte
 * cap on the body. Non-2xx responses are returned, not failed; the caller
 * decides what a 404 means.
 */
export async function safeFetch(url: string, init: SafeFetchInit = {}): Promise<Result<SafeFetchResponse>> {
  const method = init.method ?? "GET"
  const maxBytes = init.maxBytes ?? DEFAULT_MAX_BYTES
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: init.accept ?? DEFAULT_ACCEPT,
    "Accept-Language": "en-US,en;q=0.9",
  }

  try {
    let current = url
    for (let hop = 0; ; hop++) {
      const guard = await assertPublicUrl(current)
      if (!guard.ok) return guard

      const response = await fetch(guard.data, {
        method,
        headers,
        redirect: "manual",
        signal: controller.signal,
      })

      const location = response.headers.get("location")
      if (REDIRECT_STATUSES.has(response.status) && location !== null) {
        await response.body?.cancel().catch(() => undefined)
        if (hop >= MAX_REDIRECTS) return fail("UPSTREAM", "too many redirects")
        try {
          current = new URL(location, guard.data).href
        } catch {
          return fail("UPSTREAM", "redirect to an invalid location")
        }
        continue
      }

      const body = method === "HEAD" ? "" : await readBodyCapped(response, maxBytes)
      return ok({
        finalUrl: guard.data.href,
        status: response.status,
        contentType: response.headers.get("content-type") ?? "",
        body,
        redirected: hop > 0,
      })
    }
  } catch (error) {
    return fail("UPSTREAM", upstreamMessage(error))
  } finally {
    clearTimeout(timer)
  }
}
