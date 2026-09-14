import { cn } from "@blomstr/ui"
import type { PointerEvent, ReactNode } from "react"
import { useRef } from "react"

/*
  A glass surface that lifts under the pointer.

  The highlight is a radial gradient positioned from two custom properties, so
  following the pointer costs a style recalculation and no React render. It is
  hover-gated in CSS rather than here: on a touch screen a pointer position is
  wherever the last tap happened, and a panel lit from a stale coordinate reads
  as a rendering fault rather than as a response to anything.
*/
export function GlassPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  const track = (event: PointerEvent<HTMLDivElement>) => {
    const panel = ref.current
    if (!panel) return
    const bounds = panel.getBoundingClientRect()
    panel.style.setProperty(
      "--glow-x",
      `${((event.clientX - bounds.left) / bounds.width) * 100}%`,
    )
    panel.style.setProperty(
      "--glow-y",
      `${((event.clientY - bounds.top) / bounds.height) * 100}%`,
    )
  }

  return (
    <div ref={ref} onPointerMove={track} className={cn("glass-section", className)}>
      {children}
    </div>
  )
}
