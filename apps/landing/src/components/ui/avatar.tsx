import { cn } from "@blomstr/ui"
import type { ComponentProps } from "react"

/*
  Initials only. The landing page has no real user photographs to show, and
  inventing stock faces would be the same lie as inventing customer logos.
*/
function Avatar({
  name,
  className,
  ...props
}: ComponentProps<"span"> & { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <span
      data-slot="avatar"
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[0.6875rem] font-medium text-secondary-foreground ring-2 ring-card select-none",
        className,
      )}
      {...props}
    >
      {initials}
    </span>
  )
}

export { Avatar }
