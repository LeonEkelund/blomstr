import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine"
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element"
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import type { ContentItem, Member } from "@blomstr/types"
import { Plus } from "lucide-react"
import { memo, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PageHeader } from "@/components/layout/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { type BoardColumn, useBoard } from "@/hooks/use-board"
import { useContent } from "@/hooks/use-content"
import { useMembers } from "@/hooks/use-members"
import { formatDate, initials, publishLabel, typeLabels } from "@/lib/content"
import { cn } from "@/lib/utils"
import { BoardSkeleton } from "@/routes/board-skeleton"

/*
  The drag layer is the browser's own, driven by Pragmatic drag and drop.

  Nothing here holds the card in a parallel layout while it moves — the browser
  owns the drag, and React only renders the indicator line and the final
  reorder. That is the point: a re-render mid-drag cannot desynchronise
  anything, because there is nothing to desynchronise.
*/

/** What a card puts on the wire while being dragged, and as a drop target. */
type CardData = { type: "card"; itemId: string; stageId: string }
type ColumnData = { type: "column"; stageId: string }

function isCardData(data: Record<string | symbol, unknown>): data is CardData {
  return data.type === "card"
}

function isColumnData(data: Record<string | symbol, unknown>): data is ColumnData {
  return data.type === "column"
}

/*
  Members are passed in rather than read from a hook here: every card
  subscribing to the same query meant one state change re-rendered and
  re-subscribed all of them at once.
*/
const Card = memo(function Card({
  item,
  members,
}: {
  item: ContentItem
  members: Member[]
}) {
  const assignees = members.filter((m) => item.assigneeIds.includes(m.id))
  const date = item.publishAt ?? item.dueAt
  const dateLabel = publishLabel(item.publishAt)

  return (
    <article className="rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20">
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
})

/**
 * Where the card will land.
 *
 * Sits in the 8px gap between cards, so showing it never changes the layout —
 * which is what stops the list twitching as you move across it.
 *
 * Full-strength `primary` rather than a faint tint, with a terminal dot that
 * sits outside the card's edge: the drag preview follows the cursor and covers
 * whatever is under it, so the indicator has to be readable from the part that
 * is not obscured.
 */
function DropLine({ edge, active }: { edge: Edge; active: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-primary",
        /*
          Always mounted, only faded.

          Crossing from one card to the next swaps which card owns the
          indicator. Mounting and unmounting two separate elements left a frame
          with neither on screen — the blink. Both exist at all times and cross-
          fade in the same pixel instead.

          The fade out is slower than the fade in on purpose: the incoming line
          is already at full strength before the outgoing one has gone, so
          there is no moment where the gap looks empty.
        */
        active ? "opacity-100 duration-0" : "opacity-0 duration-150",
        "transition-opacity",
        /*
          Drawn on the boundary between two cards, not inside the padding of
          whichever one the pointer happens to be in.

          The lower half of one card's box and the upper half of the next mean
          the same thing — "between these two" — so drawing them 4px apart made
          the line hop as you crossed from one to the other. The boxes are
          flush, so a line centred on the shared edge lands in the same pixel
          either way.
        */
        edge === "top" ? "-top-px" : "-bottom-px",
      )}
    >
      <span className="absolute top-1/2 -left-1 size-2 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
    </div>
  )
}

