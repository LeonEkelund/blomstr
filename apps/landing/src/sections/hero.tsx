import { ArrowDownIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { ProductPreview } from "@/components/product-preview"
import { Button } from "@/components/ui/button"
import { SECTIONS, SIGN_IN_URL } from "@/lib/config"

/*
  The hero states the product in a sentence and then shows it.

  The claim and the evidence used to be a full viewport apart: the hero spent
  its screen on a 3D flower and the workspace only appeared once you had
  scrolled past it. Here the preview sits directly under the sentence it is
  proving, and the fold cuts it — nothing is hiding the rest of the frame, it is
  simply further down, which is what makes the page worth scrolling.
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
    <section id="top" className="relative min-h-[100svh] pt-24 pb-16 sm:pt-28">
      <div className="shell">
        <div className="mx-auto max-w-3xl text-center">
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
            className="mx-auto mt-6 max-w-md text-[1.0625rem] leading-relaxed text-muted-foreground"
          >
            Plan, create, review and prepare every piece of content with your whole team
            in one place.
          </motion.p>

          <motion.div
            {...rise(0.28)}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
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
        </div>
      </div>

      {/*
        Outside the shell on purpose: the screenshot is the evidence for the
        sentence above it, so it gets to be the wider object. The nav's
        "Product" link lands here rather than on the section, so it scrolls to
        the workspace itself instead of to the top of the page.
      */}
      <motion.div
        {...rise(0.38)}
        id={SECTIONS.product}
        className="mt-12 px-[clamp(1.25rem,5vw,3rem)] sm:mt-14"
      >
        <div className="hero-stage">
          <ProductPreview />
        </div>
      </motion.div>
    </section>
  )
}
