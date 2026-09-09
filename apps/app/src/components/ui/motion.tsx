import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { motionTransitions } from "@/lib/motion"
import { cn } from "@/lib/utils"

/** Place inside a relative, isolated tab in a LayoutGroup with its own id. */
export function ActiveTabIndicator() {
  const reduced = useReducedMotion()
  return (
    <motion.span
      aria-hidden
      layoutId={reduced ? undefined : "active-tab"}
      initial={false}
      transition={reduced ? { duration: 0 } : motionTransitions.selection}
      className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-primary"
    />
  )
}

/** Reserve space for save feedback, crossfade only when the label changes. */
export function MotionStatus({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn("inline-grid min-w-24 text-right", className)}
    >
      <span className="sr-only">{text}</span>
      <AnimatePresence initial={false}>
        <motion.span
          aria-hidden="true"
          key={text}
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduced ? { duration: 0 } : motionTransitions.feedback}
          className="col-start-1 row-start-1"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
