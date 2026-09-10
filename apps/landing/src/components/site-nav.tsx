import { Dialog } from "@base-ui/react/dialog"
import { cn, Logo } from "@blomstr/ui"
import { MenuIcon, XIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { SECTIONS, SIGN_IN_URL } from "@/lib/config"

const LINKS = [
  { label: "Product", href: `#${SECTIONS.product}` },
  { label: "How it works", href: `#${SECTIONS.workflow}` },
]

function Wordmark() {
  return (
    <a
      href="#top"
      className="flex items-center gap-2 rounded-md text-foreground"
      aria-label="Blomstr, back to top"
    >
      <Logo className="size-5 text-primary" />
      <span className="text-[0.9375rem] font-semibold tracking-tight">blomstr</span>
    </a>
  )
}

export function SiteNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    // The bar starts almost invisible over the hero and gains its material
    // once there is content behind it worth separating from.
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 pt-3 sm:pt-4">
      <div className="shell">
        <nav
          aria-label="Main"
          data-scrolled={scrolled || undefined}
          className={cn(
            "flex h-14 items-center justify-between rounded-2xl px-3 pl-4 transition-all duration-(--motion-panel) ease-(--motion-ease)",
            scrolled ? "glass" : "border border-transparent bg-transparent shadow-none",
          )}
        >
          <Wordmark />

          <div className="ml-auto mr-2">
            <ThemeToggle />
          </div>
          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <span className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
            <a
              href={SIGN_IN_URL}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Log in
            </a>
            <Button size="sm" nativeButton={false} render={<a href={SIGN_IN_URL} />}>
              Get started
            </Button>
          </div>

          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <MenuIcon />
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-50 bg-background/20 transition-opacity duration-(--motion-panel) data-ending-style:opacity-0 data-starting-style:opacity-0" />
              {/*
                Full-viewport rather than a drawer: on a phone this is the
                signature moment of the navigation, and the page staying
                faintly visible through the glass keeps it feeling like a
                layer over the site rather than a separate screen.
              */}
              <Dialog.Popup
                aria-label="Navigation menu"
                className={cn(
                  "glass fixed inset-0 z-50 flex flex-col rounded-none border-0 md:hidden",
                  "transition-all duration-(--motion-panel) ease-(--motion-ease)",
                  "data-ending-style:opacity-0 data-starting-style:opacity-0",
                )}
                style={{
                  paddingTop: "max(0.75rem, env(safe-area-inset-top))",
                  paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
                }}
              >
                <div className="flex h-14 shrink-0 items-center justify-between px-6">
                  <Wordmark />
                  {/* Same position as the trigger, so it does not jump. */}
                  <Dialog.Close
                    render={
                      <Button variant="ghost" size="icon" aria-label="Close menu" />
                    }
                  >
                    <XIcon />
                  </Dialog.Close>
                </div>

                <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 px-6">
                  {[...LINKS, { label: "Log in", href: SIGN_IN_URL }].map(
                    (link, index) => (
                      <motion.a
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        initial={reduced ? false : { opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.06 + index * 0.055,
                          duration: 0.42,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="rounded-xl py-3 text-3xl font-medium tracking-tight text-foreground"
                      >
                        {link.label}
                      </motion.a>
                    ),
                  )}
                </div>

                <div className="shrink-0 px-6">
                  <Button
                    size="xl"
                    className="w-full"
                    nativeButton={false}
                    render={<a href={SIGN_IN_URL} />}
                    onClick={() => setOpen(false)}
                  >
                    Get started
                  </Button>
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </nav>
      </div>
    </header>
  )
}
