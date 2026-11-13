import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The highlighter mark: a yellow felt-tip stroke behind inline text, sitting low
 * with a ragged right end. It is the only brand device in the app.
 * `animate` draws it in once from the left; `tilt` sets the stroke angle.
 * Tilt uses the independent `rotate` property so the swipe-in transform keeps it.
 */
export function Mark({
  children,
  className,
  animate = false,
  tilt = "-1deg",
}: {
  children: ReactNode
  className?: string
  animate?: boolean
  tilt?: string
}) {
  return (
    <span className={cn("relative isolate inline-block whitespace-nowrap", className)}>
      <span
        aria-hidden
        className={cn("absolute -inset-x-[0.1em] bottom-[0.02em] top-[0.36em] -z-[1]", animate && "swipe-in")}
        style={{
          background: "var(--mark)",
          mixBlendMode: "var(--mark-blend)" as never,
          rotate: tilt,
          clipPath: "polygon(0 18%, 3% 4%, 97% 0, 100% 30%, 98% 88%, 94% 100%, 2% 92%)",
        }}
      />
      <span className="relative" style={{ color: "var(--mark-ink)" }}>{children}</span>
    </span>
  )
}
