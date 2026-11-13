"use client"

import { useState } from "react"
import { domainOf } from "@/lib/url/normalize"
import { cn } from "@/lib/utils"

interface Props {
  url: string
  src: string | null
  size?: number
  className?: string
}

/** 16px favicon with a letter fallback on the inset surface. No globe icons. */
export function Favicon({ url, src, size = 16, className }: Props) {
  const [failed, setFailed] = useState(false)
  const letter = (domainOf(url) || "?").charAt(0).toUpperCase()
  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={cn("inline-flex shrink-0 items-center justify-center bg-surface-2 text-[10px] font-semibold text-ink-2", className)}
        style={{ width: size, height: size, borderRadius: 3 }}
      >
        {letter}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      onLoad={(e) => { if (e.currentTarget.naturalWidth === 0) setFailed(true) }}
      className={cn("shrink-0 rounded-[3px] object-contain", className)}
      style={{ width: size, height: size }}
    />
  )
}
