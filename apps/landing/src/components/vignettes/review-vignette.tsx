import { CheckIcon, MessageSquareReply } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VignetteFrame } from "@/components/vignettes/vignette-frame"
import { useSceneSteps } from "@/lib/use-scene-steps"

/*
  Review: a version picks up a comment, then an approval.

  Every label here is the product's own — "In review" and "Approved" are two
  of the four real approval states, versions are numbered V1, V2, V3 as they
  are in the app, and comments hang off a specific version rather than the
  project as a whole.
*/
export function ReviewVignette({ className }: { className?: string }) {
  const { ref, step } = useSceneSteps(3, { start: 500, interval: 1100 })
  const approved = step >= 2

  return (
    <div ref={ref}>
      <VignetteFrame title="Review" className={className}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">V3</span>
            <span className="text-xs text-muted-foreground">Autumn teaser cut</span>
          </div>
          {/*
            The badge swaps rather than recolours, so the change reads as the
            state actually moving rather than as a styling flourish.
          */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={approved ? "approved" : "in_review"}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.24 }}
            >
              <Badge variant={approved ? "secondary" : "default"} className="font-normal">
                {approved ? "Approved" : "In review"}
              </Badge>
            </motion.span>
          </AnimatePresence>
        </div>

        {/* The asset under review. Tonal rather than a fake photograph. */}
        <div className="mt-3 aspect-[16/9] rounded-lg border border-border bg-gradient-to-br from-muted to-secondary" />

        <div className="mt-4 space-y-3 border-t border-border pt-3">
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

          <AnimatePresence>
            {step >= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-2.5"
              >
                <Avatar name="Ola Nyberg" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Ola</span> · on V3
                  </p>
                  <p className="mt-0.5 text-[0.8125rem] leading-relaxed">
                    Works for me. Captions match the approved copy.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" disabled={approved}>
            {approved ? <CheckIcon /> : null}
            {approved ? "Approved" : "Approve"}
          </Button>
          <Button size="sm" variant="outline">
            <MessageSquareReply />
            Request changes
          </Button>
        </div>
      </VignetteFrame>
    </div>
  )
}
