import type { ContentItem } from "@blomstr/types"
import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  type AnimateLayoutChanges,
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
import { useMembers } from "@/hooks/use-members"
import { formatDate, initials, publishLabel, typeLabels } from "@/lib/content"
import { cn } from "@/lib/utils"
import { BoardSkeleton } from "@/routes/board-skeleton"

function Card({ item, overlay }: { item: ContentItem; overlay?: boolean }) {
  const { members } = useMembers()
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

      {/*
        Dropped entirely when there is nobody assigned and no date, rather than
        rendering an empty row — a new project has neither, and the row was
        leaving 12px of blank space under every card.
      */}
      {(assignees.length > 0 || date) && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {assignees.map((m) => (
              <Avatar key={m.id} className="size-6 border-2 border-card">
                <AvatarFallback className="text-[10px]">
                  {initials(m.name)}
                </AvatarFallback>
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
      )}
    </article>
  )
}

/*
  Cards that are sorting, or were just dropped, do not animate into place.

  The source card keeps dnd-kit's drag offset while it is hidden. The moment it
  becomes visible again on release, that offset is still unwinding — so the
  card appears mid-flight and sails in from wherever the cursor was. Suppressing
  the layout animation lands it where it belongs, immediately.
*/
const noFlightOnDrop: AnimateLayoutChanges = ({ isSorting, wasDragging }) =>
  !(isSorting || wasDragging)

function SortableCard({ item }: { item: ContentItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: item.id,
      animateLayoutChanges: noFlightOnDrop,
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
      /*
        The card being dragged gets no transform at all — it is invisible, and a
        DragOverlay copy is doing the moving. Applying one left a stale offset
        on it for a frame after release, so the card flashed in from the side
        before settling.

        Translate only for the rest, never Transform: scaling would distort the
        text as cards shift.
      */
      style={
        isDragging
          ? undefined
          : { transform: CSS.Translate.toString(transform), transition }
      }
      /*
        Fully hidden while dragging, not faded.

        A DragOverlay copy already follows the cursor, so the original is only
        holding its space in the layout. At 40% it stayed visible — and since a
        card is often just a title, it read as loose text in the corner of the
        column, especially against the drop tint. It also reappears in its old
        slot whenever the sort preview loses its anchor over empty space.

        Invisible still reserves the gap, which is the part that matters.
      */
      className={cn("relative touch-none", isDragging && "opacity-0")}
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
  activeId,
}: {
  column: BoardColumn
  composing: boolean
  onCompose: () => void
  onCloseCompose: () => void
  showFirstProject: boolean
  activeId: string | null
}) {
  // Lets a card be dropped on the empty space below the last one.
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id })

  /*
    Empty apart from the card being dragged.

    A plain length check does not work: cross-column moves commit on hover, so
    the moment you drag into an empty column the card is already in it and the
    column stops looking empty — the tint would vanish exactly when it is
    needed.
  */
  const emptyIgnoringDragged = column.items.every((i) => i.id === activeId)

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

              Only when the column is otherwise empty. With cards in it the gap
              that opens between them already shows the landing spot, and
              tinting as well means the whole column lights up whenever the
              pointer is anywhere inside — which is most of a drag.
            */
            isOver && emptyIgnoringDragged && "bg-foreground/[0.04]",
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

/**
 * Whatever the pointer is inside wins; otherwise fall back to overlap.
 *
 * `closestCorners` alone ranks targets by distance to their corners, which
 * suits cards — small rects, corners always near the cursor — but punishes an
 * empty column. Hovering the middle of a tall empty column puts its corners
 * hundreds of pixels away, so it loses to a card in the neighbouring column
 * and the drop refuses to register.
 *
 * `pointerWithin` has no such bias: inside is inside. `rectIntersection` picks
 * up the gaps between droppables, where the pointer is inside nothing.
 */
const boardCollisionDetection: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args)
  return withinPointer.length > 0 ? withinPointer : rectIntersection(args)
}

/**
 * The board as it should look with `activeId` dropped on `overId`.
 *
 * Pure, and returns the same array when nothing would change, so hovering
 * within one slot does not re-render.
 */
