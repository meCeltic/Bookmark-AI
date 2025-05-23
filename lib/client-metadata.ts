/**
 * Client-side fallback for extracting metadata from a URL
 * This is used when the server-side API fails
 */
export async function extractMetadataClient(url: string): Promise<{
  title: string
  favicon: string | null
  summary: string
}> {
  try {
    const parsedUrl = new URL(url)

    // Default values
    const defaultMetadata = {
      title: parsedUrl.hostname,
      favicon: `${parsedUrl.origin}/favicon.ico`,
      summary: `Bookmark from ${parsedUrl.hostname}. No summary available.`,
    }

    // For security reasons, browsers don't allow direct fetch of HTML content from other domains
    // So we can only use the default values or try to guess some metadata

    // Try to get a better favicon
    try {
      // Test if the favicon exists
      const faviconResponse = await fetch(defaultMetadata.favicon, {
        method: "HEAD",
        mode: "no-cors",
      })

      // If we can't access the favicon, set it to null
      if (!faviconResponse.ok) {
        defaultMetadata.favicon = null
      }
    } catch (error) {
      defaultMetadata.favicon = null
    }

    return defaultMetadata
  } catch (error) {
    // If anything goes wrong, return basic metadata
    return {
      title: new URL(url).hostname,
      favicon: null,
      summary: `Bookmark from ${new URL(url).hostname}. No summary available.`,
    }
  }
}
