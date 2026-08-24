import type { ContentItem } from "@blomstr/types"
import { CalendarClock, FolderOpen, Network, Scissors } from "lucide-react"
import { lazy, Suspense } from "react"
import { useOutletContext } from "react-router-dom"
import { CommentThread } from "@/components/comment-thread"
import { EmptyState } from "@/components/empty-state"
import { ReviewPanel } from "@/components/review-panel"
import { Button } from "@/components/ui/button"
import { useContent } from "@/hooks/use-content"
import { useProjectThread, useReviewActions } from "@/hooks/use-review"
import { typeLabels } from "@/lib/content"

/** Every tab receives the project from the layout's Outlet context. */
function useProject() {
  return useOutletContext<ContentItem>()
}

/*
  Split out of the main bundle: ProseMirror is ~1.1MB raw, and loading it up
  front would make everyone pay for the editor just to look at the board. It
  arrives when someone opens Notes.
*/
const NotesEditor = lazy(() =>
  import("@/components/notes-editor").then((m) => ({ default: m.NotesEditor })),
)

/**
 * The landing tab, so it is the same one every time — a default that moves
 * around with the project's state is one you cannot build a habit on.
 *
 * It answers "what is happening and what do I do next", not "what is this
 * project". Attributes belong in the rail; if a widget would fit in both, it
 * belongs in the rail.
 */
export function OverviewTab() {
  const project = useProject()
  const { comments } = useProjectThread(project.id)
  const { comment } = useReviewActions(project.id)

  /*
    The whole conversation, not a summary.

    Version comments appear here too, tagged with which version they were
    about — so this is the one place to catch up, and the Review tab is a
    focused slice of the same thread rather than a second inbox.

    Status, dates and assignees stay in the rail: this answers "what has been
    said", not "what is this project".
  */
  return (
    <CommentThread
      /*
        Capped and centred rather than filling the tab: a message stretched
        across the full width becomes one long line, and the eye loses the
        start of the next one. Same reason the notes editor has a measure.
      */
      className="mx-auto w-full max-w-2xl flex-1"
      comments={comments}
      pending={comment.isPending}
      placeholder="Add a comment"
      emptyText="Nothing said about this project yet. Anything not tied to a specific version goes here — the brief, a deadline, a change of plan."
      onSend={(body) =>
        comment.mutate({ subject: { type: "content_item", id: project.id }, body })
      }
    />
  )
}

export function ReviewTab() {
  return <ReviewPanel project={useProject()} />
}

/**
 * No empty state here, deliberately.
 *
 * An empty document with a placeholder *is* the empty state, and it is already
 * the thing you came to use — putting an "Add a note" button in front of it
 * would just be a click between you and a cursor.
 */
export function NotesTab() {
  const project = useProject()
  const { updateItem } = useContent()

  return (
    // Fallback is blank rather than a spinner: the chunk resolves in a frame
    // or two on any warm cache, and a spinner that flashes reads as slower
    // than nothing at all.
    <Suspense fallback={null}>
      <NotesEditor
        // Remounts when you navigate between projects, so the editor never
        // carries one project's document into another.
        key={project.id}
        value={project.notes}
        onChange={(notes) => updateItem(project.id, { notes })}
      />
    </Suspense>
  )
}

export function FilesTab() {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No files linked"
      description="Footage stays in Google Drive and is referenced here, so nothing large routes through blomstr. Thumbnails and small assets are stored directly."
      action={
        <Button variant="outline" size="sm" disabled>
          Connect a Drive folder
        </Button>
      }
    />
  )
}

export function RepurposedTab() {
  const project = useProject()
  const { items } = useContent()

  const children = items.filter((i) => i.parentId === project.id)

  if (children.length === 0) {
    return (
      <EmptyState
        icon={Scissors}
        title="Nothing repurposed yet"
        description="Clips, thumbnails, Shorts and posts made from this project appear here — each with its own assignee and its own approval."
        action={
          <Button variant="outline" size="sm" disabled>
            Create a clip
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-2 p-6">
      {children.map((child) => (
        <article key={child.id} className="rounded-lg border bg-card p-3">
          <h3 className="text-sm font-medium">{child.title}</h3>
          {child.type && (
            <p className="mt-1 text-xs text-muted-foreground">{typeLabels[child.type]}</p>
          )}
        </article>
      ))}
    </div>
  )
}

export function MindmapTab() {
  return (
    <EmptyState
      icon={Network}
      title="No mindmap yet"
      description="A canvas for planning this project — sticky notes, arrows, whatever gets the idea out. Scoped to this project, so access follows it."
      action={
        <Button variant="outline" size="sm" disabled>
          Open canvas
        </Button>
      }
    />
  )
}

export function PublishTab() {
  return (
    <EmptyState
      icon={CalendarClock}
      title="Not ready to publish"
      description="Title, description, thumbnail and tags per platform, plus the schedule. Publishing runs through a job queue, so its progress shows here."
      action={
        <Button variant="outline" size="sm" disabled>
          Set a publish date
        </Button>
      }
    />
  )
}
