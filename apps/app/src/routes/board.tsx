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
import { Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { PageHeader } from "@/components/layout/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { type BoardColumn, useBoard } from "@/hooks/use-board"
import { useContent } from "@/hooks/use-content"
import { formatDate, initials, publishLabel, typeLabels } from "@/lib/content"
import { members } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

function Card({ item, overlay }: { item: ContentItem; overlay?: boolean }) {
  const assignees = members.filter((m) => item.assigneeIds.includes(m.id))
  const date = item.publishAt ?? item.dueAt
  const dateLabel = publishLabel(item.publishAt)

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors",
        overlay ? "cursor-grabbing shadow-lg" : "cursor-grab hover:border-foreground/20",
      )}
    >
      <h3 className="text-sm leading-snug font-medium">{item.title}</h3>

      <div className="mt-2 flex items-center gap-1.5 empty:mt-0">
        {item.type && (
          <Badge variant="secondary" className="text-[11px] font-normal">
            {typeLabels[item.type]}
          </Badge>
        )}
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
            {dateLabel}
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

  // A drag ends with a click on the card, which would navigate away the moment
  // you drop something. Remember that a drag happened and swallow that click.
  const dragged = useRef(false)
  useEffect(() => {
    if (isDragging) dragged.current = true
  }, [isDragging])

  return (
    <div
      ref={setNodeRef}
      // Translate only — scaling the card would distort its text mid-drag.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative touch-none", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <Card item={item} />
      {/*
        A real link rather than a click handler on the wrapper: dnd-kit already
        owns Enter and Space there for lifting the card, so the navigation needs
        its own focusable target to stay keyboard-reachable. `draggable={false}`
        stops the browser's native link dragging from fighting the sensor.
      */}
      <Link
        to={`/projects/${item.id}`}
        aria-label={item.title}
        draggable={false}
        onClick={(event) => {
          // A drag finishes with a click. Swallow that one, or dropping a card
          // would navigate away from the board.
          if (dragged.current) {
            dragged.current = false
            event.preventDefault()
          }
        }}
        className="absolute inset-0 rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
      />
    </div>
  )
}

/**
 * Inline composer rather than a dialog: adding a project is a one-field
 * action, and a modal for one field breaks the flow of looking at the board.
 * Shaped like a card so the column never changes height as it opens.
 */
function Composer({ stageId, onClose }: { stageId: string; onClose: () => void }) {
  const { createItem } = useContent()
  const [title, setTitle] = useState("")

  function commit() {
    if (title.trim()) createItem(stageId, title)
    onClose()
  }

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <textarea
        // biome-ignore lint/a11y/noAutofocus: opened by an explicit user action
        autoFocus
        rows={2}
        value={title}
        placeholder="Project title"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Enter commits; Shift+Enter would be a newline, which a title
          // never needs. Escape abandons without creating anything.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            commit()
          }
          if (e.key === "Escape") {
            setTitle("")
            onClose()
          }
        }}
        className="w-full resize-none bg-transparent text-sm leading-snug font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground"
      />
    </div>
  )
}

/** Same shape as a real card, so an empty board reads as ready rather than broken. */
function FirstProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col items-start rounded-lg border bg-card p-3 text-left transition-colors hover:border-foreground/20"
    >
      {/*
        Icon inline with the label rather than boxed above it — a tinted square
        reads as a badge, and this is an action.
      */}
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Plus
          strokeWidth={1.5}
          className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
        />
        Create your first project
      </span>
      <span className="mt-1 text-xs text-muted-foreground">
        Everything it becomes lives inside it.
      </span>
    </button>
  )
}

function Column({
  column,
  composing,
  onCompose,
  onCloseCompose,
  showFirstProject,
}: {
  column: BoardColumn
  composing: boolean
  onCompose: () => void
  onCloseCompose: () => void
  showFirstProject: boolean
}) {
  // Lets a card be dropped on the empty space below the last one.
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id })

  return (
    <section className="flex w-72 shrink-0 flex-col">
      <header className="flex items-center gap-2 px-1 pb-3">
        <h2 className="text-sm font-medium">{column.stage.name}</h2>
        <span className="text-xs text-muted-foreground">{column.items.length}</span>
        {/*
          Always visible rather than revealed on hover — a hover-only control
          is invisible on touch and easy to miss on a first visit.
        */}
        <button
          type="button"
          onClick={onCompose}
          aria-label={`Add a project to ${column.stage.name}`}
          className="-mr-1 ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Plus strokeWidth={1.5} className="size-4" />
        </button>
      </header>

      <SortableContext
        items={column.items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 rounded-xl transition-colors duration-150",
            /*
              A soft fill rather than a dashed outline: the card casts a shadow
              where it will land instead of being drawn a box to sit in.
              Tinted off the foreground so it holds up on either canvas.
            */
            isOver && "bg-foreground/[0.04]",
          )}
        >
          {column.items.map((item) => (
            <SortableCard key={item.id} item={item} />
          ))}
          {composing && <Composer stageId={column.stage.id} onClose={onCloseCompose} />}
          {showFirstProject && !composing && <FirstProjectCard onClick={onCompose} />}
        </div>
      </SortableContext>
    </section>
  )
}

export function BoardPage() {
  const { columns, itemsById, moveItem, projectCount } = useBoard()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [composingStageId, setComposingStageId] = useState<string | null>(null)
  const activeItem = activeId ? itemsById.get(activeId) : undefined

  /*
    An empty board gets one invitation, in the first stage, rather than a
    placeholder in every column — four of them reads as something failing to
    load. Work starts in the leftmost stage, so that is where the prompt goes.
  */
  const boardIsEmpty = projectCount === 0
  const firstStageId = columns[0]?.stage.id

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
              <Column
                key={column.stage.id}
                column={column}
                composing={composingStageId === column.stage.id}
                onCompose={() => setComposingStageId(column.stage.id)}
                onCloseCompose={() => setComposingStageId(null)}
                showFirstProject={boardIsEmpty && column.stage.id === firstStageId}
              />
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
