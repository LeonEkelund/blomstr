import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cn } from "@blomstr/ui"
import { cva, type VariantProps } from "class-variance-authority"

/*
  The product's Button, carried across with its focus, disabled and active
  behaviour intact, plus the two things the landing page needs and the app
  does not: an `xl` size for hero calls to action, and a `glass` variant for
  controls that float over the flower.
*/
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-(--elevation-1) hover:bg-[color-mix(in_srgb,var(--primary),var(--primary-foreground)_8%)] hover:shadow-(--elevation-2)",
        outline: "border-input bg-background hover:bg-muted hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        ghost: "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        link: "text-accent-foreground underline-offset-4 hover:underline",
        /*
          Floating control over the hero. Uses the glass component class for
          material so nav and hero controls stay one material, not two.
        */
        glass: "glass text-foreground hover:bg-[var(--glass-bg-opaque)]",
        /* For use on the deep green section, where the palette inverts. */
        deep: "border-(--deep-border) bg-transparent text-(--deep-foreground) hover:bg-white/10",
      },
      size: {
        default: "h-9 gap-2 px-3.5",
        sm: "h-8 gap-1.5 rounded-lg px-3 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5",
        xl: "h-12 gap-2 rounded-xl px-6 text-[0.9375rem]",
        icon: "size-9",
        "icon-lg": "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
