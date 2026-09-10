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
          <Capabilities />
        </div>
        <Collaboration />
        <BloomCta />
      </main>

      <SiteFooter />
    </>
  )
}
