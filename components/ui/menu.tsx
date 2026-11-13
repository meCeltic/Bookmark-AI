"use client"

import * as Menu from "@radix-ui/react-dropdown-menu"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"

export const MenuRoot = Menu.Root
export const MenuTrigger = Menu.Trigger
export const MenuSeparator = () => <Menu.Separator className="my-1 h-px bg-line" />

export function MenuContent({ children, className, ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={6}
        align="end"
        // Grows from the trigger side; Radix sets the origin and data-state drives open/close.
        className={cn("pop menu-anim z-50 min-w-[200px] origin-[var(--radix-dropdown-menu-content-transform-origin)] p-1 outline-none", className)}
        {...props}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  )
}

export function MenuItem({ children, className, danger, ...props }: ComponentProps<typeof Menu.Item> & { danger?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        "flex h-8 cursor-pointer select-none items-center gap-2 rounded-[6px] px-2 text-[13px] text-ink outline-none data-[disabled]:cursor-default data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50",
        danger && "text-danger",
        className,
      )}
      {...props}
    >
      {children}
    </Menu.Item>
  )
}

export function MenuSub({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Menu.Sub>
      <Menu.SubTrigger className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-[6px] px-2 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2 data-[state=open]:bg-surface-2">
        {label}
        <span className="ml-auto text-ink-3">›</span>
      </Menu.SubTrigger>
      <Menu.Portal>
        <Menu.SubContent sideOffset={4} className="pop menu-anim z-50 min-w-[180px] origin-[var(--radix-dropdown-menu-content-transform-origin)] p-1 outline-none">
          {children}
        </Menu.SubContent>
      </Menu.Portal>
    </Menu.Sub>
  )
}
