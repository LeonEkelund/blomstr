import { CheckIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VignetteFrame } from "@/components/vignettes/vignette-frame"
import { useSceneSteps } from "@/lib/use-scene-steps"

/*
  Publishing: a package assembling for one destination.

  The five destinations are the product's real platform list, and readiness is
  the product's real rule — an approved version, a date and the copy written.
  Blomstr prepares the handoff; it does not post anything, and the scene does
  not pretend otherwise.
*/
const PLATFORMS = [
  { label: "YouTube", selected: true },
  { label: "Instagram", selected: true },
  { label: "LinkedIn", selected: false },
  { label: "TikTok", selected: false },
  { label: "X", selected: false },
]

export function PublishVignette({ className }: { className?: string }) {
  const { ref, step } = useSceneSteps(3, { start: 450, interval: 950 })
  const copyReady = step >= 1
  const ready = step >= 2

  return (
    <div ref={ref}>
      <VignetteFrame title="Prepare publishing" className={className}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Autumn teaser</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={ready ? "ready" : "not-ready"}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.24 }}
            >
              <Badge variant={ready ? "default" : "secondary"}>
                {ready ? "Ready to publish" : "Not ready"}
              </Badge>
            </motion.span>
          </AnimatePresence>
        </div>

        <p className="mt-3 text-xs font-medium text-muted-foreground">Destinations</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PLATFORMS.map((platform) => (
            <Button
              key={platform.label}
              size="sm"
              variant={platform.selected ? "secondary" : "outline"}
              aria-pressed={platform.selected}
              tabIndex={-1}
            >
              {platform.selected && <CheckIcon />}
              {platform.label}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">YouTube copy</p>
            <motion.p
              initial={false}
              animate={{ opacity: copyReady ? 1 : 0.35 }}
              transition={{ duration: 0.4 }}
              className="mt-1.5 text-[0.8125rem] leading-relaxed"
            >
              Six weeks of planning, one afternoon of shooting. Here is how the autumn set
              came together.
            </motion.p>
          </div>

          <div className="space-y-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">Publish date</p>
              <p className="mt-1 text-[0.8125rem]">14 October</p>
            </div>
            <motion.div
              initial={false}
              animate={{
                borderColor: ready ? "var(--primary)" : "var(--border)",
              }}
              transition={{ duration: 0.4 }}
              className="rounded-lg border p-3"
            >
              <p className="text-xs font-medium text-muted-foreground">Asset</p>
              <p className="mt-1 flex items-center gap-1 text-[0.8125rem]">
                {ready && <CheckIcon className="size-3.5 text-accent-foreground" />}
                {ready ? "V3 approved" : "Awaiting approval"}
              </p>
            </motion.div>
          </div>
        </div>
      </VignetteFrame>
    </div>
  )
}
