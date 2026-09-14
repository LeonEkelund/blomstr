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
  Five stages, as a sequence and nothing more.

  Each stage used to carry a small mock panel — status badges, a file list, a
  comment, version chips. Those were miniatures of the product, and they now sit
  one section below the real thing: the same UI at a fraction of the fidelity,
  inviting a comparison they cannot win. The copy was never the weak part, so
  the panels go and the copy stays.

  It stays a vertical list rather than becoming a grid because these are ordered
  stages. A grid would read as five features you could take in any order, which
  is the one thing this section exists to say they are not.

  Still not a finished section: the intent is to rebuild it around the product
  preview, one real view per stage. These names and sentences are what would
  label that, so nothing here is wasted in the meantime.
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
              <li
                key={stage.name}
                className="grid gap-2 border-t border-border py-7 sm:grid-cols-[11rem_1fr] sm:gap-10"
              >
                <div className="flex items-baseline gap-3">
                  <span className="display text-xl text-accent-foreground tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-base font-semibold tracking-tight">{stage.name}</h3>
                </div>
                <p className="max-w-md leading-relaxed text-muted-foreground">
                  {stage.sentence}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
