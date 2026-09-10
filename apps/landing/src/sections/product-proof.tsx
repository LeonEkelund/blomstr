import { ProductPreview } from "@/components/product-preview"
import { Reveal } from "@/components/reveal"
import { SECTIONS } from "@/lib/config"

export function ProductProof() {
  return (
    <section id={SECTIONS.product} className="glass-section relative z-10 py-20 sm:py-28">
      <div className="shell">
        <Reveal className="mb-12 grid items-end gap-6 md:grid-cols-2">
          <div>
            <p className="eyebrow">One connected workspace</p>
            <h2 className="display mt-4 max-w-lg text-[clamp(2.25rem,4.4vw,3.5rem)]">
              Keep the work moving without losing the thread.
            </h2>
          </div>
          <p className="max-w-sm leading-relaxed text-muted-foreground md:ml-auto">
            Ideas, files, feedback and final versions stay together from the first note to
            the publishing handoff.
          </p>
        </Reveal>
        <Reveal>
          <ProductPreview />
        </Reveal>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          An example project in Blomstr. Explore Overview and Review.
        </p>
      </div>
    </section>
  )
}
