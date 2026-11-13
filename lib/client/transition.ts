import { flushSync } from "react-dom"

type ViewTransition = { updateCallbackDone?: Promise<void> }
type StartViewTransition = (cb: () => void) => ViewTransition | undefined

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Run a state change inside a View Transition so cards with a
 * `view-transition-name` slide to their new places. Falls back to a plain
 * call where the API is missing or the visitor asked for less motion.
 *
 * The browser calls `fn` a frame later, after it snapshots the old page.
 * The returned promise settles once `fn` has run; await it before
 * dispatching anything that depends on this update having landed.
 */
export function withTransition(fn: () => void): Promise<void> {
  const start = typeof document !== "undefined" ? (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition : undefined
  if (!start || prefersReducedMotion()) {
    fn()
    return Promise.resolve()
  }
  let ran = false
  const run = () => {
    if (ran) return
    ran = true
    flushSync(fn)
  }
  try {
    const transition = start.call(document, run)
    return (transition?.updateCallbackDone ?? Promise.resolve()).then(run, run)
  } catch {
    run()
    return Promise.resolve()
  }
}
