import Link from "next/link"
import { cn } from "@/lib/utils"

export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("font-display text-[19px] font-semibold tracking-tight text-ink", className)}>
      Bookmark-AI
    </Link>
  )
}
