import type { ContentItem } from "@blomstr/types"
import { formatDistanceToNow, startOfToday } from "date-fns"
import { ArrowUpRight, Check, Clock3, Eye, MessageSquareReply } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { PageHeader } from "@/components/layout/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useContent } from "@/hooks/use-content"
import { type HomeActivity, useHomeFeed } from "@/hooks/use-home"
import { useCurrentMember } from "@/hooks/use-members"
import { useStages } from "@/hooks/use-stages"
import { useWorkspace } from "@/hooks/use-workspace"
import { activityText } from "@/lib/activity"
import { formatDate, initials } from "@/lib/content"

interface AttentionItem {
  id: string
  project: ContentItem
  title: string
  detail: string
  to: string
  icon: typeof Eye
  tone: "review" | "changes" | "overdue"
}

function buildAttention(
  items: ContentItem[],
  versions: ReturnType<typeof useHomeFeed>["versions"],
  member: ReturnType<typeof useCurrentMember>["member"],
) {
  const result: AttentionItem[] = []
  const includedProjects = new Set<string>()
  const canApprove = member?.role === "owner" || member?.role === "admin"
  const isEditor = member?.role === "editor"

  for (const version of versions) {
    const project = items.find((item) => item.id === version.contentItemId)
    if (!project || includedProjects.has(project.id)) continue

    if (canApprove && version.state === "in_review") {
      result.push({
        id: `review-${version.id}`,
        project,
        title: `V${version.number} is ready for review`,
        detail: formatDistanceToNow(new Date(version.createdAt), { addSuffix: true }),
        to: `/projects/${project.id}/review`,
        icon: Eye,
        tone: "review",
      })
      includedProjects.add(project.id)
    } else if (
      isEditor &&
      version.state === "changes_requested" &&
      (version.createdBy === member.id || project.assigneeIds.includes(member.id))
    ) {
      result.push({
        id: `changes-${version.id}`,
        project,
        title: `Changes requested on V${version.number}`,
        detail: "Open the review to see the feedback",
        to: `/projects/${project.id}/review`,
        icon: MessageSquareReply,
        tone: "changes",
      })
      includedProjects.add(project.id)
    }
  }

  const today = startOfToday().getTime()
  const overdue = items
    .filter(
      (item) =>
        item.parentId === null &&
        item.dueAt &&
        new Date(item.dueAt).getTime() < today &&
        item.approvalState !== "approved" &&
        !includedProjects.has(item.id) &&
        (!isEditor || item.assigneeIds.includes(member.id)),
    )
    .sort((a, b) => new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime())

  for (const project of overdue) {
    result.push({
      id: `overdue-${project.id}`,
      project,
      title: "Deadline passed",
      detail: `Due ${formatDate(project.dueAt ?? "")}`,
      to: `/projects/${project.id}/overview`,
      icon: Clock3,
      tone: "overdue",
    })
  }

  return result.slice(0, 6)
}

function Panel({
  title,
  description,
  children,
  className = "",
}: {
  title: string
  description: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`home-panel ${className}`}>
      <header className="home-panel-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </section>
  )
}

