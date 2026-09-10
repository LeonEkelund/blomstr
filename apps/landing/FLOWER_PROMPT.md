# Blomstr 3D flower — creative and implementation brief

This document defines the signature 3D flower for the Blomstr landing page. It
is a design and implementation specification only. Do not begin implementation,
install packages or change application code until explicitly requested.

Read `PROMPT.md` in this directory before implementing. The flower must use the
same botanical-green colour family and design tokens as the application. All
eventual colour, shadow, timing and layout tokens belong in the existing
`apps/app/src/index.css` root globals.

## Objective

Create a memorable, premium digital flower that represents an idea growing into
finished content. It is the landing page's signature brand object and the visual
thread connecting the five Blomstr workflow stages:

1. Plan
2. Create
3. Review
4. Approve
5. Publish

The result should feel sculptural, elegant and technologically precise. Combine
Apple-like material depth and polish with Linear-like restraint and clarity. It
must not look like a realistic stock flower, a game asset, a plastic toy, a
generic 3D render or a decorative object unrelated to the product.

## Core visual concept

Build an abstract bloom from five primary petals arranged around a compact
centre. Each primary petal represents one workflow stage. The flower begins as
a tightly folded bud and opens progressively as the visitor scrolls through the
workflow story. At the end, all five petals form one balanced, complete bloom.

The silhouette should be recognisable as a flower without copying a particular
species. Use slightly asymmetric organic forms held together by a precise radial
system. It should feel designed rather than mathematically perfect.

Preferred presentation:

- A floating bloom without a visible flowerpot or literal garden scene.
- A very short, abstract base or receptacle may anchor the petals.
- No long stem in the hero unless composition testing proves it improves the
  silhouette.
- Viewed from a three-quarter angle rather than directly from the front.
- Large enough to reveal material and lighting detail, with breathing room
  around the silhouette.
- Partially overlapping the hero's negative space, never its primary text.

## Geometry

Prefer procedural geometry so the petals can be art-directed and animated
independently. A downloaded GLB is not required for the first version.

### Primary petals

- Create five separate petal meshes with independent pivot groups positioned at
  their bases.
- Give each petal a tapered base, wider middle and softly rounded or lightly
  pointed tip.
- Build real curvature: a shallow central ridge, edges that turn slightly
  forward and a tip that curls away from the centre.
- Give petals physical thickness. Do not use perfectly flat transparent planes.
- Use enough subdivisions for smooth bending while keeping the vertex count
  modest.
- Vary scale, curl, rotation and lateral lean by a small amount between petals.
  The variations should be visible subconsciously, not appear random.
- Avoid intersections in the fully open state. Controlled overlap is desirable
  while the flower is closed.
- Keep the outer silhouette clean at every animation stage.

### Inner structure

- Add a small inner ring of two or three shorter forms to create depth between
  the centre and primary petals. These can be simplified petals or folded
  leaf-like shapes.
- Build a compact central receptacle using an organic rounded form, not a perfect
  sphere.
- Add a restrained cluster of tiny centre elements only if it remains readable
  and performant. Avoid literal stamens that make the flower feel botanical or
  photorealistic.
- The centre should visually connect the petal bases and hide unavoidable mesh
  intersections.

### Edge and surface detail

- Petal thickness and silhouette should carry most of the detail.
- Introduce very subtle surface variation through geometry, normals or a tiny
  procedural roughness variation.
- Optional faint vein lines may travel from base to tip, but they must look like
  internal light paths rather than realistic plant veins.
- Do not use large photographic textures, visible noise or exaggerated bumps.

## Material direction

### Chosen material: frosted translucent botanical resin

Use a physically based translucent material that sits between glass, resin and
a living petal. The petal should transmit light without becoming invisible.
Fully clear glass is not suitable because it loses its silhouette on a light
page; a fully opaque material loses the luminous depth that makes the object
special.

Use `MeshPhysicalMaterial` or the closest current Three.js physical-material
equivalent. Treat these as visual starting ranges, not immutable values:

```text
base color:        existing Blomstr botanical green, with slight per-petal variation
metalness:         0.0
roughness:         0.22–0.38
transmission:      0.45–0.70
thickness:         0.25–0.65, calibrated to the scene scale
ior:               1.32–1.42
clearcoat:         0.15–0.35
clearcoat roughness: 0.18–0.32
attenuation color: pale botanical green
attenuation distance: tuned so overlapping petals deepen in colour
iridescence:       0.04–0.12
dispersion:        0–0.04, preferably disabled unless almost imperceptible
opacity:           1.0; use physical transmission rather than simple alpha
```

