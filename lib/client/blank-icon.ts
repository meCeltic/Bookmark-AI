/**
 * Some sites serve a favicon that loads fine but has no visible pixels (an all-transparent
 * 16px .ico, e.g. joelonsoftware.com). The browser reports it as a good image, so the slot
 * would sit empty. Cross-origin pixels can't be read, so the probe goes through Next's
 * image route on our own origin (it passes .ico through untouched) and checks the alpha.
 * One probe per icon URL per visit; any failure keeps the icon (fail open).
 */
const verdicts = new Map<string, Promise<boolean>>()

/** Only small icons are probed: blank placeholders are 16–32px; real logos are left alone. */
export const PROBE_MAX_PX = 32

export function isBlankIcon(src: string): Promise<boolean> {
  const known = verdicts.get(src)
  if (known) return known
  const verdict = new Promise<boolean>((resolve) => {
    if (typeof Image === "undefined" || typeof document === "undefined" || !/^https:\/\//i.test(src)) return resolve(false)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = 16
        canvas.height = 16
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return resolve(false)
        ctx.drawImage(img, 0, 0, 16, 16)
        const { data } = ctx.getImageData(0, 0, 16, 16)
        let visible = 0
        for (let i = 3; i < data.length; i += 4) if (data[i]! > 24) visible++
        resolve(visible < 3)
      } catch {
        resolve(false)
      }
    }
    img.onerror = () => resolve(false)
    img.src = `/_next/image?url=${encodeURIComponent(src)}&w=32&q=75`
  })
  verdicts.set(src, verdict)
  return verdict
}
