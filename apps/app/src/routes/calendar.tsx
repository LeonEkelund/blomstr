import type { ContentItem } from "@blomstr/types"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useContent } from "@/hooks/use-content"
import { cn } from "@/lib/utils"

type CalendarEventKind = "due" | "publish"

interface CalendarEvent {
  id: string
  item: ContentItem
  kind: CalendarEventKind
}

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function dateKey(value: Date | string) {
  return format(typeof value === "string" ? new Date(value) : value, "yyyy-MM-dd")
}

function buildEvents(items: ContentItem[]) {
  const byDay = new Map<string, CalendarEvent[]>()

  function add(item: ContentItem, kind: CalendarEventKind, value: string | null) {
    if (!value) return
    const key = dateKey(value)
    const events = byDay.get(key) ?? []
    events.push({ id: `${item.id}-${kind}`, item, kind })
    byDay.set(key, events)
  }

  for (const item of items) {
    add(item, "due", item.dueAt)
    add(item, "publish", item.publishAt)
  }

  for (const events of byDay.values()) {
    events.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "publish" ? -1 : 1
      return a.item.title.localeCompare(b.item.title)
    })
  }

  return byDay
}

function EventLink({ event }: { event: CalendarEvent }) {
  const label = event.kind === "publish" ? "Publish" : "Due"

  return (
    <Link
      to={`/projects/${event.item.id}/overview`}
      title={`${label}: ${event.item.title}`}
      className={cn(
        "block truncate rounded-md px-2 py-1 text-xs transition-colors",
        event.kind === "publish"
          ? "bg-primary text-primary-foreground hover:bg-primary/85"
          : "border bg-card text-card-foreground hover:bg-muted",
      )}
    >
      <span className="mr-1 opacity-65">{label}</span>
      {event.item.title}
    </Link>
  )
}

function CalendarSkeleton({ days }: { days: Date[] }) {
  return (
    <div className="grid grid-cols-7">
      {days.map((day, index) => {
        const lastColumn = index % 7 === 6
        const lastRow = index >= days.length - 7

        return (
          <div
            key={dateKey(day)}
            className={cn(
              "min-h-28 border-r border-b p-2",
              lastColumn && "border-r-0",
              lastRow && "border-b-0",
            )}
          >
            <Skeleton className="size-6 rounded-full" />
            {index % 4 === 0 && <Skeleton className="mt-3 h-6 w-full" />}
          </div>
        )
      })}
    </div>
  )
}

export function CalendarPage() {
  const { items, loading } = useContent()
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()))

  const days = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth)
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
    })
  }, [visibleMonth])

  const eventsByDay = useMemo(() => buildEvents(items), [items])
  const scheduledCount = items.filter((item) => item.dueAt || item.publishAt).length

  return (
    <>
      <PageHeader title="Calendar">
        {!loading && (
          <span className="text-xs text-muted-foreground">
            {scheduledCount} scheduled
          </span>
        )}
      </PageHeader>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-semibold tracking-tight">
              {format(visibleMonth, "MMMM yyyy")}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleMonth(startOfMonth(new Date()))}
            >
              Today
            </Button>
            <div className="flex overflow-hidden rounded-lg border bg-card">
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-none border-r"
                aria-label="Previous month"
                onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-none"
                aria-label="Next month"
                onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="min-w-3xl overflow-hidden rounded-xl border bg-card">
              <div className="grid grid-cols-7 border-b bg-muted/40">
                {weekdays.map((weekday) => (
                  <div
                    key={weekday}
                    className="border-r px-2 py-2 text-xs font-medium text-muted-foreground last:border-r-0"
                  >
                    {weekday}
                  </div>
                ))}
              </div>

              {loading ? (
                <CalendarSkeleton days={days} />
              ) : (
                <div className="grid grid-cols-7">
                  {days.map((day, index) => {
                    const key = dateKey(day)
                    const events = eventsByDay.get(key) ?? []
                    const visibleEvents = events.slice(0, 3)
                    const hiddenCount = events.length - visibleEvents.length
                    const lastColumn = index % 7 === 6
                    const lastRow = index >= days.length - 7

                    return (
                      <div
                        key={key}
                        className={cn(
                          "min-h-28 border-r border-b p-2",
                          lastColumn && "border-r-0",
                          lastRow && "border-b-0",
                          !isSameMonth(day, visibleMonth) && "bg-muted/20",
                        )}
                      >
                        <time
                          dateTime={key}
                          className={cn(
                            "flex size-6 items-center justify-center rounded-full text-xs",
                            isToday(day)
                              ? "bg-primary font-medium text-primary-foreground"
                              : isSameMonth(day, visibleMonth)
                                ? "text-foreground"
                                : "text-muted-foreground/60",
                          )}
                        >
                          {format(day, "d")}
                        </time>

                        {visibleEvents.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {visibleEvents.map((event) => (
                              <EventLink key={event.id} event={event} />
                            ))}
                            {hiddenCount > 0 && (
                              <p className="px-2 pt-0.5 text-[11px] text-muted-foreground">
                                +{hiddenCount} more
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {!loading && scheduledCount === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Add a due or publish date from a project’s Details panel to place it on the
              calendar.
            </p>
          )}
        </div>
      </main>
    </>
  )
}
