import { flushSync } from "react-dom"

type ViewTransition = { updateCallbackDone?: Promise<void>; finished?: Promise<void> }
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
 * `onFinished` runs once the animation is over (or straight away without one).
 */
export function withTransition(fn: () => void, onFinished?: () => void): Promise<void> {
  const start = typeof document !== "undefined" ? (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition : undefined
  if (!start || prefersReducedMotion()) {
    fn()
    onFinished?.()
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
    if (onFinished) (transition?.finished ?? Promise.resolve()).then(onFinished, onFinished)
    return (transition?.updateCallbackDone ?? Promise.resolve()).then(run, run)
  } catch {
    run()
    onFinished?.()
    return Promise.resolve()
  }
}

const isTyping = () => {
  const el = typeof document !== "undefined" ? document.activeElement : null
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el as HTMLElement).isContentEditable))
}

/**
 * Batch updates that land on their own (an AI summary arriving) into one View
 * Transition per frame. A second startViewTransition would skip the running one,
 * so same-frame landings share a transition. While the visitor is typing the
 * update applies directly: a transition would freeze the caret for 280ms.
 */
export function createLandingQueue() {
  let queue: Array<{ fn: () => void; done: () => void }> = []
  let scheduled = false
  const frame = (cb: () => void) =>
    typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : setTimeout(cb, 16)

  const flush = () => {
    scheduled = false
    const batch = queue
    queue = []
    const all = () => { for (const item of batch) item.fn() }
    const settle = () => { for (const item of batch) item.done() }
    if (isTyping()) {
      all()
      settle()
    } else void withTransition(all).then(settle, settle)
  }

  return (fn: () => void): Promise<void> =>
    new Promise<void>((resolve) => {
      queue.push({ fn, done: resolve })
      if (!scheduled) {
        scheduled = true
        frame(flush)
      }
    })
}
