"use client"

import { useCallback, useState } from "react"
import { domainOf, registrableDomain } from "@/lib/url/normalize"
import { cn } from "@/lib/utils"
import { isBlankIcon, PROBE_MAX_PX } from "@/lib/client/blank-icon"

interface Props {
  url: string
  src: string | null
  size?: number
  className?: string
}

type Status = "loading" | "ok" | "failed"

/** The lettered tile: the domain's first letter on the inset surface. No globe icons. */
export function FaviconTile({ url, size = 16, className }: { url: string; size?: number; className?: string }) {
  // The letter of the name shown beside it (owasp.org, not cheatsheetseries.owasp.org).
  const host = domainOf(url) || url.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0] || ""
  const letter = registrableDomain(host).charAt(0).toUpperCase() || "?"
  return (
    <span
      aria-hidden
      data-favicon-tile=""
      className={cn("inline-flex shrink-0 select-none items-center justify-center bg-surface-2 font-bold leading-none text-ink-2", className)}
      // The hairline keeps the tile visible on a lit (surface-2) row too.
      style={{ width: size, height: size, borderRadius: Math.round(size / 5), fontSize: Math.round(size * 0.62), boxShadow: "inset 0 0 0 1px var(--line)" }}
    >
      {letter}
    </span>
  )
}

/**
 * 16px favicon. The lettered tile shows until the icon has really loaded, and stays when the
 * URL is missing or fails (including a failure before hydration, when React's onError never
 * fires) or loads with no visible pixels (lib/client/blank-icon), so the slot is never empty.
 */
export function Favicon({ url, src, size = 16, className }: Props) {
  const [state, setState] = useState<{ src: string | null; status: Status }>({ src, status: "loading" })
  // A new icon URL starts over (adjusting state during render, not in an effect).
  if (state.src !== src) setState({ src, status: "loading" })
  const status = state.src === src ? state.status : "loading"
  const settle = useCallback((img: HTMLImageElement) => {
    const at = img.getAttribute("src")
    const next: Status = img.naturalWidth > 0 ? "ok" : "failed"
    setState((s) => (s.src === at && s.status !== next ? { ...s, status: next } : s))
    // A small icon that loads but has no visible pixels is a failure too.
    if (next === "ok" && at && img.naturalWidth <= PROBE_MAX_PX) {
      void isBlankIcon(at).then((blank) => {
        if (blank) setState((s) => (s.src === at ? { ...s, status: "failed" } : s))
      })
    }
  }, [])
  // The image may have loaded or failed before React attached its handlers.
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) settle(img)
  }, [settle])

  if (!src || status === "failed") return <FaviconTile url={url} size={size} className={className} />
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      {/* Tile and icon cross-fade (opacity only), so a late icon never pops in. */}
      <FaviconTile url={url} size={size} className={cn("absolute inset-0 transition-opacity duration-[120ms] ease-out motion-reduce:transition-none", status === "ok" && "opacity-0")} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setState((s) => (s.src === src ? { ...s, status: "failed" } : s))}
        onLoad={(e) => settle(e.currentTarget)}
        className={cn("relative rounded-[3px] object-contain transition-opacity duration-[120ms] ease-out motion-reduce:transition-none", status === "ok" ? "opacity-100" : "opacity-0")}
        style={{ width: size, height: size }}
      />
    </span>
  )
}
