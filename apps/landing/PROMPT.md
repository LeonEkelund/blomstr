# Blomstr landing page brief

This is the working creative and technical brief for the public Blomstr landing
page. Nothing in this document authorizes implementation yet.

## Core direction

Blomstr should look like modern SaaS blended with a distinctive botanical
identity: clean and precise first, expressive second. The landing page and app
must feel like the same product. Reuse the app's existing colour system and
visual foundations rather than creating a separate landing-page palette.

- Apple- and Linear-inspired design is a core requirement across the entire
  landing page: Apple-like polish, restraint and material depth combined with
  Linear-like precision, typography, spacing and product-focused clarity. Use
  them as inspiration without directly copying either brand.
- Mostly neutral surfaces with a deep botanical green as the primary colour.
- No pink and no blue in the brand palette.
- Strong spacing, clear hierarchy and restrained detail.
- Glass is reserved for navigation and a few floating surfaces.
- The landing page may be much more expressive than the app through animation,
  depth, shadow, glass, scale and scroll choreography.
- Motion can be bold and memorable, but it must remain intentional and tied to
  the product story rather than becoming constant background movement.
- Product screenshots and the flower provide the visual interest.
- Avoid the generic gradient-heavy startup aesthetic.

The flower should support the product story: content growing from an idea into
something approved and ready to publish. It should not feel like decoration
pasted onto a SaaS template.

## Working message

Hero headline:

> From rough idea to ready to publish.

Supporting copy:

> Plan, create, review and prepare every piece of content with your whole team
> in one place.

Supporting brand line that may be used later in the page:

> One place for everything your content becomes.

Keep the language direct. Botanical language can appear occasionally, but it
must not become overly cute or literal.

Initial conversion actions:

- Primary CTA: **Get started**, linking to `/sign-in`.
- Secondary CTA: **See how it works**, scrolling to the workflow section.

## Signature flower experience

The complete creative and technical specification for this object lives in
`FLOWER_PROMPT.md` in this directory. Treat that file as the source of truth for
the flower's geometry, material, lighting, motion, performance and fallbacks.

The hero should contain one abstract digital flower or bloom. It may look 3D,
but it should be sculptural and slightly translucent rather than photorealistic.

The preferred interaction is a scroll-driven bloom:

1. The hero begins with a compact bud or seed.
2. Petals open progressively as the visitor moves through the workflow.
3. Each stage reveals a product idea: Plan, Create, Review, Approve, Publish.
4. The completed flower remains open when the workflow is complete.

Possible compositions:

- Pin the flower on one side while workflow copy scrolls on the other.
- Give the flower five petals, one for each workflow stage.
- Rotate or open one petal as each section becomes active.
- Add very subtle cursor response on desktop.
- Use a static or simplified completed bloom on mobile.

The flower must not block the headline, reduce readability or turn the site into
a 3D experiment. It is the memorable brand object supporting the product.

### 3D performance rules

- Lazy-load the Three.js scene after the critical hero content.
- Render headlines and calls to action as normal HTML, never inside WebGL.
- Cap pixel density and scene complexity on mobile.
- Provide a static image or SVG fallback when WebGL is unavailable.
- Respect `prefers-reduced-motion` by showing the completed flower without
  scroll or cursor animation.
- Pause rendering while the scene is outside the viewport.
- Avoid large textures and unnecessary post-processing.

## Colour direction

Use the same colours and existing root tokens as the application so moving from
the landing page into Blomstr feels seamless. Do not introduce a competing
brand palette. The landing page earns its stronger personality through richer
lighting, transparency, contrast, dimensional shadows and motion—not through a
different set of brand colours.

Green should still be deliberate rather than washing over every section. The
landing page can use brighter or deeper expressions of existing colours where
needed for light, glow and depth, provided they clearly belong to the current
palette. Final colours, spacing, radii, shadows, glass treatments and motion
values must be defined as shared root globals in `index.css`; components consume
those tokens.

