import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  /** One sentence on what belongs here — not an apology for it being empty. */
  description: string
  action?: ReactNode
  className?: string
}

/**
 * Most of the project workspace is empty until the schema exists. An empty
 * region with no explanation reads as broken, so every one of them says what
 * it is for.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
    >
      <div className="rounded-2xl border border-primary/20 bg-accent p-4">
        <Icon className="size-6 text-accent-foreground" />
      </div>
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-balance text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
