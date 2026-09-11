/** Aurelia V4 presentation and scroll choreography. Materials come from the GLB. */
export const FLOWER = {
  model: {
    url: "/models/Aurelia_V4/aurelia_flower.glb",
    radius: 1.05,
    baseY: -0.06,
  },
  /*
    The glass finish.

    These sit close to the values the GLB was actually authored with. The
    previous set muted every one of them — roughness up, clearcoat down,
    transmission down, the embedded roughness map discarded — which turned an
    asset built as optical glass into flat plastic.
  */
  finish: {
    outer: "#42875e",
    // Lifted off near-black: the old #236541 / #20553c read as holes punched
    // in the middle of the open bloom rather than as petals in shadow.
    inner: "#2f7a52",
    heart: "#79ab78",
    edge: "#2d8859",
    core: "#2c6b4a",
    roughness: 0.42,
    transmission: 0.82,
    // Enough sheen to read as glass without the hard white hotspot a near-
    // polished clearcoat puts across the folded bud.
    clearcoat: 0.34,
    clearcoatRoughness: 0.22,
    ior: 1.46,
    /*
      Transmission on its own is a thin-surface effect: light passes straight
      through and picks up nothing. Thickness gives the petal a body to travel
      through and the attenuation colour is what it collects on the way. The
      GLB declares KHR_materials_transmission but no KHR_materials_volume, so
      without these two there is nothing making the glass read as glass.
    */
    thickness: 0.32,
    attenuationColor: "#2e8f63",
    /*
      Absorption is deliberately gentle. Tuned darker it reads as carved jade,
      which is handsome on its own but drops the bloom several steps in value
      against a white page and loses the silhouette entirely on a dark one.
    */
    attenuationDistance: 1.7,
  },
  heart: {
    scale: 0.5,
    radiusScale: 0.65,
    height: 0.62,
    rotation: Math.PI / 5,
    openStart: 0.94,
    stagger: 0.005,
  },
  pose: {
    petals: [
      { name: "Petal_01", inner: "Inner_Petal_01", open: [0, 0.2] },
      { name: "Petal_02", inner: "Inner_Petal_02", open: [0.2, 0.4] },
      { name: "Petal_03", inner: "Inner_Petal_03", open: [0.4, 0.6] },
      { name: "Petal_04", inner: "Inner_Petal_04", open: [0.6, 0.8] },
      { name: "Petal_05", inner: "Inner_Petal_05", open: [0.8, 1] },
    ],
    /*
      How far the outer shell is allowed to fold. The asset self-intersects
      when fully folded face-on, which is what the old 0.8 cap was working
      around — at the cost of a bud that never actually closed.
    */
    foldLimit: 1,
    /*
      Petals turn about the flower's axis as they fold, so the five wrap into
      a spiral the way a real bud does instead of meeting face-on. This is
      what buys back the last of the fold above.
    */
    foldTwist: 0.5,
    /*
      Temporary outward travel in model units; zero at either end pose.

      Weighted hard toward the folded end, where petals actually collide. An
      even bump peaked at half-open, which is precisely where the petals are
      most visible as separate objects — it read as the bloom coming apart.
      The fold twist does most of the clearing now, so this can stay small.
    */
    openingClearance: 0.1,
  },
  lighting: {
    key: { color: "#ffffff", intensity: 2.2, position: [-2.4, 3.4, 2.6] },
    /** Traces the outer petal edges and separates the bloom from the page. */
    rim: { color: "#eaf6ee", intensity: 2.4, position: [2.8, 1.4, -2.9] },
    fill: { color: "#ffffff", intensity: 0.55, position: [0.6, -1.2, 2.4] },
    /** Catches the inner ring without reading as a stage spotlight. */
    top: { color: "#eafff1", intensity: 0.7, position: [0.2, 3.2, -0.4] },
    /** The rim strengthens slightly as the bloom completes. */
    rimBoostAtFullBloom: 0.55,
    environmentIntensity: 0.85,
    exposure: 1.06,
  },

  /*
    The haze the bloom sits in: light shafts, a soft halo and drifting motes.

    Two palettes, because this canvas composites over both a white and a
    near-black page. Additive light is the usual way to build a glow, and it
    is invisible on white — you cannot add light to a white pixel. So every
    layer here is an ordinary alpha-blended wash and only the tint changes
    between themes.

    The halo is deliberately near-neutral rather than green. A green wash
    directly behind a green translucent flower flattens the silhouette the
    whole lighting rig exists to produce, which is the same reason the CSS
    tonal pool is offset away from the bloom. Saturation lives in the shafts
    and the motes, which sit off-axis.
  */
  atmosphere: {
    /*
      How fast the haze animates under its own power, independent of scroll:
      the motes' rise, sway and twinkle, the shafts' shimmer, the halo's
      breath. 0 stills the background completely and leaves the flower the
      only thing moving on the page; 1 is a full, drifting field.
    */
    motion: 0,
    dark: {
      shaft: "#a9e0bb",
      halo: "#dcf6e7",
      mote: "#cdf3dd",
      strength: 1,
    },
    light: {
      shaft: "#8cccaa",
      halo: "#a9cdba",
      mote: "#86c5a2",
      strength: 0.42,
    },
    /*
      The fake lens bloom behind the flower.

      `follow` is how much of the flower's travel across the page the halo
      copies: 0 leaves it fixed in frame, 1 locks it to the bloom. Pinned, it
      reads as a pool of light the flower moves through — which is why the
      plane is wide and the falloff flat, so the bloom stays lit at either end
      of its travel rather than sliding off its own glow.
    */
    halo: {
      size: 6.2,
      offsetY: 0.28,
      offsetZ: -0.7,
      opacity: 0.3,
      breathe: 0.05,
      follow: 0,
    },
    /** The shaft plane is billboarded to the camera, like the halo. */
    shafts: { width: 3.8, height: 4.2, offsetY: 0.6, offsetZ: -0.55, opacity: 0.46 },
    motes: {
      countDesktop: 150,
      countMobile: 55,
      /** Radius of the drifting field, and how tall a column it wraps around. */
      radius: 2.5,
      span: 4.4,
      opacity: 0.75,
      /** Point size in pixels at one unit from the camera. */
      size: 110,
    },
  },

  camera: {
    fov: 34,
    position: [0.25, 2.3, 3.6],
    /** Looks slightly above the origin so the bloom sits low in frame. */
    target: [0, 0.3, 0],
  },

  motion: {
    /** Smoothing applied to incoming scroll before it reaches the petals. */
    progressDamping: 0.085,
    /** Smoothing for the flower's lateral move between hero and workflow. */
    anchorDamping: 0.06,
    pointerDamping: 0.05,
    /** Maximum pointer-driven rotation, in radians. */
    pointerRange: 0.12,
    driftSpeed: 0.11,
    driftAmount: 0.055,
    /*
      Scroll-driven rotation, kept separate from `progress`.

      progress is the bloom opening and is pinned to the workflow track, so it
      finishes and then holds. This turns the whole flower for as long as the
      page keeps scrolling, which is what makes it feel like an object you are
      moving past rather than a graphic that animates once.
    */
    spinDamping: 0.05,
    /** Turns of the bloom per viewport height scrolled past the hero. */
    spinTurnsPerViewport: 0.32,
    /*
      Rotation the bloom has of its own, before the reader does anything.

      The hero holds a finished, slowly turning flower. As soon as the page
      moves, scroll takes over the rotation and this fades out, so the two
      never fight for the same axis.
    */
    idleDamping: 0.04,
    /** Turns per second while the page still sits on the hero. */
    idleTurnsPerSecond: 0.06,
  },

  performance: {
    maxPixelRatioDesktop: 1.5,
    maxPixelRatioMobile: 1.0,
    transmissionResolutionDesktop: 0.75,
    transmissionResolutionMobile: 0.5,
  },
} as const