function HomeSkeleton() {
  return (
    <div className="home-shell">
      <div className="home-intro">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-9 w-36" />
      </div>
      <div className="home-grid">
        {[0, 1, 2].map((panel) => (
          <div
            key={panel}
            className={`home-panel ${panel === 0 ? "home-attention" : ""}`}
          >
            <div className="home-panel-header">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-2 h-3 w-48" />
            </div>
            {[0, 1, 2].map((row) => (
              <div key={row} className="home-skeleton-row">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function ActivityRow({
  entry,
  stageNames,
}: {
  entry: HomeActivity
  stageNames: Map<string, string>
}) {
  const body = (
    <>
      <Avatar className="home-activity-avatar">
        <AvatarFallback>{initials(entry.actorName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="home-activity-copy">
          <span>{entry.actorName}</span> {activityText(entry, stageNames)}
        </p>
        <p className="home-row-meta">
          {entry.contentItemTitle && `${entry.contentItemTitle} · `}
          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
        </p>
      </div>
      {entry.contentItemId && <ArrowUpRight className="home-row-arrow" />}
    </>
  )

  return (
    <li>
      {entry.contentItemId ? (
        <Link
          to={`/projects/${entry.contentItemId}/overview`}
          className="home-activity-row"
        >
          {body}
        </Link>
      ) : (
        <div className="home-activity-row">{body}</div>
      )}
    </li>
  )
}

export function HomePage() {
  const { workspace } = useWorkspace()
  const { items, loading: contentLoading } = useContent()
  const currentMember = useCurrentMember()
  const { stages } = useStages()
  const { versions, activity, loading: feedLoading, error } = useHomeFeed()

  const attention = buildAttention(items, versions, currentMember.member)
  const now = startOfToday().getTime()
  const upcoming = items
    .filter((item) => item.parentId === null && item.dueAt)
    .map((item) => ({ item, date: new Date(item.dueAt ?? "") }))
    .filter(({ date }) => date.getTime() >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6)
  const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]))

  return (
    <>
      <PageHeader title="Home" />
      <main className="home-scroll">
        {contentLoading || feedLoading ? (
          <HomeSkeleton />
        ) : (
          <div className="home-shell">
            <header className="home-intro">
              <p className="home-date">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <h1>Today</h1>
              <p>A clear view of what is moving across {workspace?.name}.</p>
            </header>

            {error ? (
              <div className="home-error">
                Home could not load. Refresh the page to try again.
              </div>
            ) : (
              <div className="home-grid">
                <Panel
                  title="Needs attention"
                  description="Reviews and deadlines that should not wait."
                  className="home-attention"
                >
                  {attention.length === 0 ? (
                    <div className="home-caught-up">
                      <span className="home-caught-up-icon">
                        <Check />
                      </span>
                      <div>
                        <p>You're caught up</p>
                        <span>Nothing needs your attention right now.</span>
                      </div>
                    </div>
                  ) : (
                    <ul className="home-list">
                      {attention.map((entry) => {
                        const Icon = entry.icon
                        return (
                          <li key={entry.id}>
                            <Link to={entry.to} className="home-attention-row">
                              <span
                                className="home-attention-icon"
                                data-tone={entry.tone}
                              >
                                <Icon />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="home-row-title">{entry.project.title}</p>
                                <p className="home-row-meta">
                                  {entry.title} · {entry.detail}
                                </p>
                              </div>
                              <ArrowUpRight className="home-row-arrow" />
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Panel>

                <Panel title="Upcoming" description="The next dates on the calendar.">
                  {upcoming.length === 0 ? (
                    <p className="home-panel-empty">No upcoming deadlines.</p>
                  ) : (
                    <ul className="home-list">
                      {upcoming.map(({ item, date }) => (
                        <li key={item.id}>
                          <Link
                            to={`/projects/${item.id}/overview`}
                            className="home-upcoming-row"
                          >
                            <time className="home-date-tile" dateTime={item.dueAt ?? ""}>
                              <span>
                                {date.toLocaleDateString(undefined, { month: "short" })}
                              </span>
                              {date.getDate()}
                            </time>
                            <div className="min-w-0 flex-1">
                              <p className="home-row-title">{item.title}</p>
                              <p className="home-row-meta">
                                {stageNames.get(item.stageId) ?? "Project"}
                              </p>
                            </div>
                            {item.approvalState === "in_review" && (
                              <Badge variant="secondary" className="font-normal">
                                In review
                              </Badge>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel
                  title="Recent activity"
                  description="The latest movement from the team."
                >
                  {activity.length === 0 ? (
                    <p className="home-panel-empty">No recent activity.</p>
                  ) : (
                    <ul className="home-list">
                      {activity.slice(0, 7).map((entry) => (
                        <ActivityRow
                          key={entry.id}
                          entry={entry}
                          stageNames={stageNames}
                        />
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}
