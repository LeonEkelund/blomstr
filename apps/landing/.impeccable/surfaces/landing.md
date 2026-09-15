# Landing page (apps/landing)

Mode: Persuade. The marketing site at `apps/landing`, separate Vite app from
`apps/app`. Refinement of an incumbent build, not a replacement world: the
Aurelia flower, the section order and the copy are the work so far, and they
are evidence, not a first draft to discard.

Pinned and not open for redirection: the name Blomstr, the flower mark, primary
green #49C470, Geist for UI and Instrument Serif for display. `DESIGN.md` at
the repo root is the shared design system and the landing page's tokens are a
deliberate verbatim copy of it — if the palette moves, it moves in both.

## Direction contract

THESIS: One approval pass, not forty Discord messages. The page owns the
coordination cost of a creator team, and refuses the category default of a
feature grid over a gradient — every section is evidence that the loop closes,
not a list of capabilities.

OWN-WORLD: True neutrals, never tinted toward the brand. Green is rationed by
area: one saturated element per screen, normally the primary action; anything
else green is hairline-scale. Flat for things you read — hairline rules, no
card fill, no shadow — and elevation only for things that sit above a surface.
One shadow colour, `--shadow-color`, neutral blue-grey in light and black in
dark. `rounded-lg` (0.75rem) is the ceiling for product-shaped surfaces.
Negative tracking tightens as type grows. No uppercase micro-labels.

STORY: A creator with a team of two to ten arrives knowing approvals are
scattered and slow. They understand within one viewport that everything one
video becomes — clips, thumbnails, posts — gets reviewed in one place, believe
it because the page shows the mechanism rather than asserting it, and join the
waitlist. Publishing is preparation only; the page must never imply automatic
posting.

FIRST VIEWPORT: The Aurelia bloom at rest, holding the frame, with the hook in
one line and the primary action visible without scrolling. The flower is the
signature interaction and the page's one piece of spectacle: it folds and
opens against the workflow track and turns continuously with scroll
(`spinTurnsPerViewport`), and it is the thing a visitor would describe an hour
later. Everything else recedes to hairlines and type.

FORM: Incumbent build, user-pinned. No direction round was run and there is no
seed key for this surface — the Linear/Apple canon pinned for the product in
`.impeccable/surfaces/sitewide-refresh.md` governs here too, translated up to
marketing scale: larger type, more air, the same restraint. Treat a conflict
between that canon and category habit as resolved in favour of the canon.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Known weak points

Named so a review confirms or dismisses them rather than rediscovering them:

- The closing CTA was full-bleed green with a green button on it. It is now
  neutral (`--deep`), with a masked grid of the logo mark. Whether the section
  still lands as a close is open.
- The hero depends on a ~4 MB GLB plus a ~520 kB scene chunk. A
  `.webp` still stands in until the scene is ready. First-paint cost on a cold
  mobile connection is untested.
- `apps/landing/README.md` calls for `vite-react-ssg` prerendering, because
  social crawlers do not execute JS. It is not installed, so shared links have
  no preview card.
- `aurelia-model.ts` has two unused private fields (`baseAngle`, `step`) that
  fail `tsc`, so `pnpm build` and CI are red. Not a design defect, but it
  blocks a clean verification run.

Rollback checkpoint: 30aba19. Working tree is clean at the time of writing.
