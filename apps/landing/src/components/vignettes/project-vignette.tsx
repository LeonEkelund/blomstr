import { FileTextIcon, FolderIcon, NetworkIcon } from "lucide-react"
import { motion } from "motion/react"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VignetteFrame } from "@/components/vignettes/vignette-frame"
import { useSceneSteps } from "@/lib/use-scene-steps"

/*
  A project overview coming into its active state.

  Modelled on the real project screen: one clear next action at the top, then
  the tools that belong to the project. The next action is one of the app's
  own — it tells you where the work actually is rather than listing features.
*/
const TOOLS = [
  { icon: FileTextIcon, label: "Notes", detail: "3 notes" },
  { icon: FolderIcon, label: "Files", detail: "Google Drive" },
  { icon: NetworkIcon, label: "Mindmap", detail: "12 nodes" },
]

export function ProjectVignette({ className }: { className?: string }) {
  const { ref, step } = useSceneSteps(TOOLS.length + 1, { start: 300, interval: 160 })

  return (
    <div ref={ref}>
      <VignetteFrame title="Autumn teaser" className={className}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="font-normal">
            In review
          </Badge>
          <Badge variant="outline" className="font-normal">
            Due 14 Oct
          </Badge>
          <div className="ml-auto flex -space-x-1.5">
            <Avatar name="Maya Lund" />
            <Avatar name="Ola Nyberg" />
            <Avatar name="Ines Roth" />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3.5">
          <p className="text-xs font-medium text-muted-foreground">Next</p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed">
            V3 is waiting on approval from an owner or admin.
          </p>
          <Button size="sm" className="mt-3" tabIndex={-1}>
            Open review
          </Button>
        </div>

        <div className="mt-3 space-y-1.5">
          {TOOLS.map((tool, index) => (
            <motion.div
              key={tool.label}
              initial={false}
              animate={{
                opacity: step > index ? 1 : 0,
                y: step > index ? 0 : 8,
              }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
            >
              <tool.icon
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <span className="text-[0.8125rem] font-medium">{tool.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{tool.detail}</span>
            </motion.div>
          ))}
        </div>
      </VignetteFrame>
    </div>
  )
}
