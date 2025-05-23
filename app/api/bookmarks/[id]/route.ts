import { NextResponse } from "next/server"
import { createRouteHandler } from "@/lib/supabase-route-handler"

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const id = params.id

  const supabase = createRouteHandler()
  const {
    data: user,
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: "User ID not found" }, { status: 400 });
  }

  // Verify ownership before deleting
  const { data: bookmark } = await supabase.from("bookmarks").select("user_id").eq("id", id).single()

  if (!bookmark || bookmark.user_id !== userId) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 })
  }

  const { error } = await supabase.from("bookmarks").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to delete bookmark" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
