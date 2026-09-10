import { cn } from "@blomstr/ui"
import { CheckIcon, FileTextIcon, FolderIcon, NetworkIcon } from "lucide-react"
import { useInView } from "motion/react"
import { type ReactNode, useRef } from "react"
import { Reveal } from "@/components/reveal"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SECTIONS } from "@/lib/config"

// Keep the workflow copy beside the continuous bloom.
function StageView({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-lg border border-border bg-background p-4">
      {children}
    </div>
  )
}

const STAGES = [
  {
    name: "Plan",
    sentence: "Shape the idea, timing and direction before work begins.",
    view: (
      <StageView>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-normal">
            Draft
          </Badge>
          <Badge variant="outline" className="font-normal">
            Due 14 Oct
          </Badge>
          <Badge variant="outline" className="font-normal">
            YouTube
          </Badge>
          <Badge variant="outline" className="font-normal">
            Instagram
          </Badge>
        </div>
      </StageView>
    ),
  },
  {
    name: "Create",
    sentence: "Bring notes, files and collaborators into the same project.",
    view: (
      <StageView>
        <div className="divide-y divide-border">
          {[
            { icon: FileTextIcon, label: "Notes", detail: "Ideas and working notes" },
            { icon: FolderIcon, label: "Files", detail: "Google Drive" },
            { icon: NetworkIcon, label: "Mindmap", detail: "Connected ideas" },
          ].map((tool) => (
            <div
              key={tool.label}
              className="flex items-center gap-3 py-3 text-[0.8125rem]"
            >
              <tool.icon
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <span className="font-medium">{tool.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{tool.detail}</span>
            </div>
          ))}
        </div>
      </StageView>
    ),
  },
  {
    name: "Review",
    sentence: "Give clear feedback directly beside the work.",
    view: (
      <StageView>
        <div className="flex gap-2.5">
          <Avatar name="Maya Lund" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Maya</span> · on V3
            </p>
            <p className="mt-0.5 text-[0.8125rem] leading-relaxed">
              Trimmed the intro by two seconds — this is the cut we discussed.
            </p>
          </div>
        </div>
      </StageView>
    ),
  },
  {
    name: "Approve",
    sentence: "Know which version is final and what still needs attention.",
    view: (
      <StageView>
        <div className="space-y-2 text-[0.8125rem]">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">V3</span>
            <Badge variant="secondary" className="font-normal">
              Approved
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3 text-muted-foreground">
            <span>V2</span>
            <Badge variant="destructive" className="font-normal">
              Changes requested
            </Badge>
          </div>
        </div>
      </StageView>
    ),
  },
  {
    name: "Publish",
    sentence: "Prepare approved assets and platform copy for the handoff.",
    view: (
      <StageView>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {["YouTube", "Instagram"].map((platform) => (
              <span
                key={platform}
                className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
              >
                <CheckIcon className="size-3" aria-hidden="true" />
                {platform}
              </span>
            ))}
          </div>
          <Badge className="font-normal">Ready to publish</Badge>
        </div>
      </StageView>
    ),
  },
]

function Stage({ index, stage }: { index: number; stage: (typeof STAGES)[number] }) {
  const ref = useRef<HTMLLIElement>(null)
  // Marks the stage the reader is actually on. The flower dims and lifts its
  // matching petal at roughly the same moment, driven by the same scroll.
  const active = useInView(ref, { margin: "-45% 0px -45% 0px" })

  return (
    <li ref={ref} className="flex flex-col justify-center py-14 md:min-h-[62svh] md:py-0">
      <div
        className={cn(
          "transition-opacity duration-(--motion-cinematic) ease-(--motion-ease-cinematic)",
          active ? "opacity-100" : "md:opacity-45",
        )}
      >
        <div className="flex items-baseline gap-3">
          <span className="display text-2xl text-accent-foreground tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-xl font-semibold tracking-tight">{stage.name}</h3>
        </div>
        <p className="mt-2 max-w-sm leading-relaxed text-muted-foreground">
          {stage.sentence}
        </p>
        {stage.view}
      </div>
    </li>
  )
}

export function Workflow() {
  return (
    <section id={SECTIONS.workflow} className="relative py-24 sm:py-32">
      <div className="shell">
        <Reveal className="md:ml-auto md:w-1/2 md:pl-5">
          <h2 className="display text-[clamp(2rem,4.4vw,3.25rem)]">
            Everything your content becomes, in one place.
          </h2>
        </Reveal>

        <div id="workflow-track" className="mt-10 md:grid md:grid-cols-12 md:gap-10">
          <ol className="mt-8 md:col-span-6 md:col-start-7 md:mt-0">
            {STAGES.map((stage, index) => (
              <Stage key={stage.name} index={index} stage={stage} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
