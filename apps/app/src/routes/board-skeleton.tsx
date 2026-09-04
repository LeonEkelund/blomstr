import { Skeleton } from "@/components/ui/skeleton"
import type { BoardColumn } from "@/hooks/use-board"

/*
  Geometry is copied from the real Card deliberately — same padding, same line
  heights, same gaps — so the board does not reflow when the query lands. A
  skeleton that changes size on resolve is worse than no skeleton at all.
*/

/** Uneven on purpose: equal-length rows read as a table, not as content. */
const TITLE_WIDTHS = ["w-[88%]", "w-[64%]", "w-[76%]", "w-[92%]", "w-[58%]"]

/**
 * The whole ghost board, computed once.
 *
 * Built up front rather than in the render so each placeholder has a stable
 * identity — these never reorder, and deriving keys from loop indices would be
 * claiming otherwise.
 */
const GHOST_COLUMNS = [3, 2, 3, 1].map((cardCount, columnIndex) => ({
  key: `ghost-column-${columnIndex}`,
  delay: `${columnIndex * 90}ms`,
  cards: Array.from({ length: cardCount }, (_, cardIndex) => {
    const seed = columnIndex + cardIndex
    return {
      key: `ghost-card-${columnIndex}-${cardIndex}`,
      width: TITLE_WIDTHS[seed % TITLE_WIDTHS.length] ?? "w-[80%]",
      twoLine: seed % 3 === 0,
      // One delay per card, so each pulses as a unit and the columns ripple
      // left to right. Independent pulses per shape look like noise.
      delay: `${seed * 90}ms`,
    }
  }),
}))

/*
  A title and nothing else, because that is what most cards are.

  The badge row, avatars and date only appear once a project has a type,
  someone assigned, or a date — none of which a new one has. Ghosting them
  anyway made every placeholder about twice the height of the real card, so
  the board visibly collapsed when the query landed.

  Matching the *minimum* is the safer error: content settling downward reads
  as loading, content snapping upward reads as a glitch.
*/
function GhostCard({
  width,
  twoLine,
  delay,
}: {
  width: string
  twoLine: boolean
  delay: string
}) {
  const style = { animationDelay: delay }

  return (
    <div className="rounded-lg border bg-card p-3">
      <Skeleton className={`h-3.5 rounded-sm ${width}`} style={style} />
      {twoLine && <Skeleton className="mt-1.5 h-3.5 w-[45%] rounded-sm" style={style} />}
    </div>
  )
}

/**
 * Shown while the board's queries resolve.
 *
 * Stages and items load separately, so column headers are real as soon as the
 * stages arrive and only the cards stay ghosted. Before that there is nothing
 * to name, and the headers are ghosted too.
 */
export function BoardSkeleton({ columns }: { columns: BoardColumn[] }) {
  return (
    <div className="flex-1 snap-x snap-mandatory scroll-px-4 overflow-x-auto sm:snap-none sm:p-6">
      <div className="flex h-full gap-3 pl-4 sm:gap-4 sm:pl-0">
        {GHOST_COLUMNS.map((ghost, index) => {
          const stage = columns[index]?.stage

          return (
            <section
              key={ghost.key}
              className="flex w-[calc(100vw-2rem)] shrink-0 snap-center flex-col sm:w-72 sm:snap-start"
            >
              {/*
                Same classes as the real column header, and the ghosted variant
                sits in the same 20px line box — otherwise the cards below shift
                a few pixels the moment the stages arrive.
              */}
              <header className="flex items-center gap-2 px-1 pb-3">
                {stage ? (
                  <>
                    <h2 className="text-sm font-medium">{stage.name}</h2>
                    <Skeleton className="h-3 w-3 rounded-sm" />
                  </>
                ) : (
                  <span className="flex h-5 items-center">
                    <Skeleton
                      className="h-3.5 w-20 rounded-sm"
                      style={{ animationDelay: ghost.delay }}
                    />
                  </span>
                )}
              </header>

              <div className="flex flex-col gap-2">
                {ghost.cards.map((card) => (
                  <GhostCard
                    key={card.key}
                    width={card.width}
                    twoLine={card.twoLine}
                    delay={card.delay}
                  />
                ))}
              </div>
            </section>
          )
        })}
        <div aria-hidden className="w-1 shrink-0 sm:hidden" />
      </div>
    </div>
  )
}
