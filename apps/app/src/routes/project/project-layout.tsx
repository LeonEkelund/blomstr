import type { ContentItem } from "@blomstr/types"
import {
  Check,
  ChevronDown,
  MessageSquareReply,
  PanelRightClose,
  PanelRightOpen,
  Search,
} from "lucide-react"
import { useState } from "react"
import { Link, NavLink, Outlet, useParams } from "react-router-dom"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useContent } from "@/hooks/use-content"
import {
  approvalLabels,
  formatLongDate,
  initials,
  platformLabels,
  typeLabels,
} from "@/lib/content"
import { members, stages } from "@/lib/mock-data"
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

function RailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-start gap-2 px-4 py-1.5">
      <span className="pt-0.5 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  )
}

function Rail({ item }: { item: ContentItem }) {
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

      <RailField label="Due">
        {item.dueAt ? (
          formatLongDate(item.dueAt)
        ) : (
          <span className="text-muted-foreground">No date</span>
        )}
      </RailField>

      <RailField label="Publish">
        {item.publishAt ? (
          formatLongDate(item.publishAt)
        ) : (
          <span className="text-muted-foreground">Not scheduled</span>
        )}
      </RailField>

      <RailField label="Platforms">
        {item.platforms.length === 0 ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {item.platforms.map((p) => (
              <Badge key={p} variant="secondary" className="font-normal">
                {platformLabels[p]}
              </Badge>
            ))}
          </div>
        )}
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
          <h1 className="truncate font-medium">{item.title}</h1>
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