## Visual system

### Typography

- Keep **Geist Variable**, the application's existing typeface, for navigation,
  body copy, buttons, labels and every product-interface element.
- Use **Instrument Serif** as the expressive display typeface for major
  marketing headlines and a small number of short editorial phrases. It is
  contemporary and organic
  enough to support the botanical identity without making Blomstr feel like a
  lifestyle or wedding brand.
- Treat the display face as an accent, not a second general-purpose font. Never
  use it for controls, paragraphs, pricing details or embedded product UI.
- Headlines should be large, tightly tracked and carefully balanced across
  lines. Supporting copy remains compact and highly readable.
- Add the display font when landing-page implementation begins, not during the
  documentation phase. If visual testing shows that it weakens the product
  identity, fall back to Geist exclusively.

### Layout and rhythm

- Use generous whitespace, a strict alignment grid and a strong reading order.
- Prefer a few confident full-width compositions over a long stack of cards.
- Allow intentional asymmetry around the flower and product imagery while text
  remains precisely aligned.
- Alternate quiet, spacious sections with denser product moments so the whole
  page does not compete for attention at once.
- Avoid making every section the same height, width or visual pattern.

### Depth hierarchy

Use three clear levels of depth:

1. Flat or softly tonal page content.
2. Elevated product previews and important editorial imagery.
3. Floating glass controls such as navigation and transient interactions.

Depth must communicate hierarchy. Use glass most strongly for navigation and
controls, not as the background of every content card. Shadows may carry a
subtle green tint and should become softer and broader as elevation increases.

### Motion language

- Use responsive spring motion for controls, menus and direct interactions.
- Use slower, more cinematic transitions for major sections and the flower.
- The scroll-driven bloom is the primary motion event; supporting animations
  should not compete with it.
- Product previews may demonstrate activity through restrained cursor paths,
  comment arrivals, review-state changes or layered panels.
- Hover movement should suggest tactility through small changes in light,
  elevation or scale, never make elements feel loose or unstable.
- Every animation should communicate progression, hierarchy, state or feedback.

### Product presentation

- Use real Blomstr UI and truthful states rather than fake dashboards.
- Present screenshots as dimensional product scenes with thoughtful cropping,
  layered windows, controlled perspective and soft lighting where appropriate.
- Preserve the actual app colours and typography inside every preview.
- Keep enough UI visible to make the workflow understandable; visual styling
  must not turn the product into an unreadable background texture.

### Signature details

Repeat a small visual vocabulary across the page: fine borders, soft highlights,
subtle green-tinted shadows, botanical curves and occasional translucent petal
shapes. These details should make the page recognisably Blomstr without adding a
flower to every section.

### Flower-mark pattern section

Include one section inspired by the precise dot-grid treatments used by Linear
and Vercel, but replace every dot with a very small Blomstr flower mark. From a
distance it should read as a quiet geometric texture; closer inspection should
reveal that the pattern is made from the brand symbol.

- Use a simplified monochrome silhouette or outline of the flower rather than
  repeating the full-colour logo.
- Keep the marks tiny, evenly spaced and aligned to a strict grid.
- Use very low contrast so the pattern supports the section instead of making
  text or product imagery noisy.
- Fade the pattern near its edges with a soft mask so it emerges naturally from
  the page rather than ending in a hard rectangle.
- Allow a restrained interaction, such as nearby flowers brightening, opening
  slightly or lifting as the cursor passes across the grid.
- On scroll, a subtle wave or stagger may travel through the pattern once. It
  should not loop continuously.
- Reduce the number of marks and disable pointer-driven movement on mobile and
  for reduced-motion users.
- Place one strong piece of content over or beside it, such as a concise product
  statement, workflow transition or final CTA. Do not use it as decoration
  behind a dense feature grid.

This is a secondary brand moment. It should complement the main 3D flower rather
than compete with it, and it should use the same flower geometry so both details
feel part of one visual system.

