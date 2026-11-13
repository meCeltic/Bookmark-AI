"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export const Dialog = DialogPrimitive.Root

interface ContentProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
  /** Visually hide the header while keeping it for screen readers. */
  bare?: boolean
  /** Leave focus where it was on open (for read-only sheets); Escape still closes. */
  noAutoFocus?: boolean
}

export function DialogContent({ title, description, children, className, bare, noAutoFocus }: ContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fade-anim fixed inset-0 z-40 bg-ink/30 dark:bg-black/60" />
      <DialogPrimitive.Content
        onOpenAutoFocus={noAutoFocus ? (e) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur() } : undefined}
        className={cn(
          // Centred with margins, not a translate, so the pop keyframes own `transform`.
          "pop pop-anim fixed inset-x-0 top-[12vh] z-50 mx-auto w-[520px] max-w-[calc(100vw-32px)] [transform-origin:top_center] p-0 outline-none",
          className,
        )}
      >
        {bare ? (
          <>
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description> : null}
          </>
        ) : (
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 pb-3 pt-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[17px] font-semibold leading-tight">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-[13px] text-ink-2">{description}</DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close className="btn btn-ghost btn-icon -mr-2 -mt-1" aria-label="Close">
              <X size={16} />
            </DialogPrimitive.Close>
          </header>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
