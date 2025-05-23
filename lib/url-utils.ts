/**
 * Normalizes a URL by ensuring it has a protocol
 * @param url The URL to normalize
 * @returns A normalized URL with protocol
 */
export function normalizeUrl(url: string): string {
  // Trim the URL to remove any leading/trailing whitespace
  const trimmedUrl = url.trim()

  // If URL doesn't start with http:// or https://, add https://
  if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
    return "https://" + trimmedUrl
  }
  return trimmedUrl
}

/**
 * Validates a URL and returns a normalized version
 * @param url The URL to validate
 * @returns A normalized URL or throws an error if invalid
 */
export function validateAndNormalizeUrl(url: string): URL {
  if (!url || url.trim() === "") {
    throw new Error("URL cannot be empty")
  }

  const normalizedUrl = normalizeUrl(url)
  try {
    return new URL(normalizedUrl)
  } catch (e) {
    throw new Error("Invalid URL. Please enter a valid website address.")
  }
}

/**
 * Safely creates a URL object with error handling
 * @param url The URL string to parse
 * @returns A URL object or null if invalid
 */
export function safeCreateUrl(url: string): URL | null {
  try {
    return new URL(normalizeUrl(url))
  } catch (e) {
    return null
  }
}

/**
 * Extracts the domain name from a URL
 * @param url The URL to extract from
 * @returns The domain name
 */
export function getDomainFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(normalizeUrl(url))
    return parsedUrl.hostname
  } catch (e) {
    // If parsing fails, return the original URL
    return url
  }
}

/**
 * Safely joins a base URL with a relative path
 * @param baseUrl The base URL
 * @param relativePath The relative path
 * @returns The joined URL or null if invalid
 */
export function joinUrl(baseUrl: string, relativePath: string): string | null {
  if (!relativePath) return null

  try {
    // Handle absolute URLs
    if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
      // It's already an absolute URL
      return relativePath
    }

    // Normalize and validate the base URL
    const base = normalizeUrl(baseUrl)
    const baseUrlObj = new URL(base)

    // Handle protocol-relative URLs (//example.com/path)
    if (relativePath.startsWith("//")) {
      return `${baseUrlObj.protocol}${relativePath}`
    }

    // Use the URL constructor to properly resolve the path
    // This handles all the edge cases like "..", ".", etc.
    return new URL(relativePath, baseUrlObj).href
  } catch (error) {
    console.error("Error joining URLs:", baseUrl, relativePath, error)
    return null
  }
}

/**
 * Safely resolves a favicon URL
 * @param baseUrl The base URL of the page
 * @param faviconPath The favicon path from HTML
 * @returns A fully qualified favicon URL or null
 */
export function resolveFaviconUrl(baseUrl: string, faviconPath: string): string | null {
  // If the favicon path is empty, try the default location
  if (!faviconPath) {
    try {
      const parsedBase = new URL(normalizeUrl(baseUrl))
      return parsedBase.origin + "/favicon.ico"
    } catch (e) {
      return null
    }
  }

  // Clean the favicon path
  const cleanPath = faviconPath.trim()

  // If it's already an absolute URL, return it
  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    return cleanPath
  }

  // Otherwise join it with the base URL
  return joinUrl(baseUrl, cleanPath)
}