### Responsive art direction

Mobile must be deliberately composed rather than treated as the desktop page
stacked vertically. Simplify the flower and layered perspective, preserve the
strongest product detail, reduce expensive effects and make the full-screen
glass menu the signature mobile moment.

### Initial theme direction

Prefer a predominantly light landing page using the application's existing
colours, interrupted by one or two deep-green cinematic sections for contrast.
Full light/dark theme support is optional and should not dilute the initial art
direction.

## Desktop navigation

Keep the initial navigation focused:

- Product
- How it works
- Log in
- Primary CTA

About and Contact can live in the footer unless they become meaningful pages.
Do not create empty destinations just to make the product appear larger.

If Product later becomes a dropdown, it could contain:

- Projects and planning
- Review and approval
- Creative workspace
- Publishing
- Google Drive

## Mobile navigation

- Use a compact glass navbar with the logo, wordmark and hamburger button.
- Opening the hamburger covers the full screen.
- Keep the underlying page faintly visible through the glass layer.
- Use large, vertically spaced links with a subtle staggered entrance.
- Keep the close button in the same top-right position as the hamburger.
- Place Log in at the bottom as the prominent primary-green CTA, following the
  current concept.
- Respect the device safe area and keep the CTA reachable without scrolling.

## Glass treatment

Do not add a glass UI framework initially. Native CSS should provide the first
version. The landing page can push glass and depth further than the product UI,
especially in navigation, hero controls and layered product previews, using:

- A translucent neutral background.
- Backdrop blur with mild saturation.
- A fine low-contrast border.
- A subtle inner highlight along the top edge.
- Layered, modern shadows that react subtly to elevation and scroll state.
- A more opaque fallback where backdrop blur is unavailable.

Avoid strong refraction behind text. If liquid displacement, glow or more
dramatic lighting is explored later, use it on the decorative bloom or another
nonessential surface as a progressive enhancement. The page may feel visually
ambitious without making the core content difficult to read.

## Proposed page structure

### 1. Hero

Explain what Blomstr is within a few seconds. Include the headline, concise
supporting copy, a primary conversion CTA, a quieter product-tour CTA and the
signature flower. Do not fill the first viewport with badges and small claims.

### 2. Product proof

Do not leave this section blank. Show the real application through small,
code-native React product vignettes based directly on existing Blomstr screens
and workflows. They are presentation components, not a second functional app,
and must only depict capabilities that genuinely exist.

Use the existing UI tokens, components and root values as the visual source
material. Recreate only the minimum visible interface required for each scene so
the landing page remains lightweight. Animate the scenes with the Motion package
already installed; do not introduce Remotion, a video runtime or prerecorded
animation for these interactions.

Possible truthful scenes:

- A polished project overview or calendar moving into its active state.
- A review card receiving a comment and changing approval state.
- A mindmap expanding by one connected node.
- A publishing package revealing its platform copy and approved asset.
- Layered details from Files or Google Drive where they support the story.

Presentation rules:

- Keep text and data concise, believable and clearly illustrative.
- Use restrained entrances, state transitions and cursor movement.
- Make each scene understandable when animation is paused.
- Replace or supplement scenes with real product captures later if useful.
- No fake customer logos or fabricated usage numbers.

### 3. How content blooms

Use the scroll-driven flower to explain:

1. Plan the idea.
2. Create with the team.
3. Review everything in context.
4. Approve the final version.
5. Prepare it for publishing.

Each step gets one short sentence and one relevant product view. Avoid long
feature paragraphs.

### 4. Product capabilities

Use a clean editorial grid for the real workflows already in Blomstr:

- Projects and deadlines
- Mindmaps and notes
- Google Drive files
- Version review and comments
- Approvals and requested changes
- Per-platform publishing packages
- Assignments and notifications

This may borrow the clarity of a SaaS bento grid, but every tile should not use
a different colour or gimmick.