function DraggableCard({ item, members }: { item: ContentItem; members: Member[] }) {
  /*
    Two elements, deliberately.

    The drop target is the outer box, which carries the padding that makes the
    gap between cards — so the drop targets tile with nothing between them.
    When the gap belonged to the column instead, holding a card in it left the
    column as the only target, the indicator vanished, and the drop appended to
    the bottom.

    The draggable is the inner card, so the picture the browser drags is the
    card itself rather than the card plus empty space.
  */
  const outerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [edge, setEdge] = useState<Edge | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const outer = outerRef.current
    const card = cardRef.current
    if (!outer || !card) return

    const data: CardData = { type: "card", itemId: item.id, stageId: item.stageId }

    return combine(
      draggable({
        element: card,
        getInitialData: () => ({ ...data }),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: outer,
        // A card is not a drop target for itself.
        canDrop: ({ source }) =>
          isCardData(source.data) && source.data.itemId !== item.id,
        // Without this the browser shows a + and calls it a copy.
        getDropEffect: () => "move",
        /*
          Which half of the card the pointer is in decides whether the drop
          lands above or below it. That is the whole reordering model — no
          index maths while dragging, just an edge.
        */
        getData: ({ input, element: target }) =>
          attachClosestEdge(
            { ...data },
            { input, element: target, allowedEdges: ["top", "bottom"] },
          ),
        onDrag: ({ self }) => setEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setEdge(null),
        onDrop: () => setEdge(null),
      }),
    )
  }, [item.id, item.stageId])

  return (
    // py-1 rather than a gap on the column: the padding belongs to the card,
    // so there is no strip of column between two cards to lose the pointer in.
    <div ref={outerRef} className="relative py-1">
      <DropLine edge="top" active={edge === "top"} />
      <DropLine edge="bottom" active={edge === "bottom"} />
      {/*
        The card is its own drag handle and its own link.

        A real <a> would let the browser start a native link drag instead of
        ours, so this is a div with an explicit role. Enter opens the project;
        the drag is pointer-driven and does not claim any key.
      */}
      {/* biome-ignore lint/a11y/useSemanticElements: a button may only contain phrasing content, and the card is an article with a heading */}
      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/projects/${item.id}`)}
        onKeyDown={(event) => {
          if (event.key === "Enter") navigate(`/projects/${item.id}`)
        }}
        className={cn(
          "cursor-grab rounded-lg outline-offset-2 transition-opacity focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing",
          // Faded, not hidden: the browser drags a picture of the card, and
          // the original staying in place is what keeps the column steady.
          dragging && "opacity-40",
        )}
      >
        <Card item={item} members={members} />
      </div>
    </div>
  )
}

/**
 * Inline composer rather than a dialog: adding a project is a one-field
 * action, and a modal for one field breaks the flow of looking at the board.
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
  members,
  composing,
  onCompose,
  onCloseCompose,
  showFirstProject,
}: {
  column: BoardColumn
  members: Member[]
  composing: boolean
  onCompose: () => void
  onCloseCompose: () => void
  showFirstProject: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [isOver, setIsOver] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const data: ColumnData = { type: "column", stageId: column.stage.id }

    return combine(
      dropTargetForElements({
        element,
        canDrop: ({ source }) => isCardData(source.data),
        getDropEffect: () => "move",
        getData: () => ({ ...data }),
        /*
          Tinted only when the card comes from somewhere else.

          Changing column is the consequential move — the project's stage
          changes — so it gets the whole column as feedback. Reordering inside
          a column does not, since the indicator line already says everything
          and lighting up the column you are already in is just noise.
        */
        onDragEnter: ({ source }) => {
          if (isCardData(source.data)) {
            setIsOver(source.data.stageId !== column.stage.id)
          }
        },
        onDragLeave: () => setIsOver(false),
        onDrop: () => setIsOver(false),
      }),
      // Scrolls a long column while you hold a card near its edge.
      autoScrollForElements({ element }),
    )
  }, [column.stage.id])

  return (
    <section className="flex w-[calc(100vw-2rem)] shrink-0 snap-center flex-col sm:w-72 sm:snap-start">
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

      <div
        ref={ref}
        className={cn(
          // No gap: each card carries its own padding so the drop targets tile.
          "flex min-h-24 flex-1 flex-col rounded-xl transition-colors duration-150",
          // A soft fill rather than a dashed outline. See onDragEnter above for
          // why this is only ever a card arriving from another column.
          isOver && "bg-foreground/[0.04]",
        )}
      >
        {column.items.map((item) => (
          <DraggableCard key={item.id} item={item} members={members} />
        ))}

        {/* Matching the cards' own padding, now that the column has no gap. */}
        {composing && (
          <div className="py-1">
            <Composer stageId={column.stage.id} onClose={onCloseCompose} />
          </div>
        )}
        {showFirstProject && !composing && (
          <div className="py-1">
            <FirstProjectCard onClick={onCompose} />
          </div>
        )}
      </div>
    </section>
  )
}

export function BoardPage() {
  const { columns, projectCount, loading } = useBoard()
  const { moveItem } = useContent()
  // One subscription for the whole board, handed down to the cards.
  const { members } = useMembers()
  const [composingStageId, setComposingStageId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  /*
    An empty board gets one invitation, in the first stage, rather than a
    placeholder in every column — four of them reads as something failing to
    load. Work starts in the leftmost stage, so that is where the prompt goes.

    Gated on `loading`, because an unresolved query and an empty workspace look
    identical: zero items.
  */
  const boardIsEmpty = !loading && projectCount === 0
  const firstStageId = columns[0]?.stage.id

  /*
    One listener for the whole board, rather than a handler per card.

    Runs once on drop and translates "above that card" or "in that column" into
    the index a rank needs. Nothing is written while dragging.
  */
  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => isCardData(source.data),
        onDrop({ source, location }) {
          const targets = location.current.dropTargets
          if (targets.length === 0 || !isCardData(source.data)) return

          const itemId = source.data.itemId
          const overCard = targets.find((t) => isCardData(t.data))
          const overColumn = targets.find((t) => isColumnData(t.data))

          if (overCard && isCardData(overCard.data)) {
            const stageId = overCard.data.stageId
            const column = columns.find((c) => c.stage.id === stageId)
            if (!column) return

            /*
              Indices are resolved against the column *without* the dragged
              card, which is what the rank helper expects — and it makes moving
              within a column and moving between them the same calculation.
            */
            const without = column.items.filter((i) => i.id !== itemId)
            const overIndex = without.findIndex(
              (i) => isCardData(overCard.data) && i.id === overCard.data.itemId,
            )
            if (overIndex === -1) return

            const edge = extractClosestEdge(overCard.data)
            moveItem(itemId, stageId, edge === "bottom" ? overIndex + 1 : overIndex)
            return
          }

          if (overColumn && isColumnData(overColumn.data)) {
            // Dropped on the empty space below the cards: append.
            moveItem(itemId, overColumn.data.stageId, Number.MAX_SAFE_INTEGER)
          }
        },
      }),
    [columns, moveItem],
  )

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    return combine(
      /*
        The whole board is a drop target purely to claim the cursor.

        Native drag and drop draws its own feedback, and the browser decides
        which by asking the thing under the pointer what it would do. Nothing
        answering means "copy", which is the plus sign — so the gaps between
        columns produced one even though cards and columns had already said
        "move". This covers the gaps.

        It never receives a drop: the monitor only acts on card and column
        targets, so releasing here does nothing, which is the right outcome for
        dropping a card on the background.
      */
      dropTargetForElements({
        element,
        canDrop: ({ source }) => isCardData(source.data),
        getDropEffect: () => "move",
      }),
      // Scrolls the board sideways when a card is held near its left or right edge.
      autoScrollForElements({ element }),
    )
  }, [])

  /*
    Claims the cursor for the whole page, not just the board.

    The browser decides which drag cursor to draw by asking whatever is under
    the pointer what it would do with the drop. Anything that does not answer
    means "copy" — the plus. The board answers, but the sidebar, the header and
    the space past the last column do not, so the plus kept flickering back
    whenever the pointer strayed off the columns.

    This cannot remove the cursor: during a native drag the browser owns it and
    CSS cursor rules are ignored. It can only make it consistently the quiet
    one.
  */
  useEffect(
    () =>
      dropTargetForElements({
        element: document.body,
        canDrop: ({ source }) => isCardData(source.data),
        getDropEffect: () => "move",
      }),
    [],
  )

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

      <div
        ref={scrollRef}
        className="flex-1 snap-x snap-mandatory scroll-px-4 overflow-x-auto sm:snap-none sm:p-6"
      >
        <div className="flex h-full gap-3 pl-4 sm:gap-4 sm:pl-0">
          {columns.map((column) => (
            <Column
              key={column.stage.id}
              column={column}
              members={members}
              composing={composingStageId === column.stage.id}
              onCompose={() => setComposingStageId(column.stage.id)}
              onCloseCompose={() => setComposingStageId(null)}
              showFirstProject={boardIsEmpty && column.stage.id === firstStageId}
            />
          ))}
          <div aria-hidden className="w-1 shrink-0 sm:hidden" />
        </div>
      </div>
    </>
  )
}
