"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"

const ROWS: Array<[string, string]> = [
  ["/", "Focus search"],
  ["⌘K", "Command palette"],
  ["j / k", "Next / previous card"],
  ["click", "Preview card"],
  ["↵ / o", "Open link"],
  ["esc", "Close preview"],
  ["d", "Done: mark read, clear from Inbox"],
  ["f", "Star"],
  ["r", "Mark read / unread"],
  ["e", "Move to Done / back to Inbox"],
  ["⇧R", "Read something (random unread)"],
  ["t", "Add tag"],
  ["x", "Select card"],
  ["⇧A", "Select all"],
  ["c", "Copy link"],
  ["⌫", "Delete (undoable)"],
  ["g / l", "Grid / list"],
  ["#", "Filter by tag (in search)"],
  ["?", "This sheet"],
]

export function HelpSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Keyboard" description="Everything works without a mouse." noAutoFocus>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 p-5 text-[13px] sm:grid-cols-2">
          {ROWS.map(([key, label]) => (
            <div key={key} className="flex min-w-0 items-center justify-between gap-3 border-b border-line py-1.5">
              <dt className="text-ink-2">{label}</dt>
              <dd className="flex gap-1">{key.split(" ").map((k) => <kbd key={k} className="kbd">{k}</kbd>)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
