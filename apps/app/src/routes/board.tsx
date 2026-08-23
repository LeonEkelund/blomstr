import type { ContentItem, Member } from "@blomstr/types"
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import { Plus } from "lucide-react"
import { memo, useState } from "react"
import { flushSync } from "react-dom"
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
  Members are passed in rather than read from a hook here.

  Every card subscribing to the same query meant the drop's synchronous state
  update re-rendered and re-subscribed all of them in one frame, which is what
  made releasing a card stutter. One subscription, at the top.
*/
const Card = memo(function Card({
  item,
  members,
  dragging,
}: {
  item: ContentItem
  members: Member[]
  dragging?: boolean
}) {
  const assignees = members.filter((m) => item.assigneeIds.includes(m.id))
  const date = item.publishAt ?? item.dueAt
  const dateLabel = publishLabel(item.publishAt)

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-3 transition-shadow",
        dragging ? "cursor-grabbing shadow-lg" : "cursor-grab hover:border-foreground/20",
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
})

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
  const navigate = useNavigate()

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

      <Droppable droppableId={column.stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-24 flex-1 flex-col gap-2 rounded-xl transition-colors duration-150",
              /*
                A soft fill rather than a dashed outline, and only when the
                column is empty — once there are cards, the placeholder gap
                already shows where the card will land.
              */
              snapshot.isDraggingOver &&
                column.items.length === 0 &&
                "bg-foreground/[0.04]",
            )}
          >
            {column.items.map((item, index) => (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  /*
                    The whole card is the drag handle, and also the click
                    target for opening the project.

                    Not a <Link>: this library refuses to start a drag from an
                    anchor or button, so wrapping the card in one would make it
                    undraggable. It does suppress the click that follows a drag,
                    so navigating on click is safe. Enter is free — space is
                    what lifts a card — so it opens the project for keyboard
                    users.
                  */
                  // biome-ignore lint/a11y/useSemanticElements: a real button cannot be dragged — this library blocks drags that start on interactive elements
                  <div
                    ref={dragProvided.innerRef}
                    role="button"
                    tabIndex={0}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    onClick={() => navigate(`/projects/${item.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") navigate(`/projects/${item.id}`)
                    }}
                    className="rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Card
                      item={item}
                      members={members}
                      dragging={dragSnapshot.isDragging}
                    />
                  </div>
                )}
              </Draggable>
            ))}

            {/* Holds the gap open where the dragged card will land. */}
            {provided.placeholder}

            {composing && <Composer stageId={column.stage.id} onClose={onCloseCompose} />}
            {showFirstProject && !composing && <FirstProjectCard onClick={onCompose} />}
          </div>
        )}
      </Droppable>
    </section>
  )
}

export function BoardPage() {
  const { columns, projectCount, loading } = useBoard()
  const { previewMove, commitMove } = useContent()
  // One subscription for the whole board, handed down to the cards.
  const { members } = useMembers()
  const [composingStageId, setComposingStageId] = useState<string | null>(null)

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

  /*
    One handler, and no preview logic at all — the library owns the shuffle
    while a card is in the air and reports the result once.

    `destination.index` is already the index within the target column *without*
    the moved card, which is exactly what a rank needs, for both reordering and
    moving between columns.
  */
  function handleDragEnd({ draggableId, source, destination }: DropResult) {
    if (!destination) return // cancelled, or dropped outside a column

    const unchanged =
      destination.droppableId === source.droppableId && destination.index === source.index
    if (unchanged) return

    /*
      The reorder has to be on screen before this handler returns.

      hello-pangea finishes its drop animation, calls this, and then releases
      the card back to normal layout. If the new order has not rendered by
      then, the card paints once in its old position — the blink. Writing to
      the query cache is close to synchronous but goes through an observer, so
      React can schedule that render just late enough to show.

      flushSync closes the gap: render now, inside the handler.
    */
    flushSync(() => {
      previewMove(draggableId, destination.droppableId, destination.index)
    })
    commitMove(draggableId)
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

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex h-full gap-4">
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
          </div>
        </div>
      </DragDropContext>
    </>
  )
}
