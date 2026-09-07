import { formatDistanceToNow } from "date-fns"
import {
  Bell,
  Check,
  CheckCheck,
  Eye,
  MessageCircle,
  RotateCcw,
  UserPlus,
} from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { type AppNotification, useNotifications } from "@/hooks/use-notifications"
import { cn } from "@/lib/utils"

function notificationDetails(notification: AppNotification) {
  const version = notification.payload.version
    ? `V${notification.payload.version}`
    : "a version"

  switch (notification.kind) {
    case "assigned":
      return { icon: UserPlus, copy: "assigned you to this project", tab: "overview" }
    case "submitted_for_review":
      return { icon: Eye, copy: `submitted ${version} for review`, tab: "review" }
    case "approved":
      return { icon: Check, copy: `approved ${version}`, tab: "review" }
    case "changes_requested":
      return { icon: RotateCcw, copy: `requested changes on ${version}`, tab: "review" }
    case "commented":
      return {
        icon: MessageCircle,
        copy: "left a new comment",
        tab:
          notification.payload.subject_type === "asset_version" ? "review" : "overview",
      }
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, loading, error, markRead, markAllRead } =
    useNotifications()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative size-8"
            aria-label={
              unreadCount ? `${unreadCount} unread notifications` : "Notifications"
            }
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] leading-3.5 font-semibold text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" sideOffset={8} className="w-88 gap-0 p-0">
        <PopoverHeader className="flex-row items-center justify-between border-b px-4 py-3">
          <div>
            <PopoverTitle>Notifications</PopoverTitle>
            <PopoverDescription>
              {unreadCount ? `${unreadCount} unread` : "You're caught up"}
            </PopoverDescription>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck />
              Mark all read
            </Button>
          )}
        </PopoverHeader>

        <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1.5">
          {loading ? (
            <div className="space-y-1 p-1">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex gap-3 p-2.5">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              Notifications could not load.
            </p>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Nothing new</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Assignments, reviews and comments will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notification) => {
              const details = notificationDetails(notification)
              const Icon = details.icon
              return (
                <Link
                  key={notification.id}
                  to={`/projects/${notification.contentItemId}/${details.tab}`}
                  onClick={() => {
                    if (!notification.readAt) markRead.mutate(notification.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "relative flex gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted",
                    !notification.readAt && "bg-muted/60",
                  )}
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs leading-relaxed">
                      <span className="font-medium">{notification.actorName}</span>{" "}
                      {details.copy}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {notification.contentItemTitle} ·{" "}
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </span>
                  {!notification.readAt && (
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                </Link>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
