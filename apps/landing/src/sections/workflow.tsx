import { cn } from "@blomstr/ui"
import { useInView } from "motion/react"
import { useRef } from "react"
import { Reveal } from "@/components/reveal"
import { SECTIONS } from "@/lib/config"

const STAGES = [
  {
    name: "Plan",
    sentence: "Shape the idea, timing and direction before work begins.",
  },
  {
    name: "Create",
    sentence: "Bring notes, files and collaborators into the same project.",
  },
  {
    name: "Review",
    sentence: "Give clear feedback directly beside the work.",
  },
  {
    name: "Approve",
    sentence: "Know which version is final and what still needs attention.",
  },
  {
    name: "Publish",
    sentence: "Prepare approved assets and platform copy for the handoff.",
  },
]

/*
  One stage, lit once the reader reaches it — and left lit.

  It used to light only while it straddled a hairline across the middle of
  the viewport, which needed every stage to stand 30svh tall so something was
  always crossing that line: five stages of six words each, spread over a
  screen and a half. At a natural height the list mostly sits off-centre, and
  a centre-tracking highlight would dim all five. Lighting on arrival keeps the
  sense of moving through a sequence at a third of the length.

  The dimming is desktop-only. On a phone the whole list is on screen at once
  and there is no meaningful "where you are".

  Only the content dims, never the rule above it. Fading the hairlines in and
  out turns the structure of the list into part of the animation, and the list
  stops looking like a list.
*/
function Stage({ index, stage }: { index: number; stage: (typeof STAGES)[number] }) {
  const ref = useRef<HTMLLIElement>(null)
  // Lit once it rises past the lower third of the viewport, then stays lit.
  const active = useInView(ref, { once: true, margin: "0px 0px -33% 0px" })

  return (
    <li ref={ref} className="border-t border-border py-6 sm:py-7">
      <div
        className={cn(
          "grid gap-2 transition-opacity duration-(--motion-cinematic) ease-(--motion-ease-cinematic) motion-reduce:transition-none sm:grid-cols-[11rem_1fr] sm:gap-10",
          active ? "opacity-100" : "md:opacity-30",
        )}
      >
        <div className="flex items-baseline gap-3">
          <span className="display text-xl text-accent-foreground tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-base font-semibold tracking-tight">{stage.name}</h3>
        </div>
        <p className="max-w-md leading-relaxed text-muted-foreground">{stage.sentence}</p>
      </div>
    </li>
  )
}

/*
  Five stages, as a sequence and nothing more.

  Each stage used to carry a small mock panel — status badges, a file list, a
  comment, version chips. Those were miniatures of the product, and they now sit
  one section below the real thing: the same UI at a fraction of the fidelity,
  inviting a comparison they cannot win. The copy was never the weak part, so
  the panels go and the copy stays.

  It stays a vertical list rather than becoming a grid because these are ordered
  stages. A grid would read as five features you could take in any order, which
  is the one thing this section exists to say they are not.

  The stages sit at their natural height. They used to stand 30svh apart so a
  centre-tracking highlight had room to travel, which made six words a stage
  the longest section on the page.
*/
export function Workflow() {
  return (
    <section id={SECTIONS.workflow} className="relative py-24 sm:py-32">
      <div className="shell">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="display max-w-xl text-[clamp(2rem,4.4vw,3.25rem)]">
              Everything your content becomes, in one place.
            </h2>
          </Reveal>

          <ol className="mt-10">
            {STAGES.map((stage, index) => (
              <Stage key={stage.name} index={index} stage={stage} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