### 5. Collaboration

Show how a creator, editor, designer and guest work around the same project.
Explain responsibilities through the workflow instead of a large permission
matrix.

### 6. Pricing

Do not include a pricing section or pricing navigation item in the initial
landing page while plans and prices are unsettled. Add it later when the offer
is real. Never invent tiers or use artificial placeholder pricing.

### 7. Final CTA

Return to the completed bloom and finish with one confident action. One possible
line:

> Give your content room to grow.

### 8. Footer

Initial links:

- Product
- How it works
- Log in

Do not render About, Contact, Privacy, Terms or social links until real
destinations exist. Dead or placeholder links make the product feel unfinished.

## Component map

Use the repository's existing shadcn-style components as accessible primitives,
not as a visual template for the whole landing page. The page should still feel
custom and editorial. Prefer semantic HTML for layout, navigation, headings and
sections; do not place every piece of content inside a generic card.

### Global navigation

- Use the existing `Button` for **Log in**, **Get started** and the mobile menu
  trigger, retaining shared focus, disabled and interaction behaviour.
- Use the existing `Sheet` primitive for the mobile navigation, customized into
  the planned full-viewport glass menu.
- Keep ordinary desktop navigation links as semantic anchor elements rather
  than buttons.
- Do not add a dropdown menu to the initial navigation. If Product becomes a
  grouped menu later, use the existing `DropdownMenu`.

### Hero

- Use `Button` for **Get started** and **See how it works**, with landing-specific
  size and material variants built from the existing root tokens.
- Keep the headline, supporting copy and decorative labels as semantic HTML.
- The flower canvas is a custom Three.js element, not a shadcn component.
- Do not use `Card`, `Carousel` or a dialog around the flower.

### Product vignettes

- Reuse `Badge` for truthful states such as Draft, In review or Approved.
- Reuse `Avatar` and `AvatarFallback` when showing collaborators or comments.
- Reuse `Button` only where a visible product control is part of the real scene.
- Use `MotionStatus` where it accurately matches an existing animated product
  status; otherwise animate the vignette wrapper with Motion.
- Reuse `Calendar` only for a calendar-focused scene and crop it deliberately
  rather than placing the entire interactive calendar on the landing page.
- Use `Skeleton` only while a genuinely deferred visual is loading. Do not use
  skeletons as permanent decorative content.
- Simplify complex application screens into small presentation components while
  preserving their actual typography, spacing, colours and state language.

### Workflow and capability sections

- Use semantic ordered content for the five workflow stages rather than adding
  a new Steps component.
- Use `Badge` sparingly for short workflow states, never as a label above every
  heading.
- Use the existing `Separator` only where a subtle structural division is
  clearer than whitespace.
- Build capability compositions with normal layout elements; do not install a
  Card component simply to create a generic bento grid.

### Collaboration section

- Use `Avatar` for the small creator, editor, designer and guest stack.
- Use `Tooltip` only for icon-only or avatar-only information that otherwise has
  no visible label. Never hide essential landing-page copy inside a tooltip.
- Use `Badge` for real roles or review states only.

### Final CTA and footer

- Use `Button` for the final **Get started** action.
- Use semantic links for the footer.
- Do not add an `Input` unless a real newsletter or waitlist flow is introduced
  and wired to a real destination.

### Components intentionally not used initially

- `AlertDialog`: the landing page has no destructive confirmation flow.
- `Popover`: unnecessary without a compact interactive control that genuinely
  needs it.
- `Sidebar`: authenticated-app navigation must not appear on the public page.
- `Input`: omit until there is a real form.
- `DropdownMenu`: omit while the navigation remains small.

Do not install additional shadcn components merely because they exist in a
reference design. Add one only when a real interaction requires it. Landing-only
styling must consume shared values from `apps/app/src/index.css`, and changes to
shared primitives must not unintentionally restyle the authenticated app.

