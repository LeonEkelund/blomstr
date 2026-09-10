import { Logo } from "@blomstr/ui"
import { ArrowUpRightIcon } from "lucide-react"
import { useId } from "react"
import { Reveal } from "@/components/reveal"
import { Button } from "@/components/ui/button"
import { SIGN_IN_URL } from "@/lib/config"

export function BloomCta() {
  const patternId = useId()

  return (
    <section className="closing-cta relative z-10 overflow-hidden py-24 sm:py-32">
      <svg className="closing-cta-pattern" width="100%" height="100%" aria-hidden="true">
        <defs>
          <pattern id={patternId} width="16" height="16" patternUnits="userSpaceOnUse">
            <Logo x="5" y="5" width="6" height="6" aria-hidden="true" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <div className="shell relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Logo className="mx-auto mb-8 size-9 text-primary" aria-hidden="true" />
          <h2 className="display text-[clamp(2.75rem,6vw,4.75rem)]">
            Give your content
            <br />
            room to grow.
          </h2>
          <p className="mx-auto mt-6 max-w-sm leading-relaxed text-deep-muted">
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
