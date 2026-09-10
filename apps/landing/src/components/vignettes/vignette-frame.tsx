import { cn, Logo } from "@blomstr/ui"
import type { ReactNode } from "react"

/*
  The window every product scene sits in.

  Deliberately not a browser chrome mockup with traffic lights — the point is
  to show Blomstr, not to show a screenshot of a screenshot. A header strip
  with the mark and the screen's real name is enough to read as product.
*/
export function VignetteFrame({
  title,
  children,
  className,
  bodyClassName,
}: {
  title: string
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <div className={cn("surface-raised overflow-hidden", className)}>
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
        <Logo className="size-3.5 text-primary" aria-hidden="true" />
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
      </div>
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </div>
  )
}
