import { cn } from "@blomstr/ui"
import {
  BellIcon,
  CalendarIcon,
  CheckCheckIcon,
  FolderIcon,
  MessageSquareIcon,
  NetworkIcon,
  SendIcon,
} from "lucide-react"
import { Reveal } from "@/components/reveal"
import { SECTIONS } from "@/lib/config"

/*
  Capabilities. Every entry is something the product does today.

  Built as a divided grid rather than a bento of coloured cards: the tiles
  differ in what they say, not in how they look, and the hairlines do the
  organising so nothing needs a border, a gradient or an accent of its own.
*/
const CAPABILITIES = [
  {
    icon: CalendarIcon,
    label: "Projects and deadlines",
    detail: "Every piece of content as a project with a date and an owner.",
    wide: true,
  },
  {
    icon: NetworkIcon,
    label: "Mindmaps and notes",
    detail: "Think it through before it becomes a task.",
  },
  {
    icon: FolderIcon,
    label: "Google Drive files",
    detail: "The files you already keep in Drive, in the project.",
  },
  {
    icon: MessageSquareIcon,
    label: "Version review and comments",
    detail: "Feedback attached to the version it belongs to.",
  },
  {
    icon: CheckCheckIcon,
    label: "Approvals and requested changes",
    detail: "One clear final version, and a record of what was asked for.",
  },
  {
    icon: SendIcon,
    label: "Per-platform publishing packages",
    detail: "Copy, assets and dates prepared per destination.",
  },
  {
    icon: BellIcon,
    label: "Assignments and notifications",
    detail: "People hear about the work that is actually theirs.",
  },
]

export function Capabilities() {
  return (
    <section
      id={SECTIONS.capabilities}
      className="glass-section relative z-10 py-24 sm:py-32"
    >
      <div className="shell">
        <Reveal className="max-w-2xl">
          <h2 className="display text-[clamp(2rem,4.4vw,3.25rem)]">
            Built around the way creative work actually moves.
          </h2>
        </Reveal>

        <Reveal delay={0.08} className="mt-14">
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <li
                key={capability.label}
                className={cn(
                  "group bg-background p-6 transition-colors duration-(--motion-standard) hover:bg-muted/50 lg:last:col-span-2",
                  capability.wide && "sm:col-span-2",
                )}
              >
                <capability.icon
                  className="size-4.5 text-accent-foreground"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-[0.9375rem] font-medium">{capability.label}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {capability.detail}
                </p>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
