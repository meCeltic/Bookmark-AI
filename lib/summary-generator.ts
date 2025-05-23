/**
 * Generates a simple summary from HTML content
 */
export function generateSimpleSummary(html: string, url: string, maxLength = 200): string {
  // Try to extract meta description
  const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
  if (descriptionMatch && descriptionMatch[1]) {
    const description = descriptionMatch[1].trim()
    return description.length > maxLength ? description.substring(0, maxLength) + "..." : description
  }

  // Try Open Graph description
  const ogDescriptionMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
  if (ogDescriptionMatch && ogDescriptionMatch[1]) {
    const description = ogDescriptionMatch[1].trim()
    return description.length > maxLength ? description.substring(0, maxLength) + "..." : description
  }

  // Extract text from paragraphs
  const paragraphRegex = /<p[^>]*>([^<]+)<\/p>/g
  const paragraphs: string[] = []
  let match
  while ((match = paragraphRegex.exec(html)) !== null && paragraphs.length < 3) {
    if (match[1].trim().length > 20) {
      // Only include paragraphs with meaningful content
      paragraphs.push(match[1].trim())
    }
  }

  if (paragraphs.length > 0) {
    const combinedText = paragraphs.join(" ").substring(0, maxLength)
    return combinedText.length === maxLength ? combinedText + "..." : combinedText
  }

  // Try to extract the first div with substantial text
  const divRegex = /<div[^>]*>([^<]{40,})<\/div>/g
  const divs: string[] = []
  let divMatch
  while ((divMatch = divRegex.exec(html)) !== null && divs.length < 2) {
    divs.push(divMatch[1].trim())
  }

  if (divs.length > 0) {
    const combinedText = divs.join(" ").substring(0, maxLength)
    return combinedText.length === maxLength ? combinedText + "..." : combinedText
  }

  // Fallback
  return `Bookmark from ${new URL(url).hostname}. No summary available.`
}
