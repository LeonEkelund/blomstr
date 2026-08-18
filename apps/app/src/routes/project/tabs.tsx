import type { ContentItem } from "@blomstr/types"
import {
  CalendarClock,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MessagesSquare,
  Network,
  Scissors,
} from "lucide-react"
import { useOutletContext } from "react-router-dom"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { useContent } from "@/hooks/use-content"
import { typeLabels } from "@/lib/content"

/** Every tab receives the project from the layout's Outlet context. */
function useProject() {
  return useOutletContext<ContentItem>()
}

/**
 * The landing tab, so it is the same one every time — a default that moves
 * around with the project's state is one you cannot build a habit on.
 *
 * It answers "what is happening and what do I do next", not "what is this
 * project". Attributes belong in the rail; if a widget would fit in both, it
 * belongs in the rail.
 */
export function OverviewTab() {
  return (
    <EmptyState
      icon={LayoutDashboard}
      title="Nothing to summarise yet"
      description="Where this project stands, what it is waiting on, and the last few things that happened — with whatever needs you next surfaced first."
    />
  )
}

export function ReviewTab() {
  return (
    <EmptyState
      icon={MessagesSquare}
      title="Nothing to review yet"
      description="Once a version is uploaded it shows up here with the comment thread, and approval acts on that version."
      action={
        <Button variant="outline" size="sm" disabled>
          Upload a version
        </Button>
      }
    />
  )
}

export function NotesTab() {
  return (
    <EmptyState
      icon={FileText}
      title="No notes yet"
      description="The brief, the hook, reference links — anything the team needs before production starts. The script lives here too, but is versioned and reviewed."
      action={
        <Button variant="outline" size="sm" disabled>
          Add a note
        </Button>
      }
    />
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
          <p className="mt-1 text-xs text-muted-foreground">{typeLabels[child.type]}</p>
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
