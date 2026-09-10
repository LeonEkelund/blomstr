import { useInView, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"

/*
  Drives a vignette through a short sequence of states once it is on screen.

  Two rules the brief sets, both handled here rather than in each scene:
  every scene has to be understandable when paused, so the last step is the
  meaningful one and the earlier steps only lead to it; and reduced motion
  jumps straight to that last step instead of playing a faster sequence.
*/
export function useSceneSteps(
  count: number,
  { start = 420, interval = 900 }: { start?: number; interval?: number } = {},
) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" })
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (reduced) {
      setStep(count - 1)
      return
    }
    if (!inView) return

    const timers = Array.from({ length: count - 1 }, (_, i) =>
      window.setTimeout(() => setStep(i + 1), start + i * interval),
    )
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [inView, reduced, count, start, interval])

  return { ref, step }
}
