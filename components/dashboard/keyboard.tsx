"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import type { Bookmark } from "@/lib/domain/bookmark"
import { useDashboard } from "./provider"

interface Options {
  items: Bookmark[]
  focusId: string | null
  setFocusId: (id: string | null) => void
}

/**
 * j/k move (and carry the preview pane along), enter or o opens, f star, r read, d done (read + archive), e archive,
 * u moves a Done card back to the Inbox,
 * shift+R read something, x select, c copy, backspace delete, g/l layout,
 * escape closes the pane, then clears. Ignored while typing.
 */
export function useKeyboard({ items, focusId, setFocusId }: Options) {
  const api = useDashboard()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable || target.getAttribute("role") === "menuitem")
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      // Enter on a link or button is that element's own click; do not open a second tab.
      if (e.key === "Enter" && target && (target.tagName === "A" || target.tagName === "BUTTON")) return

      const index = items.findIndex((b) => b.id === focusId)
      const current = index >= 0 ? items[index] : undefined
      const previewing = api.state.preview !== null
      const focusOn = (id: string) => {
        setFocusId(id)
        if (previewing) api.setPreview(id)
      }
      const move = (delta: number) => {
        const next = items[Math.max(0, Math.min(items.length - 1, index + delta))]
        if (next) {
          focusOn(next.id)
          const el = document.querySelector<HTMLElement>(`[data-id="${next.id}"]`)
          if (el) el.scrollIntoView({ block: "nearest" })
          else window.dispatchEvent(new CustomEvent("bookmark-ai:reveal", { detail: { id: next.id } }))
        }
      }

      switch (e.key) {
        case "j": case "ArrowDown": e.preventDefault(); move(1); break
        case "k": case "ArrowUp": e.preventDefault(); move(-1); break
        case "Enter": case "o": if (current) { e.preventDefault(); api.open(current) } break
        case "f": if (current) void api.patch(current.id, { favourite: !current.favourite }); break
        case "r": if (current) void api.patch(current.id, { readAt: current.readAt ? null : new Date().toISOString() }); break
        case "R": e.preventDefault(); api.readSomething(); break
        case "e":
        case "d":
          if (current) {
            // Focus moves on to the neighbour, so a run of d d d clears the Inbox.
            const neighbour = items[index + 1] ?? items[index - 1]
            if (e.key === "d" && !current.archivedAt) void api.done([current.id])
            else void api.toggleArchive(current)
            if (neighbour) focusOn(neighbour.id)
            else if (previewing) api.setPreview(null)
          }
          break
        case "u":
          if (current?.archivedAt) {
            const neighbour = items[index + 1] ?? items[index - 1]
            void api.toggleArchive(current)
            if (neighbour) focusOn(neighbour.id)
            else if (previewing) api.setPreview(null)
          }
          break
        case "x": if (current) api.dispatch({ type: "select", ids: [current.id], mode: "toggle" }); break
        case "c": if (current) { void navigator.clipboard.writeText(current.url); toast("Link copied") } break
        case "Backspace": case "Delete":
          if (api.state.selected.size) { e.preventDefault(); void api.remove([...api.state.selected]) }
          else if (current) { e.preventDefault(); void api.remove([current.id]) }
          break
        case "g": if (api.state.layout !== "grid") api.setLayout("grid"); break
        case "l": if (api.state.layout !== "list") api.setLayout("list"); break
        case "a": case "A": if (e.shiftKey) { e.preventDefault(); api.dispatch({ type: "select", ids: items.map((b) => b.id), mode: "set" }) } break
        case "t": if (current) window.dispatchEvent(new CustomEvent("bookmark-ai:tag", { detail: current.id })); break
        case "Escape":
          if (previewing) api.setPreview(null)
          else if (api.state.selected.size) api.dispatch({ type: "select", ids: [], mode: "set" })
          else setFocusId(null)
          break
        case "?": e.preventDefault(); window.dispatchEvent(new CustomEvent("bookmark-ai:help")); break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [api, items, focusId, setFocusId])
}
