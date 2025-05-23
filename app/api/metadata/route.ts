import { NextResponse } from "next/server"
import { normalizeUrl } from "@/lib/url-utils"
import { generateSimpleSummary } from "@/lib/summary-generator"

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Normalize the URL by ensuring it has a protocol
    const normalizedUrl = normalizeUrl(url)

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(normalizedUrl)
    } catch (e) {
      console.error("Invalid URL:", normalizedUrl, e)
      return NextResponse.json({
        title: url,
        favicon: null,
        summary: `Could not process this URL. Please check the format.`,
      })
    }

    // Default metadata values
    const defaultMetadata = {
      title: parsedUrl.hostname || url,
      favicon: null,
      summary: `Bookmark from ${parsedUrl.hostname || url}. No summary available.`,
    }

    try {
      // Try to fetch the URL with a short timeout and follow redirects
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      // Note: fetch automatically follows redirects by default
      const response = await fetch(normalizedUrl, {
        signal: controller.signal,
        redirect: "follow", // Explicitly follow redirects
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      })

      clearTimeout(timeoutId)

      // Check if we got a successful response
      if (!response.ok) {
        console.error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
        // Return default metadata instead of failing
        return NextResponse.json(defaultMetadata)
      }

      // Get the final URL after any redirects
      const finalUrl = response.url
      console.log(`Original URL: ${normalizedUrl}, Final URL after redirects: ${finalUrl}`)

      // Try to get the content type
      const contentType = response.headers.get("content-type") || ""

      // Only try to parse HTML content
      if (!contentType.includes("text/html")) {
        console.log(`Content type is not HTML: ${contentType}`)
        return NextResponse.json({
          ...defaultMetadata,
          title: `${parsedUrl.hostname} (${contentType.split(";")[0]})`,
        })
      }

      const html = await response.text()

      // Extract title
      let title = defaultMetadata.title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/)
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim()
      }

      // Extract favicon
      let favicon = defaultMetadata.favicon

      // Try to get favicon from link tags
      const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["'][^>]*>/i)
      if (faviconMatch && faviconMatch[1]) {
        const faviconUrl = faviconMatch[1].trim()
        console.log("Found favicon URL in HTML:", faviconUrl)

        try {
          // Handle different types of URLs
          if (faviconUrl.startsWith("//")) {
            // Protocol-relative URL
            favicon = `https:${faviconUrl}`
          } else if (faviconUrl.startsWith("/")) {
            // Root-relative URL - use the origin from the final URL
            const baseUrl = new URL(finalUrl)
            favicon = `${baseUrl.origin}${faviconUrl}`
          } else if (!faviconUrl.startsWith("http://") && !faviconUrl.startsWith("https://")) {
            // Relative URL without leading slash
            // We need to be careful with the base path
            const baseUrl = new URL(finalUrl)

            // Get the directory part of the URL
            let basePath = baseUrl.pathname
            // If the path doesn't end with a slash, remove the last part (likely a file)
            if (!basePath.endsWith("/")) {
              basePath = basePath.substring(0, basePath.lastIndexOf("/") + 1)
            }

            favicon = `${baseUrl.origin}${basePath}${faviconUrl}`
          } else {
            // Absolute URL
            favicon = faviconUrl
          }

          console.log("Resolved favicon URL:", favicon)

          // Validate the favicon URL
          try {
            new URL(favicon) // This will throw if invalid
          } catch (e) {
            console.error("Invalid favicon URL after processing:", favicon, e)
            favicon = null
          }
        } catch (e) {
          console.error("Error processing favicon URL:", faviconUrl, e)
          favicon = null
        }
      }

      // If we couldn't get a favicon from the HTML, try the default location
      if (!favicon) {
        try {
          // Try default favicon location using the final URL
          const finalParsedUrl = new URL(finalUrl)
          favicon = `${finalParsedUrl.origin}/favicon.ico`
          console.log("Using default favicon location:", favicon)
        } catch (e) {
          console.error("Error creating default favicon URL:", e)
          favicon = null
        }
      }

      // Extract summary from meta description or first paragraph
      let summary = defaultMetadata.summary

      // Try meta description
      const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
      if (descriptionMatch && descriptionMatch[1]) {
        summary = descriptionMatch[1].trim()
      } else {
        // Try Open Graph description
        const ogDescriptionMatch = html.match(
          /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        )
        if (ogDescriptionMatch && ogDescriptionMatch[1]) {
          summary = ogDescriptionMatch[1].trim()
        } else {
          // Use our summary generator as a fallback
          summary = generateSimpleSummary(html, finalUrl)
        }
      }

      // If we still don't have a summary, try Jina AI
      if (summary === defaultMetadata.summary) {
        try {
          console.log("Trying Jina AI for summary...")
          const target = encodeURIComponent(finalUrl)
          const jinaController = new AbortController()
          const jinaTimeoutId = setTimeout(() => jinaController.abort(), 5000) // 5 second timeout

          const jinaResponse = await fetch(`https://r.jina.ai/http://${target}`, {
            signal: jinaController.signal,
          })

          clearTimeout(jinaTimeoutId)

          if (jinaResponse.ok) {
            const jinaText = await jinaResponse.text()
            if (jinaText && jinaText.trim().length > 0) {
              summary = jinaText.trim()
              console.log("Successfully got summary from Jina AI")
            } else {
              console.log("Jina AI returned empty summary")
            }
          } else {
            console.error(`Jina AI error: ${jinaResponse.status} ${jinaResponse.statusText}`)
          }
        } catch (error) {
          console.error("Error generating summary with Jina AI:", error)
          // Continue with the default summary
        }
      }

      return NextResponse.json({
        title,
        favicon,
        summary,
      })
    } catch (error) {
      console.error("Error fetching metadata:", error)
      // Return default metadata on error
      return NextResponse.json(defaultMetadata)
    }
  } catch (error: any) {
    console.error("Server error:", error)
    return NextResponse.json(
      {
        error: "Internal server error: " + error.message,
        title: "Unknown website",
        favicon: null,
        summary: "No summary available.",
      },
      { status: 200 }, // Return 200 with default data instead of error
    )
  }
}
