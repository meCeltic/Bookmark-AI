"use client"

import { toast } from "sonner"

/**
 * A toast with an Undo action and a 2px bar that runs down with the timer.
 * The bar pauses while the toast is hovered, as sonner's own timer does.
 */
export function undoToast(message: string, onUndo: () => void | Promise<void>, duration = 6000) {
  let undone = false
  return toast(message, {
    duration,
    description: (
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-2 bottom-0 block h-[2px] rounded-full bg-action/70 motion-reduce:[animation:none] [[data-sonner-toast]:hover_&]:[animation-play-state:paused]"
        style={{ animation: `countdown ${duration}ms linear both`, transformOrigin: "left" }}
      />
    ),
    action: {
      label: "Undo",
      onClick: () => {
        if (undone) return
        undone = true
        void onUndo()
      },
    },
  })
}