These settings should produce:

- A readable green body colour in the middle of each petal.
- Brighter translucent edges where the form becomes thin.
- Deeper green where folded or overlapping petals accumulate material.
- Broad, soft specular highlights that move as the flower turns.
- A barely perceptible colour shift at grazing angles, never a rainbow effect.

Do not make the flower chrome, glossy acrylic, soap-bubble iridescent or crystal
clear. Iridescence and dispersion are seasoning, not the main effect.

### Centre material

The centre should contrast with the petals through opacity and texture:

- Use a deep forest green from the existing palette.
- Prefer a satin, ceramic or velvet-like physical surface.
- Use zero metalness and moderate roughness, approximately `0.42–0.60`.
- Add only a tiny emissive contribution if necessary to prevent the centre from
  becoming dead black. It must not visibly glow like a lamp.
- Optional small pale-green highlights can visually tie it to the petal edges.

### Material quality rules

- Use an environment map or generated studio environment so transmission and
  reflections have something meaningful to reveal.
- Maintain correct colour management and display output.
- Avoid simple `opacity` as the main translucency technique.
- Avoid stacking too many transparent surfaces in the same depth plane.
- Test against both the light hero canvas and any deep-green transition section.
- The material must still look intentional when the flower stops moving.

## Lighting — critical art direction

Lighting is as important as geometry. Build a small virtual product-photography
studio around the flower. The goal is luminous depth, readable folds and a
premium silhouette, not general brightness.

### Environment

- Use a subtle studio environment for soft reflections and transmitted light.
- Keep the environment itself invisible so the WebGL canvas can composite over
  the page background.
- Prefer large soft sources and smooth gradients over many small bright points.
- Avoid a recognisable outdoor HDRI, room reflections or high-frequency scenery
  appearing in the petals.

### Key light

- Place a large, soft, neutral-to-warm key above and to the front-left.
- This is the dominant source and should create one broad highlight travelling
  across the petal curvature.
- Angle it so the centre ridge and curled tips remain legible.
- The key must not flatten every petal with equal illumination.

### Botanical rim light

- Place a narrower light behind and to the right of the flower.
- Tint it with a restrained lighter botanical green from the existing palette.
- Use it to trace the outer petal edges and separate the bloom from the canvas.
- Let the rim become slightly stronger during the final opening stage.
- Do not allow it to create a neon-green halo around the entire object.

### Fill light

- Add a very soft, low-intensity neutral fill from the front or lower-left.
- It should preserve information in folded petals without eliminating contrast.
- The inner creases must remain deeper than the outer petal faces.

### Top or centre accent

- An optional soft top light may catch the inner ring and centre.
- Keep it tightly controlled so it does not look like a spotlight on a stage.
- If a tiny emissive centre is used, balance it against this light rather than
  allowing either effect to dominate.

### Shadows and contact

- The bloom may cast a broad, soft shadow onto an invisible or softly tonal
  receiving plane below or behind it.
- The shadow should anchor the object while preserving the impression that it
  floats.
- Use a soft elliptical contact shadow or a tightly framed shadow-casting light
  if full dynamic shadows are unnecessarily expensive.
- Keep shadow opacity low and subtly green-neutral rather than pure black.
- Only necessary lights should cast shadows; do not enable shadows everywhere.

### Tone and rendering

- Use filmic tone mapping and tune exposure by eye against the actual page.
- Preserve highlight detail; no large clipped white patches on the petals.
- Keep blacks open enough to reveal the inner fold structure.
- Render lighting calculations in the correct linear working space and display
  the final canvas in the appropriate screen colour space.
- Avoid heavy bloom post-processing. If bloom is used, restrict it to the
  brightest edge accents and keep it nearly subliminal.
- A gentle vignette may be created through page composition or lighting, but do
  not add a dark photographic vignette over the hero.

## Colour behaviour

Use the application's current root colour tokens as the source of truth. Do not
invent blue, pink or purple accents for the 3D scene.

- Petal body: primary botanical green.
- Thin edges and transmitted highlights: pale green approaching neutral white.
- Overlaps and deep folds: forest green.
- Centre: deepest green with a satin finish.
- Reflections: mostly neutral with restrained green influence.
- Background: the application's light canvas, with optional soft tonal pools
  created from existing colours.

Small per-petal variations may help depth, but the bloom must read as one object.
Do not assign a different colour to each workflow stage.

## Camera and composition

- Use a perspective camera with a natural product-photography feel; avoid wide
  angle distortion.
