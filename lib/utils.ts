import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * "14 Sep", or "14 Sep 2024" outside this year. Spelled out by hand: ICU's en-GB says "Sept",
 * and other locales reorder or pad, so the meta column would never line up.
 */
export function formatDate(iso: string, opts: { year?: "always" | "auto" } = {}): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const withYear = opts.year === "always" || d.getFullYear() !== new Date().getFullYear()
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`
}

export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
