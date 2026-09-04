import type { ContentItem } from "@blomstr/types"
import { ArrowRight, CalendarClock, Scissors } from "lucide-react"
import { lazy, Suspense } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { DriveFilesPanel } from "@/components/drive-files-panel"
import { EmptyState } from "@/components/empty-state"
import { ReviewPanel } from "@/components/review-panel"
import { Button } from "@/components/ui/button"
import { useContent } from "@/hooks/use-content"
import { approvalLabels, typeLabels } from "@/lib/content"

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

// Excalidraw is the heaviest tab dependency. Keep it out of the board bundle
// and only download it when someone opens a project's canvas.
const MindmapEditor = lazy(() =>
  import("@/components/mindmap-editor").then((m) => ({
    default: m.MindmapEditor,
  })),
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
  const next = {
    draft: {
      copy: "The work is still taking shape. Add a version when it is ready for feedback.",
      label: "Open review",
      to: "../review",
    },
    in_review: {
      copy: "A version is waiting for a decision. Review it alongside the team's feedback.",
      label: "Review version",
      to: "../review",
    },
    changes_requested: {
      copy: "Changes were requested on the latest version. Open the review to see what needs attention.",
      label: "See requested changes",
      to: "../review",
    },
    approved: {
      copy: "The latest version is approved. The project can move toward publishing.",
      label: "Open publishing",
      to: "../publish",
    },
  }[project.approvalState]

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-16">
      <p className="text-xs font-medium text-muted-foreground">Current status</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">
        {approvalLabels[project.approvalState]}
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
        {next.copy}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-5 w-fit"
        render={<Link to={next.to} relative="path" />}
      >
        {next.label}
        <ArrowRight className="size-3.5" />
      </Button>
    </div>
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
  return <DriveFilesPanel project={useProject()} />
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
    <div className="flex flex-col gap-2 p-4 sm:p-6">
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
  const project = useProject()

  return (
    <Suspense fallback={<div className="mindmap-message">Opening canvas…</div>}>
      <MindmapEditor project={project} />
    </Suspense>
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
