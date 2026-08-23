import type { ContentItem, Platform } from "@blomstr/types"
import {
  Archive,
  Check,
  ChevronDown,
  MessageSquareReply,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Search,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useContent } from "@/hooks/use-content"
import { useMembers } from "@/hooks/use-members"
import { useStages } from "@/hooks/use-stages"
import {
  approvalLabels,
  contentTypes,
  formatLongDate,
  initials,
  platformLabels,
  platforms,
  typeLabels,
} from "@/lib/content"
import { cn } from "@/lib/utils"

/*
  Ordered as the work flows: where it stands, then planning, then the material,
  then what came out of it — and the two gates last. Review and Publish are the
  points where something leaves the team, so they sit at the end rather than
  interleaved with the tabs you use while making it.
*/
const tabs = [
  { to: "overview", label: "Overview" },
  { to: "notes", label: "Notes" },
  { to: "files", label: "Files" },
  { to: "repurposed", label: "Repurposed" },
  { to: "mindmap", label: "Mindmap" },
  { to: "review", label: "Review" },
  { to: "publish", label: "Publish" },
]

function StagePicker({ item }: { item: ContentItem }) {
  const { setStage } = useContent()
  const { stages } = useStages()
  const current = stages.find((s) => s.id === item.stageId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
            {current?.name ?? "No stage"}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup
          value={item.stageId}
          onValueChange={(value) => setStage(item.id, value)}
        >
          {[...stages]
            .sort((a, b) => a.position - b.position)
            .map((stage) => (
              <DropdownMenuRadioItem key={stage.id} value={stage.id}>
                {stage.name}
              </DropdownMenuRadioItem>
            ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The title, edited in place.
 *
 * No edit mode on the page and no save button: this is the detail view, so
 * changing a field here is the point of being here. Enter or blur commits,
 * Escape reverts.
 */
function EditableTitle({ item }: { item: ContentItem }) {
  const { updateItem } = useContent()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.title)
  const inputRef = useRef<HTMLInputElement>(null)

  /*
    Select on open only.

    Not an inline callback ref — that is a new function identity every render,
    so React re-attaches it on each keystroke and re-selects the text, and the
    next character replaces everything typed so far.
  */
  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commit() {
    const next = draft.trim()
    setEditing(false)
    // An empty title would leave a card nothing to render, so treat it as a
    // cancel rather than writing it.
    if (!next || next === item.title) {
      setDraft(item.title)
      return
    }
    updateItem(item.id, { title: next })
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit()
          if (event.key === "Escape") {
            setDraft(item.title)
            setEditing(false)
          }
        }}
        className="min-w-0 flex-1 rounded-sm bg-transparent font-medium outline-none ring-1 ring-ring"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(item.title)
        setEditing(true)
      }}
      title="Rename"
      className="min-w-0 truncate rounded-sm px-1 py-0.5 text-left font-medium transition-colors hover:bg-muted"
    >
      {item.title}
    </button>
  )
}

/** Archive, behind a confirm — it takes the whole subtree with it. */
function ProjectMenu({ item }: { item: ContentItem }) {
  const { items, archiveItem } = useContent()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)

  const descendants = items.filter((i) => i.ancestorIds.includes(item.id)).length

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Project actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            <Archive />
            Archive project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive “{item.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {descendants > 0
                ? `This also archives ${descendants} derived ${descendants === 1 ? "item" : "items"} made from it. `
                : ""}
              It disappears from the board. Nothing is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                archiveItem(item.id)
                navigate("/projects")
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function RailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-start gap-2 px-4 py-1.5">
      <span className="pt-0.5 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  )
}

/** Shared affordance for the rail's editable values. */
const railButton =
  "-mx-1 w-full truncate rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-muted"