## Planned technical stack

- Vite
- React
- TypeScript
- Tailwind CSS
- The repository's existing shadcn-style component approach
- Motion for React via `motion/react` (formerly Framer Motion)
- Three.js for the signature flower scene

Motion is already installed in the workspace and should handle menu transitions,
scroll progress, section reveals and reduced-motion behaviour. Three.js should
only be added when implementation of the flower begins. Do not introduce another
animation system, CSS framework or component framework. Instrument Serif is the
only approved typography addition; Geist remains the primary face. Do not add
Remotion: it is unnecessary for the interactive product vignettes.

## Routing and deployment

The preferred public URL structure is:

```text
blomstr.app/          Landing page
blomstr.app/sign-in   Authentication
blomstr.app/home      Authenticated app
blomstr.app/projects  Authenticated app
```

There is no need for `app.blomstr.app`. The existing app and landing page can be
served by the same Vite application and Netlify site:

- `/` becomes the public landing route.
- `/sign-in` remains public.
- Product routes remain behind the authentication guard.
- Landing-page login links to `/sign-in`.
- Netlify's SPA fallback continues to support direct route visits.

The existing `/` route currently acts as a protected role-aware handoff. When
the public landing page takes `/`, preserve that behavior through a separate
protected redirect-only route such as `/app`:

- `/app` sends workspace members to `/home`.
- `/app` sends guests to `/projects`.
- A successful sign-in or OAuth callback defaults to `/app`.
- If authentication began because a protected route was requested, preserve and
  return to that safe internal route instead.
- A signed-in visitor who deliberately visits `/` may still view the public
  landing page; the primary CTA can take them through the authenticated handoff.

Because of this decision, this directory holds the landing brief. The route
itself should be implemented in `apps/app` unless the deployment strategy is
intentionally changed later.

Before launch, add static prerendering or equivalent HTML generation for the
public route so search engines and social link crawlers receive real metadata
without executing the application JavaScript.

## Initial copy deck

Use this as the first-pass copy. It may be refined after viewing the composed
page, but do not replace it with generic startup language.

### Navigation

- Product
- How it works
- Log in
- Get started

### Hero

Eyebrow, only if the composition benefits from one:

> The creative workspace for content teams

Headline:

> From rough idea to ready to publish.

Body:

> Plan, create, review and prepare every piece of content with your whole team
> in one place.

Actions:

- Get started
- See how it works

### Product proof

Eyebrow:

> One connected workspace

Heading:

> Keep the work moving without losing the thread.

Body:

> Ideas, files, feedback and final versions stay together from the first note to
> the publishing handoff.

### Workflow

Heading:

> Everything your content becomes, in one place.

Stages:

1. **Plan** — Shape the idea, timing and direction before work begins.
2. **Create** — Bring notes, files and collaborators into the same project.
3. **Review** — Give clear feedback directly beside the work.
4. **Approve** — Know which version is final and what still needs attention.
5. **Publish** — Prepare approved assets and platform copy for the handoff.

### Capabilities

Heading:

> Built around the way creative work actually moves.

Keep supporting labels factual and derived from existing functionality. Do not
add a paragraph beneath every capability when a short label is sufficient.

### Collaboration

Heading:

> Everyone sees what they need. Nothing gets lost.

Body:

> Creators, editors, designers and guests can work around the same project while
> comments, decisions and activity remain in context.

### Final CTA

Heading:

> Give your content room to grow.

Body:

> Bring the next idea from first thought to final handoff in Blomstr.

Action:

- Get started

## One-shot implementation contract

### Repository boundaries

- Implement the landing page inside `apps/app`; do not create or deploy a second
  application.
- Add the public page at `apps/app/src/routes/landing.tsx`.
- Keep landing-specific React components under
  `apps/app/src/components/landing/`.
- Keep the 3D scene isolated from page composition so it can fail or be replaced
  without affecting navigation and content.
