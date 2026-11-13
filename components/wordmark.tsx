import Link from "next/link"
import { Mark } from "@/components/mark"
import { cn } from "@/lib/utils"

export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Bookmark-AI home"
      className={cn("isolate inline-flex items-baseline text-[19px] font-bold tracking-[-0.03em] text-ink", className)}
    >
      book<Mark tilt="-2deg">mark</Mark>
    </Link>
  )
}
