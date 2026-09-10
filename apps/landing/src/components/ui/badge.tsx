import { cn } from "@blomstr/ui"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

/*
  The product's Badge. Landing-page usage is deliberately narrow: real
  approval states and real workspace roles only, never as a decorative label
  above every heading.
*/
const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/10 text-destructive dark:bg-destructive/20",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Badge({
  className,
  variant = "default",
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
