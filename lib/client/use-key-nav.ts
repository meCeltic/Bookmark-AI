"use client"

import { useCallback, useEffect, useRef } from "react"

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable))
}

/**
 * Keyboard or mouse, whichever was used last. A key press puts `data-keys` on the
 * element (CSS then ignores :hover inside it) until the pointer really moves:
 * rows scrolling under a still pointer do not count. `isKeys()` lets hover
 * handlers stand down while the keyboard is driving.
 */
export function useKeyNav<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const keys = useRef(false)
  useEffect(() => {
    let x = Number.NaN
    let y = Number.NaN
    const set = (on: boolean) => {
      if (keys.current === on) return
      keys.current = on
      ref.current?.toggleAttribute("data-keys", on)
    }
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || e.key === "Shift" || e.key === "Tab") return
      set(true)
    }
    const onMove = (e: MouseEvent) => {
      if (e.screenX === x && e.screenY === y) return
      x = e.screenX
      y = e.screenY
      set(false)
    }
    // Capture phase: decided before any row's own handlers run.
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("mousemove", onMove, true)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      window.removeEventListener("mousemove", onMove, true)
    }
  }, [])
  // The list element may remount (empty state, layout switch): reapply on attach.
  const attach = useCallback((el: T | null) => {
    ref.current = el
    el?.toggleAttribute("data-keys", keys.current)
  }, [])
  const isKeys = useCallback(() => keys.current, [])
  return { attach, isKeys }
}