function arrange(
  columns: BoardColumn[],
  activeId: string,
  overId: string,
): BoardColumn[] {
  const fromIndex = columns.findIndex((c) => c.items.some((i) => i.id === activeId))
  if (fromIndex === -1) return columns

  // `overId` is either a column, when hovering the space below the cards, or a card.
  const overColumnIndex = columns.findIndex((c) => c.stage.id === overId)
  const toIndex =
    overColumnIndex !== -1
      ? overColumnIndex
      : columns.findIndex((c) => c.items.some((i) => i.id === overId))
  if (toIndex === -1) return columns

  const from = columns[fromIndex]
  const to = columns[toIndex]
  if (!from || !to) return columns

  const activeIndex = from.items.findIndex((i) => i.id === activeId)
  const active = from.items[activeIndex]
  if (!active) return columns

  if (fromIndex === toIndex) {
    const overIndex =
      overColumnIndex !== -1
        ? to.items.length - 1
        : to.items.findIndex((i) => i.id === overId)
    if (overIndex === -1 || overIndex === activeIndex) return columns

    const next = [...columns]
    next[fromIndex] = { ...from, items: arrayMove(from.items, activeIndex, overIndex) }
    return next
  }

  const insertAt =
    overColumnIndex !== -1 ? to.items.length : to.items.findIndex((i) => i.id === overId)
  const at = insertAt === -1 ? to.items.length : insertAt

  const next = [...columns]
  next[fromIndex] = { ...from, items: from.items.filter((i) => i.id !== activeId) }
  next[toIndex] = {
    ...to,
    items: [
      ...to.items.slice(0, at),
      { ...active, stageId: to.stage.id },
      ...to.items.slice(at),
    ],
  }
  return next
}

export function BoardPage() {
  const { columns, itemsById, projectCount, loading } = useBoard()
  const { previewMove, commitMove } = useContent()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [composingStageId, setComposingStageId] = useState<string | null>(null)
  const activeItem = activeId ? itemsById.get(activeId) : undefined

  /*
    While a drag is in flight the board renders from plain React state, not
    from the query cache.

    dnd-kit schedules its own renders; the query cache notifies through an
    observer that schedules another. Two stores ticking independently is why
    cards double-shifted mid-drag and showed a frame of the old order on
    release. Local state is updated in the same batch as dnd-kit's, so the two
    can never disagree.

    The cache stays the source of truth everywhere else. This exists for the
    two seconds a card is in the air.
  */
  const [dragColumns, setDragColumns] = useState<BoardColumn[] | null>(null)
  // Mirrored so drag end reads the latest arrangement even if the last
  // dragover has not re-rendered yet.
  const dragColumnsRef = useRef<BoardColumn[] | null>(null)

  function setDrag(next: BoardColumn[] | null) {
    dragColumnsRef.current = next
    setDragColumns(next)
  }

  const view = dragColumns ?? columns

  /*
    An empty board gets one invitation, in the first stage, rather than a
    placeholder in every column — four of them reads as something failing to
    load. Work starts in the leftmost stage, so that is where the prompt goes.

    Gated on `loading`, because an unresolved query and an empty workspace look
    identical: zero items. Without it, every refresh flashes "create your first
    project" before the real cards arrive.
  */
  const boardIsEmpty = !loading && projectCount === 0
  const firstStageId = columns[0]?.stage.id

  const sensors = useSensors(
    // A small threshold so a click still reads as a click, not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id))
    // Take a snapshot to reorder against for the duration of the drag.
    setDrag(columns)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const current = dragColumnsRef.current ?? columns
    setDrag(arrange(current, String(active.id), String(over.id)))
  }

  /*
    The arrangement on screen is already correct, so this only writes it down
    and hands rendering back to the cache.

    `previewMove` patches the cache synchronously, so the committed data
    matches the local arrangement in the same render that clears it — no frame
    where the two disagree.
  */
  function handleDragEnd({ active }: DragEndEvent) {
    const id = String(active.id)
    const arranged = dragColumnsRef.current

    setActiveId(null)

    if (arranged) {
      const column = arranged.find((c) => c.items.some((i) => i.id === id))
      if (column) {
        previewMove(
          id,
          column.stage.id,
          column.items.findIndex((i) => i.id === id),
        )
        commitMove(id)
      }
    }

    setDrag(null)
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Projects" />
        <BoardSkeleton columns={columns} />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Projects">
        <span className="text-xs text-muted-foreground">{projectCount} projects</span>
      </PageHeader>

      <DndContext
        sensors={sensors}
        collisionDetection={boardCollisionDetection}
        /*
          Re-measure the columns continuously instead of once at drag start.

          Cards are different heights — a card with a badge and a date is taller
          than a bare title — and every card that shifts out of the way
          invalidates the rectangles dnd-kit measured up front. Dragging upward
          mostly survives that; dragging downward accumulates the error, because
          everything you pass has already moved.
        */
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null)
          // Nothing was written, so dropping the snapshot restores the board.
          setDrag(null)
        }}
      >
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex h-full gap-4">
            {view.map((column) => (
              <Column
                key={column.stage.id}
                column={column}
                composing={composingStageId === column.stage.id}
                onCompose={() => setComposingStageId(column.stage.id)}
                onCloseCompose={() => setComposingStageId(null)}
                showFirstProject={boardIsEmpty && column.stage.id === firstStageId}
                activeId={activeId}
              />
            ))}
          </div>
        </div>

        {/*
          No drop animation.

          The overlay animates back to wherever the source element sits at the
          moment of release — which is its old slot, because the reorder has not
          rendered yet. So the card flew to the wrong place and then jumped.

          The overlay cannot know the final position, so it disappears instead
          and the card is simply where you put it.
        */}
        <DragOverlay dropAnimation={null}>
          {activeItem ? <Card item={activeItem} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}
