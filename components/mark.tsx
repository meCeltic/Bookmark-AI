import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The highlighter mark: a yellow felt-tip stroke behind inline text with a ragged right end.
 * It is the only brand device in the app.
 * - `animate` draws it in once from the left (the `swipe-in` transform lives on the stroke itself,
 *   so it never depends on a parent transform).
 * - `tilt` sets the stroke angle via the independent `rotate` property, so the swipe keeps it.
 * - `insetY` sets an even top/bottom inset (e.g. ".22em" for a 13px nav label); by default the
 *   stroke sits low, from 0.36em down to 0.02em above the bottom.
 */
export function Mark({
  children,
  className,
  animate = false,
  tilt = "-1deg",
  insetY,
}: {
  children: ReactNode
  className?: string
  animate?: boolean
  tilt?: string
  insetY?: string
}) {
  const stroke: CSSProperties = {
    top: insetY ?? "0.36em",
    bottom: insetY ?? "0.02em",
    left: "-0.1em",
    right: "-0.1em",
    zIndex: -1,
    background: "var(--mark)",
    mixBlendMode: "var(--mark-blend)" as never,
    rotate: tilt,
    clipPath: "polygon(0 18%, 3% 4%, 97% 0, 100% 30%, 98% 88%, 94% 100%, 2% 92%)",
  }
  return (
    <span className={cn("relative isolate inline-block whitespace-nowrap", className)}>
      <span aria-hidden className={cn("absolute", animate && "swipe-in")} style={stroke} />
      <span className="relative" style={{ color: "var(--mark-ink)" }}>{children}</span>
    </span>
  )
}
