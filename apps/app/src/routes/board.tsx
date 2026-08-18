import type { ContentItem } from "@blomstr/types"
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { type BoardColumn, useBoard } from "@/hooks/use-board"
import { members } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

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

function Card({ item, overlay }: { item: ContentItem; overlay?: boolean }) {
  const assignees = members.filter((m) => item.assigneeIds.includes(m.id))
  const date = item.publishAt ?? item.dueAt

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors",
        overlay ? "cursor-grabbing shadow-lg" : "cursor-grab hover:border-foreground/20",
      )}
    >
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

function SortableCard({ item }: { item: ContentItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: item.id,
    })

  return (
    <div
      ref={setNodeRef}
      // Translate only — scaling the card would distort its text mid-drag.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("touch-none", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <Card item={item} />
    </div>
  )
}

function Column({ column }: { column: BoardColumn }) {
  // Lets a card be dropped on the empty space below the last one.
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id })

  return (
    <section className="flex w-72 shrink-0 flex-col">
      <header className="flex items-center gap-2 px-1 pb-3">
        <h2 className="text-sm font-medium">{column.stage.name}</h2>
        <span className="text-xs text-muted-foreground">{column.items.length}</span>
      </header>

      <SortableContext
        items={column.items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 rounded-lg transition-colors",
            // Tint off the foreground rather than a surface token, so it stays
            // visible whatever the canvas underneath resolves to.
            isOver && "bg-foreground/5",
          )}
        >
          {column.items.map((item) => (
            <SortableCard key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>
    </section>
  )
}

export function BoardPage() {
  const { columns, itemsById, moveItem, projectCount } = useBoard()
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeItem = activeId ? itemsById.get(activeId) : undefined

  const sensors = useSensors(
    // A small threshold so a click still reads as a click, not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /** The stage a drop target sits in — a column itself, or a card's column. */
  function stageOf(id: string) {
    const column = columns.find((c) => c.stage.id === id)
    return column ? column.stage.id : itemsById.get(id)?.stageId
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id))
  }

  /** Cross-column moves land as you hover, so the card follows the cursor. */
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return

    const id = String(active.id)
    const item = itemsById.get(id)
    const stageId = stageOf(String(over.id))
    if (!item || !stageId || item.stageId === stageId) return

    const column = columns.find((c) => c.stage.id === stageId)
    if (!column) return

    const overIndex = column.items.findIndex((i) => i.id === over.id)
    moveItem(id, stageId, overIndex === -1 ? column.items.length : overIndex)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return

    const id = String(active.id)
    const stageId = stageOf(String(over.id))
    if (!stageId) return

    const column = columns.find((c) => c.stage.id === stageId)
    if (!column) return

    const ids = column.items.map((i) => i.id)
    const from = ids.indexOf(id)
    const to = ids.indexOf(String(over.id))

    // Reorder within the column: mirror dnd-kit's own shift, then read back
    // where the card ended up. Dropping on empty space appends.
    if (from !== -1 && to !== -1) {
      moveItem(id, stageId, arrayMove(ids, from, to).indexOf(id))
    } else {
      moveItem(id, stageId, to === -1 ? ids.length : to)
    }
  }

  return (
    <>
      <PageHeader title="Projects">
        <span className="text-xs text-muted-foreground">{projectCount} projects</span>
      </PageHeader>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex h-full gap-4">
            {columns.map((column) => (
              <Column key={column.stage.id} column={column} />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeItem ? <Card item={activeItem} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}
