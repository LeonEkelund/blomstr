import type { Transition } from "motion/react"

/** App-wide timing. Seconds for Motion; the provider exposes matching CSS tokens. */
export const motionTokens = {
  quick: 0.15,
  standard: 0.18,
  panel: 0.2,
  ease: [0.2, 0.8, 0.2, 1] as const,
}

export const motionTransitions = {
  default: { duration: motionTokens.standard, ease: motionTokens.ease },
  feedback: { duration: motionTokens.quick, ease: motionTokens.ease },
  selection: { type: "spring", duration: motionTokens.panel, bounce: 0 },
} satisfies Record<string, Transition>