- Start around a `30–40°` field of view and adjust to the final layout.
- Present the bloom from slightly above and off-axis so both the centre and petal
  thickness are visible.
- Keep the camera mostly stable. Animate the flower more than the camera.
- A very small camera drift or parallax is allowed, but the user should never
  feel as though they are orbiting a game object.
- Reserve empty space for the hero copy and CTAs at every desktop breakpoint.
- Avoid cropping petal tips accidentally. Intentional edge-breaking may be used
  only at large viewport sizes when it improves scale.

The default hero pose should look composed in a still screenshot. Motion is an
enhancement, not a requirement for the composition to work.

## Opening animation and scroll narrative

Use one normalized progress value from `0` to `1` to drive the complete flower
story. Smooth incoming scroll progress before applying it to the model so the
petals feel physical rather than attached directly to the scrollbar.

### Stage 0 — dormant bud

- Primary petals fold inward and overlap around the centre.
- The bloom is compact but still recognisable as the same object.
- Lighting is subdued, with a narrow rim and deeper internal shadows.
- Add a very slow breathing movement of only a few pixels/degrees.

### Stage 1 — Plan

- The first petal loosens and tilts outward.
- A soft highlight travels from its base toward its tip.
- The flower rotates only enough to present that petal clearly.

### Stage 2 — Create

- The second petal opens with slightly more energy.
- Inner forms expand enough to reveal the centre.
- Material transmission becomes more apparent as light begins passing between
  separated petals.

### Stage 3 — Review

- The third petal opens while the existing petals settle into balance.
- Use a restrained light sweep or focus shift to suggest inspection, without
  imitating a scanner.

### Stage 4 — Approve

- The fourth petal opens into a confident, stable composition.
- The centre receives a small increase in light and clarity.
- Avoid celebratory particles or checkmark symbolism.

### Stage 5 — Publish

- The fifth petal completes the bloom.
- Petals settle with a subtle spring and tiny secondary tip movement.
- The rim light becomes slightly brighter and the completed silhouette feels
  open, balanced and calm.
- A very small number of dust-like light particles may drift outward once, then
  disappear. Do not create confetti.

Each stage should be reversible when scrolling upward. Avoid discontinuous cuts,
petal snapping or animations that continue fighting the user's scroll position.

## Idle and pointer interaction

When scroll is stationary:

- Apply an extremely slow breathing motion to petal tips and the whole bloom.
- Add a tiny rotational drift with long, irregular timing.
- Keep movement small enough that the headline remains the dominant focus.

On pointer-capable desktop devices:

- Map cursor position to a small, damped flower rotation or lighting response.
- Nearby movement may lift the closest petal by a very small amount.
- Return smoothly to the composed pose when the pointer leaves.
- Do not implement unrestricted orbit controls, drag rotation or zoom.
- Pointer input must never override the current scroll-stage pose.

Disable pointer response on touch devices and when reduced motion is requested.

## Relationship to page content

- The hero headline and calls to action must remain normal accessible HTML.
- The WebGL canvas is decorative and should not capture keyboard focus.
- Product copy explains the workflow; the flower emotionally reinforces it.
- As each workflow section becomes active, coordinate the relevant petal with a
  subtle lighting change rather than a label floating inside the 3D scene.
- Do not render essential text, buttons, step names or status information inside
  WebGL.
- The flower must never reduce text contrast or block interaction.

## Loading experience

- Render the hero copy immediately without waiting for Three.js.
- Reserve the flower's layout space to prevent cumulative layout shift.
- Initially show an optimized SVG or raster image of the completed flower.
- Fade or optically match the live canvas over the fallback only after the first
  stable frame is ready.
- Do not show a percentage loader, spinner or blank rectangle in the hero.
- If initialization fails, keep the fallback permanently and leave the rest of
  the page fully functional.

## Mobile version

Mobile is an art-directed simplification, not the full desktop scene squeezed
into a smaller canvas.

- Reduce geometry subdivisions, shadow resolution and renderer pixel ratio.
- Remove pointer interaction, particles and unnecessary post-processing.
- Use a simpler camera angle with a clean, immediately readable silhouette.
- Reduce or eliminate pinned-scroll duration so the visitor is not trapped in a
  long animation sequence.
- Allow stage changes through subtle petal poses, or use the completed static
  fallback on lower-powered devices.
- Keep the model away from navigation, headline and CTA touch targets.
- Test portrait screens with limited vertical height, not only large phones.

## Reduced motion and accessibility

