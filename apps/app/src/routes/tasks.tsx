import { formatDistanceToNow } from "date-fns"
import { ArrowUpRight, CircleCheck } from "lucide-react"
import { Link } from "react-router-dom"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useContent } from "@/hooks/use-content"
import { useCurrentMember } from "@/hooks/use-members"
import { approvalLabels, formatDate, typeLabels } from "@/lib/content"

export function TasksPage() {
  const { items, loading } = useContent()
  const { member } = useCurrentMember()
  const assigned = items
    .filter((item) => member && item.assigneeIds.includes(member.id))
    .sort((a, b) => {
      if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt)
      if (a.dueAt) return -1
      if (b.dueAt) return 1
      return b.createdAt.localeCompare(a.createdAt)
    })

  return (
    <>
      <PageHeader title="My Tasks">
        {!loading && (
          <span className="text-xs text-muted-foreground">
            {assigned.length} {assigned.length === 1 ? "item" : "items"}
          </span>
        )}
      </PageHeader>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Your work</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Projects and deliverables assigned to you, including clips and other
              repurposed work.
            </p>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-20 w-full" />
              ))}
            </div>
          ) : assigned.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed text-center">
              <CircleCheck className="mb-3 size-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">Nothing assigned to you</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                When someone assigns you a project or deliverable, it will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              {assigned.map((item) => {
                const parent = item.parentId
                  ? items.find((candidate) => candidate.id === item.parentId)
                  : null
                return (
                  <Link
                    key={item.id}
                    to={`/projects/${item.id}/overview`}
                    className="group flex items-center gap-4 border-b p-4 last:border-b-0 hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      {parent && (
                        <p className="mb-0.5 truncate text-xs text-muted-foreground">
                          {parent.title}
                        </p>
                      )}
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {item.type && <span>{typeLabels[item.type]}</span>}
                        <Badge
                          variant="secondary"
                          className="h-5 text-[10px] font-normal"
                        >
                          {approvalLabels[item.approvalState]}
                        </Badge>
                        {item.dueAt && (
                          <span
                            title={formatDistanceToNow(new Date(item.dueAt), {
                              addSuffix: true,
                            })}
                          >
                            Due {formatDate(item.dueAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
