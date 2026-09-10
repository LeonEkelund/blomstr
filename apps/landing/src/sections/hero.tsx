import { ArrowDownIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { SECTIONS, SIGN_IN_URL } from "@/lib/config"

/*
  The hero states the product in a sentence and gives you two ways forward.

  Everything here is ordinary HTML — headline, copy and both calls to action
  are readable, selectable and keyboard reachable whether or not the flower
  ever renders. The flower sits behind the page, framed to
  the right of the copy on desktop and into a band above it on portrait.
*/
export function Hero() {
  const reduced = useReducedMotion()

  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col justify-center pt-24 pb-16 sm:pt-28"
    >
      <div
        className="tonal-pool pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      />

      <div className="mb-6 h-[32svh] shrink-0 md:hidden" aria-hidden="true" />

      <div className="shell">
        <div className="grid items-center gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <motion.p {...rise(0.05)} className="eyebrow">
              The creative workspace for content teams
            </motion.p>

            <motion.h1
              {...rise(0.12)}
              className="display mt-5 text-[clamp(2.75rem,7.5vw,4.75rem)]"
            >
              From rough idea to{" "}
              <em className="display-em text-accent-foreground">ready to publish</em>.
            </motion.h1>

            <motion.p
              {...rise(0.2)}
              className="mt-6 max-w-md text-[1.0625rem] leading-relaxed text-muted-foreground"
            >
              Plan, create, review and prepare every piece of content with your whole team
              in one place.
            </motion.p>

            <motion.div
              {...rise(0.28)}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Button size="xl" nativeButton={false} render={<a href={SIGN_IN_URL} />}>
                Get started
              </Button>
              <Button
                size="xl"
                variant="glass"
                nativeButton={false}
                render={<a href={`#${SECTIONS.workflow}`} />}
              >
                See how it works
                <ArrowDownIcon />
              </Button>
            </motion.div>

            <motion.p {...rise(0.4)} className="mt-12 text-xs text-muted-foreground">
              Plan <span className="mx-2 text-border">/</span> Create{" "}
              <span className="mx-2 text-border">/</span> Review{" "}
              <span className="mx-2 text-border">/</span> Approve{" "}
              <span className="mx-2 text-border">/</span> Publish
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  )
}
