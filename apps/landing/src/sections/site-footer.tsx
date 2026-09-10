import { Logo } from "@blomstr/ui"
import { SECTIONS, SIGN_IN_URL } from "@/lib/config"

/*
  Three links, all of which go somewhere real.

  No About, Contact, Privacy, Terms or social icons until there are pages
  behind them — a footer full of dead links is the fastest way to make a
  product look unfinished.
*/
const LINKS = [
  { label: "Product", href: `#${SECTIONS.product}` },
  { label: "How it works", href: `#${SECTIONS.workflow}` },
  { label: "Log in", href: SIGN_IN_URL },
]

export function SiteFooter() {
  return (
    <footer className="relative z-10 bg-background py-12">
      <div className="shell">
        <div className="flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Logo className="size-4 text-primary" />
            <span className="text-sm font-semibold tracking-tight">blomstr</span>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  )
}