- Reuse the exported `Logo` from `@blomstr/ui`; do not redraw or reinterpret the
  brand mark.
- Preserve all existing authenticated routes, authentication behavior, Supabase
  features and Netlify SPA redirects.
- Never commit changes on the user's behalf.

### Styling boundaries

- Use the current application palette as the source of truth.
- Define every new reusable landing colour, radius, shadow, glass, spacing and
  motion value as a semantic root global in `apps/app/src/index.css`.
- Consume those globals from components. Do not scatter raw hex colours,
  arbitrary shadow recipes or unexplained animation constants through JSX.
- Tailwind utilities may handle layout and responsive composition while using
  the shared semantic tokens.
- Do not introduce a separate landing stylesheet or a second token system.
- Do not unintentionally change the appearance of the authenticated app.

### Allowed additions

The implementation may add only the dependencies needed for the decisions in
this brief:

- `three` for the procedural flower scene.
- Three.js TypeScript declarations only if the installed Three.js package does
  not provide everything required.
- The appropriate Fontsource package for Instrument Serif.

Use direct Three.js inside a controlled React component. Do not add React Three
Fiber, Drei, Remotion, GSAP, another component framework, another CSS framework
or another icon package. Motion, React, Tailwind, shadcn-style primitives,
Lucide and Geist already exist in the application.

### Metadata

- Set a concise page title and description that match the actual product.
- Add canonical, Open Graph and social metadata when the production URL and
  share image are available.
- Use the existing favicon and brand mark.
- Give page sections semantic headings and landmark elements.
- Do not invent awards, customer counts, ratings or other metadata claims.

### Responsive targets

- Compose and verify the page at narrow mobile, standard mobile, tablet, laptop
  and wide desktop widths.
- Prevent horizontal overflow at every width.
- Treat short landscape screens deliberately, especially the hero and mobile
  menu.
- Keep touch targets comfortably usable and keep primary actions visible without
  precision tapping.
- Make the page complete and visually balanced with the static flower fallback.

### Definition of done

The first implementation is complete only when:

- `/` is public and the existing app remains protected.
- Sign-in, OAuth return paths, member routing and guest routing still work.
- Every navigation link and CTA has a real destination.
- The full landing page has no blank, placeholder or fabricated sections.
- The hero communicates the product without requiring animation.
- The procedural flower follows `FLOWER_PROMPT.md` and degrades cleanly.
- Product vignettes depict real Blomstr capabilities and work without motion.
- Desktop and mobile navigation are keyboard accessible.
- Reduced-motion mode removes nonessential movement.
- The page remains usable without WebGL or backdrop-filter support.
- No console errors, obvious layout shifts or horizontal overflow remain.
- Type checking, the production build and the repository's CI checks pass.
- No unrelated files or authenticated-app visuals are changed.
- No commit is created.

## Guardrails

- Lead with the product outcome rather than a feature list.
- Use real Blomstr interface captures.
- Do not invent testimonials, company logos, metrics or prices.
- Keep copy concise and conversational.
- Above the fold, include only the navbar, headline, one supporting sentence,
  primary and secondary actions, the flower and a controlled glimpse of the
  product.
- Avoid stock photography and literal flower photography.
- Avoid green gradients across every section.
- Avoid making every surface glass.
- More ambitious animation, depth and scroll transitions are welcome on the
  landing page, but avoid motion with no narrative or interaction purpose.
- Avoid placeholder copy, generic icons, fake dashboards, excessive pills and
  a grid of visually identical feature cards.
- All interactions must work with keyboard navigation.
- Maintain readable contrast over glass and 3D imagery.
- Test mobile layouts and reduced-motion mode.
- Include loading, hover, focus and route-transition states without introducing
  layout shift.

## Decisions still open

- The flower's final shape, material and exact animation.
- Which exact existing product states should be represented by the initial
  code-native vignettes.
- Whether About and Contact need dedicated pages at launch.
