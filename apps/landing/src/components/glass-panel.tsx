import { cn } from "@blomstr/ui"
import type { ReactNode } from "react"

/*
  A glass surface.

  It used to lift under the pointer: a radial highlight tracked from two custom
  properties. That went, for the same reason the ambient wash did. The panel is
  not interactive, so a hover response answered a question nobody asked, and it
  animated opacity inside a `backdrop-filter` element — re-rasterising a 20px
  blur across the whole panel every frame, which is exactly what the ambient
  field is built to avoid.

  The material carries the identity now: border, blur, saturation and the lit
  top edge. No per-frame work on pointer move.
*/
export function GlassPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("glass-section", className)}>{children}</div>
}
