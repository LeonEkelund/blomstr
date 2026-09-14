import { Ambient } from "@/components/ambient"
import { GlassPanel } from "@/components/glass-panel"
import { SiteNav } from "@/components/site-nav"
import { BloomCta } from "@/sections/bloom-cta"
import { Capabilities } from "@/sections/capabilities"
import { Collaboration } from "@/sections/collaboration"
import { Hero } from "@/sections/hero"
import { SiteFooter } from "@/sections/site-footer"
import { Workflow } from "@/sections/workflow"

export function App() {
  return (
    <>
      <Ambient />
      <SiteNav />

      <main>
        <Hero />
        <Workflow />
        {/*
          One panel, two beats. What the product does and who it does it for
          are the same answer, and giving each its own glass panel made them
          read as separate arguments with a gap of page between them.
        */}
        <GlassPanel className="relative z-10">
          <Capabilities />
          <Collaboration />
        </GlassPanel>
        <BloomCta />
      </main>

      <SiteFooter />
    </>
  )
}
