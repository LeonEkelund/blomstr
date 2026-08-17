import type { SVGProps } from "react"

const PETAL = "M0 0H84A36 36 0 0 1 120 36V88H104V104H88V120H36A36 36 0 0 1 0 84Z"

/**
 * Brand mark. Uses `currentColor`, so it takes the surrounding text colour —
 * one component instead of separate black and white files.
 *
 * Size it with a utility class: <Logo className="size-6" />
 */
export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="-32 -32 320 320"
      fill="currentColor"
      className={className}
      role="img"
      aria-label="blomstr"
      {...props}
    >
      <path d={PETAL} />
      <path d={PETAL} transform="rotate(90 128 128)" />
      <path d={PETAL} transform="rotate(180 128 128)" />
      <path d={PETAL} transform="rotate(270 128 128)" />
    </svg>
  )
}
