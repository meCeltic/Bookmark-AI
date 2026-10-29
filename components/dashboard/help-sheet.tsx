"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"

const ROWS: Array<[string, string]> = [
  ["/", "Focus search"],
  ["⌘ K", "Command palette"],
  ["j / k", "Next / previous card"],
  ["↵", "Open card"],
  ["f", "Favourite"],
  ["r", "Mark read / unread"],
  ["e", "Archive / restore"],
  ["t", "Add tag (from the card menu)"],
  ["x", "Select card"],
  ["⇧ A", "Select all"],
  ["c", "Copy link"],
  ["⌫", "Delete (undoable)"],
  ["g / l", "Grid / list"],
  ["?", "This sheet"],
]

export function HelpSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Keyboard" description="Everything works without a mouse.">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 p-5 text-[13.5px]">
          {ROWS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3 border-b border-border py-1">
              <dt className="text-ink-2">{label}</dt>
              <dd className="flex gap-1">{key.split(" ").map((k) => <kbd key={k} className="kbd">{k}</kbd>)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
