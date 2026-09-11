import { SiteNav } from "@/components/site-nav"
import { FlowerCanvas } from "@/flower/flower-canvas"
import { BloomCta } from "@/sections/bloom-cta"
import { Capabilities } from "@/sections/capabilities"
import { Collaboration } from "@/sections/collaboration"
import { Hero } from "@/sections/hero"
import { ProductProof } from "@/sections/product-proof"
import { SiteFooter } from "@/sections/site-footer"
import { Workflow } from "@/sections/workflow"

export function App() {
  return (
    <>
      <FlowerCanvas />
      <SiteNav />

      <main>
        <div id="flower-zone">
          <Hero />
          <ProductProof />
          <Workflow />
          {/*
            One panel, two beats. What the product does and who it does it for
            are the same answer, and giving each its own glass panel made them
            read as separate arguments with a gap of page between them.
          */}
          <div className="glass-section relative z-10">
            <Capabilities />
            <Collaboration />
          </div>
        </div>
        <BloomCta />
      </main>

      <SiteFooter />
    </>
  )
}
