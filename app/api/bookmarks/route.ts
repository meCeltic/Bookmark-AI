import { NextResponse } from "next/server"
import { createRouteHandler } from "@/lib/supabase-route-handler"

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    // Validate URL
    try {
      new URL(url)
    } catch (e) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    // Get user session
    const supabase = createRouteHandler()
    const {
      data: user,
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Explicitly cast user to the expected type
    const userId = (user as User).id;

    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }

    // Check if the bookmarks table exists
    const { error: tableCheckError } = await supabase.from("bookmarks").select("id").limit(1)

    if (tableCheckError && tableCheckError.message.includes("does not exist")) {
      return NextResponse.json(
        {
          error: "The bookmarks table does not exist. Please set up the database first.",
        },
        { status: 500 },
      )
    }

    // Fetch metadata (title, favicon)
    let title = ""
    let favicon = ""

    try {
      const response = await fetch(url)
      const html = await response.text()

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/)
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim()
      }

      // Extract favicon
      const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["'][^>]*>/i)
      if (faviconMatch && faviconMatch[1]) {
        let faviconUrl = faviconMatch[1]

        // Handle relative URLs
        if (faviconUrl.startsWith("/")) {
          const baseUrl = new URL(url)
          faviconUrl = `${baseUrl.origin}${faviconUrl}`
        } else if (!faviconUrl.startsWith("http")) {
          const baseUrl = new URL(url)
          faviconUrl = `${baseUrl.origin}/${faviconUrl}`
        }

        favicon = faviconUrl
      } else {
        // Try default favicon location
        const baseUrl = new URL(url)
        favicon = `${baseUrl.origin}/favicon.ico`
      }
    } catch (error) {
      console.error("Error fetching metadata:", error)
      // Continue without metadata
    }

    // Generate summary with Jina AI
    let summary = ""
    try {
      const target = encodeURIComponent(url)
      const jinaResponse = await fetch(`https://r.jina.ai/http://${target}`)
      if (jinaResponse.ok) {
        summary = await jinaResponse.text()
      }
    } catch (error) {
      console.error("Error generating summary:", error)
      // Continue without summary
    }

    // Save bookmark to database with explicit data types
    const bookmarkData = {
      url: url,
      title: title || null,
      favicon: favicon || null,
      summary: summary || null,
      user_id: user.id,
      tags: [],
      created_at: new Date().toISOString(),
    }

    console.log("Inserting bookmark:", bookmarkData)

    const { data: bookmark, error } = await supabase.from("bookmarks").insert(bookmarkData).select().single()

    if (error) {
      console.error("Database insert error:", error)
      return NextResponse.json({ error: "Failed to save bookmark: " + error.message }, { status: 500 })
    }

    return NextResponse.json(bookmark)
  } catch (error: any) {
    console.error("Server error:", error)
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 })
  }
}

export async function GET() {
  const supabase = createRouteHandler()
  const {
    data: user,
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if the bookmarks table exists
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    if (error.message.includes("does not exist")) {
      // Table doesn't exist yet, return empty array
      return NextResponse.json([])
    }
    return NextResponse.json({ error: "Failed to fetch bookmarks: " + error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
