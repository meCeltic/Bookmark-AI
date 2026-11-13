import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The highlighter mark: a slightly irregular yellow swipe behind inline text.
 * It is the only brand device in the app. `animate` draws it in once from the left.
 */
export function Mark({
  children,
  className,
  animate = false,
}: {
  children: ReactNode
  className?: string
  animate?: boolean
}) {
  return (
    <span className={cn("relative inline-block whitespace-nowrap", className)}>
      <span
        aria-hidden
        className={cn("absolute -inset-x-[0.12em] inset-y-[0.08em] -z-[1]", animate && "swipe-in")}
        style={{
          background: "var(--mark)",
          mixBlendMode: "var(--mark-blend)" as never,
          transform: "rotate(-1deg)",
          borderRadius: "0.18em 0.3em 0.22em 0.35em / 0.5em 0.2em 0.5em 0.25em",
          clipPath: "polygon(0.6% 8%, 99% 0%, 100% 92%, 1.5% 100%)",
        }}
      />
      <span className="relative">{children}</span>
    </span>
  )
}