When `prefers-reduced-motion: reduce` is active:

- Show the flower already open in its final composed pose.
- Disable breathing, cursor response, parallax, particles and scroll-driven petal
  movement.
- A short opacity transition is acceptable only if the user's settings permit
  it and it does not interfere with reading.

The flower is decorative. Hide the canvas from assistive technology unless it
later communicates unique information unavailable in nearby text. All foreground
content must retain accessible contrast independent of the 3D lighting.

## Performance budget and lifecycle

- Lazy-load the Three.js implementation after critical hero HTML is available.
- Prefer one renderer, one scene and a small number of shared materials.
- Keep the initial flower comfortably below approximately `50k` rendered
  triangles; target substantially less if the silhouette remains smooth.
- Cap device pixel ratio, approximately `1.5–2` on desktop and `1–1.5` on mobile,
  based on measured performance.
- Avoid large texture downloads. Prefer procedural colour and roughness.
- Use compressed assets if a GLB or environment texture is introduced later.
- Pause the render loop when the flower is outside the viewport, the tab is
  hidden or no animation requires another frame.
- Render on demand where possible instead of maintaining an unconditional
  60-fps loop.
- Dispose of geometries, materials, textures, render targets and listeners when
  the scene unmounts.
- Limit shadow casters and tightly frame shadow cameras.
- Measure on a real mid-range mobile device before increasing visual complexity.
- The landing page must remain usable if WebGL is unavailable.

## Implementation direction

- Use the repository's existing React and Vite application.
- Use Three.js for the 3D scene when implementation is authorized.
- Use the existing Motion package for page-level scroll progress, orchestration
  and reduced-motion integration where appropriate.
- Do not install multiple competing animation or 3D frameworks.
- Keep scene construction, flower pose calculation and page orchestration in
  separate modules so visual tuning does not entangle the landing route.
- Store tunable artistic values in a clear configuration object or root design
  tokens rather than scattering unexplained numbers through components.
- If a custom shader becomes necessary, first prove that the physical material
  cannot achieve the intended result. Maintain a simpler material fallback.

## Optional GLB path

Only replace procedural geometry with a GLB if the procedural version cannot
reach the desired organic silhouette. Any GLB must meet all of these conditions:

- Every primary petal is a separate named mesh or is properly rigged.
- Each petal has a usable pivot or bone at its base.
- Normals and UVs are clean, and petal thickness is physically represented.
- The model uses a web-friendly polygon count and compressed export.
- Its licence explicitly permits commercial web use.
- Materials can be replaced or controlled by the application.
- It preserves the five-stage opening concept.

Do not download a generic flower and attempt to hide unsuitable topology with
lighting. The motion and silhouette matter more than microscopic detail.

## What to avoid

- Photorealistic flower species or literal nature photography.
- Pink, blue, purple or rainbow accents.
- Clear crystal petals with invisible silhouettes.
- Cheap glossy plastic, chrome or gummy materials.
- Heavy bloom, lens flares, chromatic aberration or deep depth of field.
- Constant spinning, unrestricted orbit controls or aggressive parallax.
- Fast elastic motion, cartoon squash-and-stretch or playful bouncing.
- Large particle clouds, sparkles or magical fantasy effects.
- Visible mesh intersections, z-fighting or broken transparency ordering.
- A generic five-petal icon simply extruded into 3D.
- Animation that delays access to content or hijacks normal scrolling.
- A scene that only looks good on a powerful desktop GPU.

## Acceptance criteria

The flower is ready when all of the following are true:

- It is recognisably Blomstr and visually distinctive in a still image.
- Its five petals clearly support the five workflow stages.
- The closed, intermediate and completed silhouettes all look intentionally
  composed.
- Translucency reveals thickness and overlapping colour without losing form.
- Lighting produces broad highlights, deep readable folds and a controlled green
  rim without clipping or neon glow.
- The flower complements the hero copy rather than competing with it.
- Scroll interaction feels smooth in both directions and never snaps.
- Idle and cursor motion remain subtle and stop when appropriate.
- It works against the real landing-page background at all target breakpoints.
- Mobile performance is smooth on a representative mid-range device.
- Reduced-motion mode shows a polished static composition.
- Loading causes no layout shift and failure falls back gracefully.
- No essential content or interaction depends on WebGL.

## Final creative test

The finished object should make someone pause because it feels beautiful and
unexpected, then immediately understand why a blooming flower belongs to a
creative workflow named Blomstr. It should feel expensive because of proportion,
light, restraint and motion—not because many effects were added.
