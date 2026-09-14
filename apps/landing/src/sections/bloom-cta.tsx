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
      {/*
        The same mark language as the ambient field, so the CTA reads as the
        page's last panel rather than as a different surface.

        This was the Blomstr glyph tiled at 16px. A four-square mark that size,
        edge to edge, is too much figure for a background: it builds an even
        heavy plaid and the eye finds a moiré in it instead of a texture. A
        single dash at a wider gauge has no internal structure to beat against
        its neighbours, and the logo still appears above the headline where it
        can be read as a logo.
      */}
      <svg className="closing-cta-pattern" width="100%" height="100%" aria-hidden="true">
        <defs>
          <pattern id={patternId} width="26" height="26" patternUnits="userSpaceOnUse">
            <rect x="9" y="12.2" width="8" height="1.6" rx="0.8" fill="currentColor" />
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
