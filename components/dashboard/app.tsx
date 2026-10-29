"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import type { Bookmark, Collection } from "@/lib/domain/bookmark"
import { LocalRepository, MemoryStore } from "@/lib/repo/local"
import { RemoteRepository } from "@/lib/repo/remote"
import type { BookmarkRepository } from "@/lib/repo/types"
import { DEMO_COLLECTIONS, buildSeed } from "@/lib/demo/seed"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { DashboardProvider } from "./provider"
import { DashboardShell } from "./shell"

interface CloudProps {
  mode: "cloud"
  user: { email: string }
  initial: { bookmarks: Bookmark[]; collections: Collection[] }
}
interface DemoProps {
  mode: "demo"
  cloudAvailable: boolean
}

async function seedDemo(repo: BookmarkRepository) {
  const collections: Collection[] = []
  for (const { name } of DEMO_COLLECTIONS) {
    const r = await repo.createCollection(name)
    if (r.ok) collections.push(r.data)
  }
  await repo.importBookmarks(buildSeed(collections))
}

export function DashboardApp(props: CloudProps | DemoProps) {
  const router = useRouter()
  const repo = useMemo<BookmarkRepository>(() => {
    if (props.mode === "cloud") return new RemoteRepository(props.initial)
    const store = typeof window !== "undefined" ? window.localStorage : new MemoryStore()
    return new LocalRepository(store)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode])

  if (props.mode === "cloud") {
    const signOut = async () => {
      await createSupabaseBrowserClient()?.auth.signOut()
      router.push("/")
      router.refresh()
    }
    return (
      <DashboardProvider mode="cloud" repo={repo} initial={props.initial}>
        <DashboardShell userLabel={props.user.email} cloudAvailable onSignOut={signOut} />
      </DashboardProvider>
    )
  }

  return (
    <DashboardProvider mode="demo" repo={repo} initial={{ bookmarks: [], collections: [] }} seed={seedDemo}>
      <DashboardShell userLabel="demo visitor" cloudAvailable={props.cloudAvailable} />
    </DashboardProvider>
  )
}
