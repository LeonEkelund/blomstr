import type { ContentItem } from "@blomstr/types"
import { PageHeader } from "@/components/layout/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { contentItems, members, stages } from "@/lib/mock-data"

const typeLabels: Record<ContentItem["type"], string> = {
  youtube_video: "YouTube",
  short: "Short",
  tiktok: "TikTok",
  reel: "Reel",
  instagram_post: "Instagram",
  podcast: "Podcast",
  livestream: "Live",
  newsletter: "Newsletter",
  thumbnail: "Thumbnail",
  sponsored: "Sponsored",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

function Card({ item }: { item: ContentItem }) {
  const assignees = members.filter((m) => item.assigneeIds.includes(m.id))
  const date = item.publishAt ?? item.dueAt

  return (
    <article className="cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20">
      <h3 className="text-sm leading-snug font-medium">{item.title}</h3>

      <div className="mt-2 flex items-center gap-1.5">
        <Badge variant="secondary" className="text-[11px] font-normal">
          {typeLabels[item.type]}
        </Badge>
        {item.approvalState === "in_review" && (
          <Badge className="text-[11px] font-normal">In review</Badge>
        )}
        {item.approvalState === "changes_requested" && (
          <Badge variant="destructive" className="text-[11px] font-normal">
            Changes
          </Badge>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {assignees.map((m) => (
            <Avatar key={m.id} className="size-6 border-2 border-card">
              <AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        {date && (
          <span className="text-xs text-muted-foreground">
            {item.publishAt ? "Publishes " : ""}
            {formatDate(date)}
          </span>
        )}
      </div>
    </article>
  )
}

function Column({ stageId, name }: { stageId: string; name: string }) {
  const items = contentItems
    .filter((i) => i.parentId === null && i.stageId === stageId)
    .sort((a, b) => a.position.localeCompare(b.position))

  return (
    <section className="flex w-72 shrink-0 flex-col">
      <header className="flex items-center gap-2 px-1 pb-3">
        <h2 className="text-sm font-medium">{name}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </header>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Card key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

export function BoardPage() {
  return (
    <>
      <PageHeader title="Projects">
        <span className="text-xs text-muted-foreground">
          {contentItems.filter((i) => i.parentId === null).length} projects
        </span>
      </PageHeader>

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex h-full gap-4">
          {[...stages]
            .sort((a, b) => a.position - b.position)
            .map((stage) => (
              <Column key={stage.id} stageId={stage.id} name={stage.name} />
            ))}
        </div>
      </div>
    </>
  )
}
