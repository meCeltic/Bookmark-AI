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
 * j/k move, enter opens, f favourite, r read, e archive, x select, c copy,
 * backspace delete, g/l layout, escape clears. Ignored while typing.
 */
export function useKeyboard({ items, focusId, setFocusId }: Options) {
  const api = useDashboard()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || target.getAttribute("role") === "menuitem")
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return

      const index = items.findIndex((b) => b.id === focusId)
      const current = index >= 0 ? items[index] : undefined
      const move = (delta: number) => {
        const next = items[Math.max(0, Math.min(items.length - 1, index + delta))]
        if (next) {
          setFocusId(next.id)
          document.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.scrollIntoView({ block: "nearest" })
        }
      }

      switch (e.key) {
        case "j": case "ArrowDown": e.preventDefault(); move(1); break
        case "k": case "ArrowUp": e.preventDefault(); move(-1); break
        case "Enter": if (current) { e.preventDefault(); api.open(current) } break
        case "f": if (current) void api.patch(current.id, { favourite: !current.favourite }); break
        case "r": if (current) void api.patch(current.id, { readAt: current.readAt ? null : new Date().toISOString() }); break
        case "e": if (current) void api.patch(current.id, { archivedAt: current.archivedAt ? null : new Date().toISOString() }); break
        case "x": if (current) api.dispatch({ type: "select", ids: [current.id], mode: "toggle" }); break
        case "c": if (current) { void navigator.clipboard.writeText(current.url); toast("Link copied") } break
        case "Backspace": case "Delete":
          if (api.state.selected.size) { e.preventDefault(); void api.remove([...api.state.selected]) }
          else if (current) { e.preventDefault(); void api.remove([current.id]) }
          break
        case "g": api.dispatch({ type: "layout", layout: "grid" }); break
        case "l": api.dispatch({ type: "layout", layout: "list" }); break
        case "a": case "A": if (e.shiftKey) { e.preventDefault(); api.dispatch({ type: "select", ids: items.map((b) => b.id), mode: "set" }) } break
        case "t": if (current) window.dispatchEvent(new CustomEvent("bookmark-ai:tag", { detail: current.id })); break
        case "Escape":
          if (api.state.selected.size) api.dispatch({ type: "select", ids: [], mode: "set" })
          else setFocusId(null)
          break
        case "?": e.preventDefault(); window.dispatchEvent(new CustomEvent("bookmark-ai:help")); break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [api, items, focusId, setFocusId])
}
