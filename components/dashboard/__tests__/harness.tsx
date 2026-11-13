import { render, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { LocalRepository, MemoryStore } from "@/lib/repo/local"
import type { BookmarkRepository } from "@/lib/repo/types"
import type { NewBookmark } from "@/lib/domain/bookmark"
import { DashboardProvider } from "../provider"

/** Mount dashboard components against a real LocalRepository in memory. */
export async function mountWithRepo(ui: ReactNode, seed: NewBookmark[] = [], prepare?: (repo: BookmarkRepository) => Promise<void>) {
  const repo: BookmarkRepository = new LocalRepository(new MemoryStore())
  await repo.importBookmarks(seed)
  await prepare?.(repo)
  const utils = render(
    <DashboardProvider mode="demo" repo={repo} initial={{ bookmarks: [], collections: [] }}>
      {ui}
    </DashboardProvider>,
  )
  await waitFor(() => expect(utils.container.querySelector("[data-hydrated='true']")).not.toBeNull())
  return { ...utils, repo }
}
