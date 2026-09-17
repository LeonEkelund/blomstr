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
  One stage, lit while the reader is on it.

  The band is a thin strip across the middle of the viewport — everything above
  and below is dimmed, so the lit stage is wherever the reader's eye already
  is. It reads as moving *through* a sequence rather than skimming a list,
  which is the one thing these five words are here to say.

  The dimming is desktop-only. On a phone two or three stages fill the screen
  at once and there is no meaningful "where you are"; dimming there just makes
  two thirds of the section hard to read.

  Only the content dims, never the rule above it. Fading the hairlines in and
  out turns the structure of the list into part of the animation, and the list
  stops looking like a list.
*/
function Stage({ index, stage }: { index: number; stage: (typeof STAGES)[number] }) {
  const ref = useRef<HTMLLIElement>(null)
  /*
    A hairline across the middle of the viewport, not a band.

    `useInView` fires when any part of the element touches the root, and a
    stage is taller than a generous band is — so at -42% two neighbours both
    qualified and two stages lit at once, which defeats the whole point. At
    -49% the root is a couple of pixels tall: exactly one stage can straddle
    it, except for the instant a boundary crosses, which crossfades.

    Not -50%: that collapses the root to zero height, and a root with no area
    never intersects anything.
  */
  const active = useInView(ref, { margin: "-49% 0px -49% 0px" })

  return (
    <li
      ref={ref}
      className="border-t border-border py-10 md:flex md:min-h-[30svh] md:flex-col md:justify-center md:py-0"
    >
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

  The stages stand 30svh apart on desktop, which is the cost of the effect above
  it: a highlight tracking the reader's position needs somewhere to travel, and
  five rows that all fit on one screen never dim relative to each other.

  30 and not more. The obvious move is to give each stage half a screen, but
  each one is six words and a single sentence — at that height the space around
  them stops reading as composure and starts reading as a section that never
  got finished. Fora can afford it because their equivalent block is full
  paragraphs.
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

          <ol className="mt-14">
            {STAGES.map((stage, index) => (
              <Stage key={stage.name} index={index} stage={stage} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