function TypePicker({ item }: { item: ContentItem }) {
  const { updateItem } = useContent()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={railButton}>
            {item.type ? (
              typeLabels[item.type]
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup
          value={item.type ?? ""}
          onValueChange={(value) =>
            updateItem(item.id, { type: (value || null) as ContentItem["type"] })
          }
        >
          {/* Clearing it back to unset matters: an idea often has no form yet. */}
          <DropdownMenuRadioItem value="">Not set</DropdownMenuRadioItem>
          {contentTypes.map((type) => (
            <DropdownMenuRadioItem key={type} value={type}>
              {typeLabels[type]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DateField({
  item,
  field,
  empty,
}: {
  item: ContentItem
  field: "dueAt" | "publishAt"
  empty: string
}) {
  const { updateItem } = useContent()
  const [open, setOpen] = useState(false)
  const value = item[field]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button type="button" className={railButton}>
            {value ? (
              formatLongDate(value)
            ) : (
              <span className="text-muted-foreground">{empty}</span>
            )}
          </button>
        }
      />
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={(date) => {
            updateItem(item.id, { [field]: date ? date.toISOString() : null })
            setOpen(false)
          }}
          autoFocus
        />
        {value && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => {
                updateItem(item.id, { [field]: null })
                setOpen(false)
              }}
            >
              <X className="size-3.5" />
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function PlatformPicker({ item }: { item: ContentItem }) {
  const { updateItem } = useContent()

  function toggle(platform: Platform) {
    const next = item.platforms.includes(platform)
      ? item.platforms.filter((p) => p !== platform)
      : [...item.platforms, platform]
    updateItem(item.id, { platforms: next })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={railButton}>
            {item.platforms.length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {item.platforms.map((p) => (
                  <Badge key={p} variant="secondary" className="font-normal">
                    {platformLabels[p]}
                  </Badge>
                ))}
              </span>
            )}
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-44">
        {platforms.map((platform) => (
          <DropdownMenuCheckboxItem
            key={platform}
            checked={item.platforms.includes(platform)}
            // Kept open: picking platforms is usually picking several.
            closeOnClick={false}
            onCheckedChange={() => toggle(platform)}
          >
            {platformLabels[platform]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Rail({ item }: { item: ContentItem }) {
  const { members } = useMembers()
  const assignees = members.filter((m) => item.assigneeIds.includes(m.id))

  return (
    <aside className="hidden w-72 shrink-0 overflow-y-auto border-l py-4 lg:block">
      <RailField label="Status">
        <Badge variant="secondary" className="font-normal">
          {approvalLabels[item.approvalState]}
        </Badge>
      </RailField>

      <RailField label="Assignees">
        {assignees.length === 0 ? (
          <span className="text-muted-foreground">Unassigned</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {assignees.map((m) => (
              <span key={m.id} className="flex items-center gap-1.5">
                <Avatar className="size-5">
                  <AvatarFallback className="text-[9px]">
                    {initials(m.name)}
                  </AvatarFallback>
                </Avatar>
                {m.name}
              </span>
            ))}
          </div>
        )}
      </RailField>

      <RailField label="Type">
        <TypePicker item={item} />
      </RailField>

      <RailField label="Due">
        <DateField item={item} field="dueAt" empty="No date" />
      </RailField>

      <RailField label="Publish">
        <DateField item={item} field="publishAt" empty="Not scheduled" />
      </RailField>

      <RailField label="Platforms">
        <PlatformPicker item={item} />
      </RailField>

      <RailField label="Created">{formatLongDate(item.createdAt)}</RailField>

      <div className="mt-4 border-t px-4 pt-4">
        <h3 className="text-xs font-medium text-muted-foreground">Activity</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Every change to this project will appear here once the event log exists.
        </p>
      </div>
    </aside>
  )
}

export function ProjectLayout() {
  const { projectId } = useParams()
  const { items } = useContent()
  const [railOpen, setRailOpen] = useState(true)

  const item = items.find((i) => i.id === projectId)

  if (!item) {
    return (
      <>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="dark:hover:bg-muted" />
          <div className="h-4 w-px shrink-0 bg-border" />
          <h1 className="text-sm font-medium">Not found</h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Search className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No project with id <code className="font-mono">{projectId}</code>.
          </p>
          <Button variant="outline" size="sm" render={<Link to="/projects" />}>
            Back to board
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      {/* h-14 to line the rule up with the board's header and the sidebar's. */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <SidebarTrigger className="dark:hover:bg-muted" />
        <div className="h-4 w-px shrink-0 bg-border" />

        {/* Breadcrumb doubles as back navigation, so no separate back button. */}
        <nav className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link
            to="/projects"
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            Projects
          </Link>
          <span className="shrink-0 text-muted-foreground">/</span>
          <h1 className="flex min-w-0 flex-1">
            <EditableTitle item={item} />
          </h1>
        </nav>

        {item.type && (
          <Badge variant="secondary" className="shrink-0 font-normal">
            {typeLabels[item.type]}
          </Badge>
        )}
        <StagePicker item={item} />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            disabled
          >
            <MessageSquareReply className="size-3.5" />
            Request changes
          </Button>
          <Button size="sm" className="h-7 gap-1.5 px-2 text-xs" disabled>
            <Check className="size-3.5" />
            Approve
          </Button>
          <ProjectMenu item={item} />
          <Button
            variant="ghost"
            size="icon"
            className="hidden size-7 lg:inline-flex"
            onClick={() => setRailOpen((open) => !open)}
            aria-label={railOpen ? "Hide details" : "Show details"}
          >
            {railOpen ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
          </Button>
        </div>
      </header>

      {/* Tabs are routes, so every one of them is a shareable link. */}
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b px-4">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "-mb-px shrink-0 border-b-2 px-2.5 py-2.5 text-sm transition-colors",
                isActive
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <Outlet context={item} />
        </div>
        {railOpen && <Rail item={item} />}
      </div>
    </>
  )
}
