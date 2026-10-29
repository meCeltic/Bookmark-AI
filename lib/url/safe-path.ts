/**
 * A redirect target we are willing to follow after sign-in: a same-origin
 * absolute path. "/\evil.com" and "//evil.com" both resolve off-site, so the
 * check parses rather than pattern-matches.
 */
export function safeNextPath(candidate: string | null | undefined, fallback = "/dashboard"): string {
  if (!candidate) return fallback
  try {
    const base = "https://bookmark-ai.invalid"
    const url = new URL(candidate, base)
    if (url.origin !== base) return fallback
    if (!candidate.startsWith("/") || /^\/[\\/]/.test(candidate)) return fallback
    return url.pathname + url.search
  } catch {
    return fallback
  }
}
