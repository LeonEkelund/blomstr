import { MotionConfig, useReducedMotion } from "motion/react"
import { type ReactNode, useEffect } from "react"
import { motionTokens, motionTransitions } from "@/lib/motion"

/** Root policy for JS animations and the existing Base UI CSS transitions. */
export function MotionProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()

  useEffect(() => {
    const root = document.documentElement
    const tokens = {
      "--motion-quick": `${motionTokens.quick * 1000}ms`,
      "--motion-standard": `${motionTokens.standard * 1000}ms`,
      "--motion-panel": `${motionTokens.panel * 1000}ms`,
      "--motion-ease": `cubic-bezier(${motionTokens.ease.join(",")})`,
    }
    const previous = Object.keys(tokens).map((key): [string, string] => [
      key,
      root.style.getPropertyValue(key),
    ])
    for (const [key, value] of Object.entries(tokens)) root.style.setProperty(key, value)
    return () => {
      for (const [key, value] of previous) {
        if (value) root.style.setProperty(key, value)
        else root.style.removeProperty(key)
      }
    }
  }, [])

  return (
    <MotionConfig
      reducedMotion="user"
      transition={reduced ? { duration: 0 } : motionTransitions.default}
    >
      {children}
    </MotionConfig>
  )
}
