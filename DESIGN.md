# Design

How the blomstr interface is put together, and why. Two audiences: whoever
changes the app next, and the landing page, which should look like it belongs
to the same product.

Direction: Linear and Apple. A working content studio, not a dashboard of
interchangeable cards.

Source of truth is `apps/app/src/index.css`. Everything below is transcribed
from it — if the two disagree, the CSS wins.

---

## Tokens

Copy-pasteable. Tokens marked **app-only** depend on app surfaces and can be
dropped from a landing page; everything else is portable.

```css
:root {
  color-scheme: light;

  /* Canvas and content */
  --background: #ffffff;
  --foreground: #222326;
  --card: #ffffff;
  --popover: #ffffff;

  /* Secondary surfaces */
  --secondary: #f0f1f3;
  --secondary-foreground: #42454d;
  --muted: #f5f5f7;
  --muted-foreground: #666a73;

  /* Brand */
  --primary: #49c470;
  --primary-foreground: #102c19;
  --accent: #eaf6ee;
  --accent-foreground: #216438;
  --ring: #248744;

  /* Lines and fields */
  --border: #e7e8ec;
  --input: #c9cbd2;
  --destructive: #b83434;

  /* Shape */
  --radius: 0.75rem;

  /* Elevation */
  --shadow-color: 16 24 40;

  /* Motion */
  --motion-quick: 150ms;
  --motion-standard: 180ms;
  --motion-panel: 200ms;
  --motion-ease: cubic-bezier(0.2, 0.8, 0.2, 1);

  /* Data viz */
  --chart-1: #248744;
  --chart-2: #6aab80;
  --chart-3: #66879a;
  --chart-4: #ba985c;
  --chart-5: #967ca8;

  /* app-only */
  --sidebar: #f8f9fb;
  --sidebar-accent: #edeef2;
  --board-canvas: #f7f8fa;
}

.dark {
  color-scheme: dark;

  --background: #151619;
  --foreground: #edeef0;
  --card: #1c1d21;
  --popover: #25262c;

  --secondary: #2a2b31;
  --secondary-foreground: #e0e1e6;
  --muted: #222329;
  --muted-foreground: #a0a2ae;

  --primary: #49c470;          /* unchanged across themes */
  --accent: #20382a;
  --accent-foreground: #86dca2;
  --ring: #49c470;

  --border: #2d2e35;
  --input: #494b55;
  --destructive: #ff9393;

  --shadow-color: 0 0 0;

  --chart-1: #49c470;
  --chart-2: #8ed7a4;
  --chart-3: #83aec2;
  --chart-4: #d4b578;
  --chart-5: #b39aca;

  /* app-only */
  --sidebar: #191a1e;
  --sidebar-accent: #2a2b32;
  --board-canvas: var(--background);
}
```

Note `--primary` is the same green in both themes; only `--ring` and `--accent`
shift. `--foreground`, `--card-foreground`, `--popover-foreground` and
`--sidebar-foreground` all resolve to the same ink.

---

## Color

The palette is **neutral**. Greys are true greys in both themes — not tinted
toward the brand green. A green-tinted interface makes the accent invisible by
making everything slightly accented.

Green (`#49C470`) has a narrow, enforced meaning:

| Use | Token |
| --- | --- |
| Focus, on controls without a caret | `--ring` on `:focus-visible` |
| Active editing | 1px ring on an inline rename input |
| System feedback | board drop indicator |
| Primary action | filled primary button |

### Text fields focus neutral

Buttons, links, badges and cards get the green focus ring. **Text inputs and
textareas do not** — they focus to a near-foreground border
(`border-foreground/70`) with a faint neutral halo.

This is not an inconsistency. A text field is the only focusable element that
already indicates focus by itself: the caret, which is tinted `--ring`. A
saturated halo on top of a blinking caret is redundant, and it fires on every
single field click — the highest-frequency, lowest-stakes state in the app.
Near-foreground also out-contrasts the green it replaced against both themes,
so it is a *stronger* focus signal, not a weaker one.

Inline rename inputs keep a 1px `ring-ring`, because there the ring delineates
an edit region that has no border of its own, and signals a mode change rather
than mere focus.

### Area, not just placement

Green is rationed by **how much surface it covers**, not only by where it is
allowed. A 1px hairline and a 350px filled button are not the same amount of
green even though both are legal above. One saturated element per screen is the
budget — normally the primary action. Anything else green should be hairline-
scale.

It is **not** used for hover. Hover is the cheapest state in the interface and
has not earned the accent — spending green there dilutes the four uses above,
and on the board it made keyboard focus nearly indistinguishable from a passing
cursor. Hover is a neutral tonal shift: a border darkening toward
`--foreground/20`, or a `--muted` fill.

Green-tinted dark inks (`#102c19`) are correct where they are ink *on* a green
surface — `--primary-foreground`, avatar initials. Not a leftover.

**For the landing page:** a marketing page can spend green more freely than the
app can — the app rations it because it needs green to mean "focus" all day.
Keep the neutrals as they are, though; that is what makes the green read.

---

## Elevation

One shadow color for the system, `--shadow-color`, expressed as bare RGB
channels so it can be used at any opacity:

```css
box-shadow: 0 1px 2px rgb(var(--shadow-color) / 5%);
```

