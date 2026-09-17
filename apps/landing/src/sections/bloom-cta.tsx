import { Logo } from "@blomstr/ui"
import { ArrowUpRightIcon } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { Button } from "@/components/ui/button"
import { SIGN_IN_URL } from "@/lib/config"

/*
  The closing call to action, on the page's own background.

  It used to be a full-bleed dark panel with its own tiled mark field — a
  second surface, with a second texture, arriving right after the glass one.
  Two competing backgrounds in the last two screens made the end of the page
  look like it belonged to a different site. Now it sits in the ambient field
  like everything else, and the only thing with any weight on the screen is
  the button, which is the point of a closing call to action.
*/
export function BloomCta() {
  return (
    <section className="py-24 sm:py-32">
      <div className="shell">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Logo className="mx-auto mb-8 size-9 text-primary" aria-hidden="true" />
          <h2 className="display text-[clamp(2.75rem,6vw,4.75rem)]">
            Give your content
            <br />
            room to grow.
          </h2>
          <p className="mx-auto mt-6 max-w-sm leading-relaxed text-muted-foreground">
            Bring the next idea from first thought to final handoff in Blomstr.
          </p>
          <Button
            size="xl"
            className="mt-8"
            nativeButton={false}
            render={<a href={SIGN_IN_URL} />}
          >
            Get started <ArrowUpRightIcon />
          </Button>
        </Reveal>
      </div>
    </section>
  )
}
