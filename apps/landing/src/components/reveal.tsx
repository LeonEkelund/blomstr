import { cn } from "@blomstr/ui"
import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"

/*
  Section entrance. One movement, once, on the way in.

  Reduced motion does not get a faster version of this — it gets no version of
  it, with the content simply present. An entrance animation carries no
  information here, so there is nothing to preserve.
*/
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: "div" | "li" | "section"
}) {
  const reduced = useReducedMotion()
  const Motion = motion[Tag]

  if (reduced) return <Tag className={className}>{children}</Tag>

  return (
    <Motion
      className={cn(className)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Motion>
  )
}
