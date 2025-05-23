import { NextResponse } from "next/server"
import { createRouteHandler } from "@/lib/supabase-route-handler"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = params.id
  const { tag } = await request.json()

  if (!tag || typeof tag !== "string") {
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 })
  }

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

  // Get current bookmark and verify ownership
  const { data: bookmark, error: fetchError } = await supabase.from("bookmarks").select("*").eq("id", id).single()

  if (fetchError || !bookmark) {
    return NextResponse.json({ error: "Bookmark not found" }, { status: 404 })
  }

  if (bookmark.user_id !== userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }

  // Add tag if it doesn't already exist
  const currentTags = bookmark.tags || []
  if (!currentTags.includes(tag)) {
    const newTags = [...currentTags, tag]

    const { error: updateError } = await supabase.from("bookmarks").update({ tags: newTags }).eq("id", id)

    if (updateError) {
      return NextResponse.json({ error: "Failed to add tag" }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