Light is `16 24 40`, a neutral blue-grey — pure black goes muddy over light
grey, and a green-tinted shadow pulls every overlay warm against neutral
chrome. Dark is `0 0 0`, because the blue-grey washes out on a dark canvas.

The two shadows in use:

```css
/* Resting object on a surface */
box-shadow: 0 1px 2px rgb(var(--shadow-color) / 5%);
/* Same object, hovered */
box-shadow: 0 2px 6px -1px rgb(var(--shadow-color) / 8%);
/* Overlay (popover, dropdown) */
box-shadow:
  0 12px 40px -12px rgb(var(--shadow-color) / 18%),
  0 2px 6px rgb(var(--shadow-color) / 5%);
```

The rule for *whether* to cast one:

> Shadow means an object sits above a surface. It is never decoration.

Overlays and objects you manipulate get one — board cards, the selected pill in
a segmented control. A primary button and an avatar do not: nothing is beneath
them, and the shadows they used to carry were decoration inherited from the
previous design. Dark mode drops the board-card shadow entirely; on a dark
canvas a shadow reads as smudge, so the tonal step carries it instead.

---

## Flat versus raised

The split is by *what the surface is for*. This is the thing most likely to be
got wrong:

- **Things you read** — lists, settings, home, project pages. Flat. Hairline
  rules, no card fill, no shadow. `--background` and `--card` are both
  `#ffffff` in light mode, so a `bg-card` panel is defined by its border
  alone. This is deliberate, not an oversight.
- **Things you manipulate** — the board. Cards must read as objects on a
  canvas because you drag them. `--board-canvas` provides the tonal step.

The board's step runs **opposite directions per theme**. Light darkens the
canvas beneath white cards. Dark leaves the canvas at `--background` and lets
`--card` sit lighter. Tinting dark the same way as light would invert the
relationship and make the canvas lighter than the cards.

---

## Type

Geist Variable, with a restrained hierarchy.

```css
body {
  font-feature-settings: "cv11", "ss01";
  -webkit-font-smoothing: antialiased;
}

.page-title {
  font-size: clamp(1.375rem, 2.5vw, 1.75rem);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.035em;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: -0.02em;
}

/* Supporting copy under a page title */
.page-intro p {
  max-width: 65ch;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--muted-foreground);
}
```

Headings are `--font-heading`, which resolves to the same Geist stack. Body
sizes stay in a 13/14/16px band; 28px is the ceiling in-app. A landing page can
go larger, but keep the negative tracking — it tightens as size grows
(`-0.02em` at 16px, `-0.035em` at 28px, and further beyond that).

Uppercase micro-labels with wide tracking were removed during the refresh.
Don't reintroduce them.

---

## Shape

`--radius` is `0.75rem` and the scale is multiplicative:

| Class | Value |
| --- | --- |
| `rounded-sm` | `calc(var(--radius) * 0.6)` |
| `rounded-md` | `calc(var(--radius) * 0.8)` |
| `rounded-lg` | `var(--radius)` — **the default** |
| `rounded-xl` | `calc(var(--radius) * 1.4)` |
| `rounded-2xl` | `calc(var(--radius) * 1.8)` |

`rounded-lg` is the default for cards, panels and inputs. `rounded-xl` and
above are not used on app surfaces — they read soft and consumer-ish against
this palette.

---

## Motion

```css
--motion-quick: 150ms;      /* hover, color, small state changes */
--motion-standard: 180ms;   /* buttons, inputs, controls */
--motion-panel: 200ms;      /* panels and drawers */
--motion-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
```

First-paint fallbacks; `MotionProvider` syncs them from `lib/motion.ts` at
runtime. `prefers-reduced-motion` is honored globally — anything added must
stay inside that guard.

The shared tab movement is the signature interaction. Don't add competing
entrance animations.

---

## Base treatments

Portable, and worth carrying to the landing page — these are most of what makes
it feel considered:

```css
:where(a, button):focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}

::selection {
  background: var(--accent);
  color: var(--accent-foreground);
}

input, textarea { caret-color: var(--ring); }

html {
  scrollbar-color: var(--input) transparent;
  scrollbar-width: thin;
}
```

---

## Layout

Shared classes give every page one left edge and one vertical rhythm. Use these
rather than re-specifying padding per route.

| Class | Max width |
| --- | --- |
| `.page-shell` | 72rem |
| `.settings-shell` | 60rem |
| `.project-shell` | 68rem |

```css
padding: 2.5rem clamp(1rem, 4vw, 3rem) 4rem;   /* 1.5rem top under 640px */
```

Supporting: `.page-intro` (title plus one-line description), `.settings-section`
(label column beside content, stacking under 768px), `.page-scroll` (the scroll
container).

### Chrome

Headers and toolbars are `bg-background` with a hairline bottom border, not a
translucent card fill. Adjacent chrome shares a rule — the project header, tab
bar and review panel header all line up at `h-14`.

The sidebar is the one surface tonally separate from the canvas. In light mode
it is the *only* thing separating chrome from content, since `--background` and
`--card` are both white.

---

## Constraints

- The kanban's layout, card composition and drag-and-drop wiring are settled.
  Restyle freely; do not restructure.
- Preserve workflows, permissions and responsive support. Mobile keeps its
  drawer; the desktop inspector is secondary.
- Green, Geist and the flower identity are fixed.
