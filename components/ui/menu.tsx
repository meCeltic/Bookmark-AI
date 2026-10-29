"use client"

import * as Menu from "@radix-ui/react-dropdown-menu"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"

export const MenuRoot = Menu.Root
export const MenuTrigger = Menu.Trigger
export const MenuSeparator = () => <Menu.Separator className="my-1 h-px bg-border" />

export function MenuContent({ children, className, ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={6}
        align="end"
        className={cn("card anim-pop z-50 min-w-[200px] p-1 shadow-card outline-none", className)}
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
        "flex cursor-pointer select-none items-center gap-2 rounded-[2px] px-2 py-1.5 text-[13.5px] outline-none data-[highlighted]:bg-surface-2",
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
      <Menu.SubTrigger className="flex cursor-pointer select-none items-center gap-2 rounded-[2px] px-2 py-1.5 text-[13.5px] outline-none data-[highlighted]:bg-surface-2 data-[state=open]:bg-surface-2">
        {label}
        <span className="ml-auto text-ink-3">›</span>
      </Menu.SubTrigger>
      <Menu.Portal>
        <Menu.SubContent sideOffset={4} className="card anim-pop z-50 min-w-[180px] p-1 shadow-card outline-none">
          {children}
        </Menu.SubContent>
      </Menu.Portal>
    </Menu.Sub>
  )
}
