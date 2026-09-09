import type { ReactNode } from "react"
import { NotificationBell } from "@/components/notification-bell"
import { SidebarTrigger } from "@/components/ui/sidebar"

interface PageHeaderProps {
  title: string
  /** Optional right-aligned content — counts, filters, actions. */
  children?: ReactNode
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 sm:px-6">
      {/*
        The button base sets `dark:hover:bg-muted/50`, which is nearly invisible
        against this background. Match the full-strength hover the sidebar menu
        items use, so the two read consistently side by side.
      */}
      <SidebarTrigger className="dark:hover:bg-muted" />
      <div className="h-4 w-px shrink-0 bg-border" />
      <h1 className="min-w-0 truncate text-sm font-medium">{title}</h1>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {children}
        <NotificationBell />
      </div>
    </header>
  )
}
