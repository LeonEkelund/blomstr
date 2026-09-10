import { Logo } from "@blomstr/ui"
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  FileText,
  FolderOpen,
  House,
  MessageSquare,
  Network,
  Plus,
  SquareKanban,
  Users,
} from "lucide-react"
import { useState } from "react"
import { Avatar } from "@/components/ui/avatar"

const tabs = ["Overview", "Notes", "Files", "Repurposed", "Mindmap", "Review", "Publish"]
const navigation = [
  { icon: House, label: "Home" },
  { icon: SquareKanban, label: "Projects" },
  { icon: CalendarDays, label: "Calendar" },
  { icon: CircleCheck, label: "My Tasks" },
  { icon: Users, label: "Team" },
]

// Illustrative data inside the same shell, tabs and panel layout as the app.
// Only the two demonstrated tabs are interactive; the surrounding chrome is a preview.
export function ProductPreview() {
  const [tab, setTab] = useState("Overview")
  return (
    <div className="product-preview">
      <aside className="preview-sidebar" aria-label="Example workspace navigation">
        <div className="flex items-center gap-2 px-3 py-5 font-semibold">
          <Logo className="size-5 text-primary" /> blomstr{" "}
          <ChevronDown className="ml-auto size-3" />
        </div>
        <div className="px-3 pb-5 text-xs text-muted-foreground">Studio workspace</div>
        {navigation.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className={`preview-nav-row ${label === "Projects" ? "is-active" : ""}`}
          >
            <Icon className="size-4" strokeWidth={1.5} />
            {label}
          </div>
        ))}
        <div className="mt-auto flex items-center gap-2 px-3 py-4">
          <Avatar name="Maya Lund" />
          <span className="text-xs">Maya Lund</span>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex h-14 items-center gap-3 border-b px-4 sm:px-6">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Projects</span>
          <span className="text-muted-foreground">/</span>
          <span className="truncate text-[13px] font-medium">Autumn campaign</span>
          <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Users className="size-3.5" /> Share
          </span>
        </div>
        <fieldset className="preview-tabs" aria-label="Example project views">
          {tabs.map((label) =>
            label === "Overview" || label === "Review" ? (
              <button
                type="button"
                key={label}
                onClick={() => setTab(label)}
                aria-pressed={tab === label}
                className={tab === label ? "is-active" : ""}
              >
                {label}
              </button>
            ) : (
              <span key={label}>{label}</span>
            ),
          )}
        </fieldset>
        {tab === "Overview" ? (
          <div className="preview-overview">
            <h3 className="text-2xl font-semibold tracking-tight">Autumn campaign</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your project, from the first idea to the final version.
            </p>
            <dl className="preview-metadata">
              {[
                ["Workflow stage", "In progress"],
                ["Review status", "In review"],
                ["Due date", "14 Oct"],
                ["Format", "Video"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-5 border-b py-7">
              <div className="max-w-sm">
                <h4 className="text-sm font-semibold">Next step</h4>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  A version is waiting for a decision. Review it alongside the team's
                  feedback.
                </p>
              </div>
              <button
                type="button"
                className="preview-primary"
                onClick={() => setTab("Review")}
              >
                Review version <ArrowUpRight className="size-3.5" />
              </button>
            </div>
            <h4 className="mt-6 mb-2 text-sm font-semibold">Workspace</h4>
            {[
              {
                icon: FileText,
                label: "Notes",
                description: "Ideas, direction and working notes.",
              },
              {
                icon: FolderOpen,
                label: "Files",
                description: "References and assets from Google Drive.",
              },
              {
                icon: Network,
                label: "Mindmap",
                description: "A canvas for connecting your ideas.",
              },
            ].map(({ icon: Icon, label, description }) => (
              <div key={label} className="flex items-center gap-3 border-b py-3">
                <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
                <div>
                  <p className="text-[13px] font-medium">{label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                </div>
                <ArrowUpRight className="ml-auto size-3.5 text-muted-foreground" />
              </div>
            ))}
          </div>
        ) : (
          <div className="preview-review">
            <div className="flex flex-wrap items-center gap-3 border-b p-4 text-xs">
              <span className="flex items-center gap-1 font-medium">
                V3 <ChevronDown className="size-3" />
              </span>
              <span className="text-muted-foreground">Autumn campaign artwork</span>
              <span className="rounded-md bg-secondary px-2 py-1">In review</span>
              <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                <Plus className="size-3" /> Add version
              </span>
            </div>
            <div className="preview-review-body">
              <div className="p-5 sm:p-7">
                <div className="campaign-art">
                  <span>Studio / 2026</span>
                  <p>
                    A season
                    <br />
                    of making.
                  </p>
                  <span>Autumn collection &nbsp; / &nbsp; 01</span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  autumn-campaign-v3.png
                </p>
              </div>
              <div className="preview-thread">
                <h4 className="flex items-center gap-2 border-b pb-4 text-xs font-medium">
                  <MessageSquare className="size-3.5" /> Version comments
                </h4>
                <div className="mt-5 flex gap-2">
                  <Avatar name="Maya Lund" />
                  <div>
                    <p className="text-xs font-medium">
                      Maya Lund{" "}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        &middot; V3
                      </span>
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed">
                      Updated the headline and spacing. Ready for a final look.
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <Avatar name="Ola Nyberg" />
                  <div>
                    <p className="text-xs font-medium">Ola Nyberg</p>
                    <p className="mt-2 text-[13px] leading-relaxed">
                      This works. The new layout gives the copy room to breathe.
                    </p>
                  </div>
                </div>
                <div className="mt-8 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
                  <Check className="size-3.5" /> Feedback stays with this version.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
