/*
  Every artistic value for the bloom lives here.

  The point of a single config object is that visual tuning never requires
  reading the scene graph or the pose maths. If the flower looks wrong, it is
  almost always one of these numbers — not the code that consumes them.

  Colours are the product palette's greens, hard-coded rather than read from
  CSS because WebGL needs them in linear space at scene construction time and
  the flower must look identical in both themes. The page background changes
  between light and dark; the object lit inside the scene does not.
*/

export const FLOWER = {
  geometry: {
    /** Subdivisions along the petal's length and across its width. */
    segmentsU: 48,
    segmentsV: 24,
    length: 1.0,
    halfWidth: 0.42,
    /** Thickness at the thickest point. Edges and tip thin out from here. */
    thickness: 0.055,
    /** How strongly the surface cups toward the flower's axis. */
    cup: 0.65,
    /** Depth of the shallow ridge running base to tip. */
    ridge: 0.025,
    /** How far the tip curls away from the centre. */
    curl: 0.12,
    /** Pulls the outer edges back along the length, rounding the silhouette. */
    edgePull: 0.04,
    /** Gentle spiral along the petal's length, in radians at the tip. */
    twist: 0.035,
  },

  inner: {
    count: 3,
    scale: 0.56,
    /** Inner forms stay tucked; they reveal the centre rather than opening. */
    openDegrees: 38,
  },

  centre: {
    radius: 0.15,
    /** Flattened rather than spherical — a receptacle, not a ball. */
    flatten: 0.66,
    /** Amplitude of the vertex noise that keeps it from reading as a sphere. */
    irregularity: 0.055,
  },

  pose: {
    /** Petal tilt in the dormant bud. Near-vertical, folded over the centre. */
    closedDegrees: 28,
    /** Petal tilt in the completed bloom. */
    openDegrees: 62,
    /**
     * One entry per petal, in workflow order: Plan, Create, Review, Approve,
     * Publish.
     *
     * `open` is where that petal's movement begins and ends within the 0..1
     * story; the windows overlap so the bloom never looks like five separate
     * events. Everything else is that petal's small deviation from the ideal
     * — visible subconsciously, never obviously random.
     */
    petals: [
      { open: [0.02, 0.3], tilt: 0, scale: 1.0, lean: 0.0, spin: 0.0 },
      { open: [0.16, 0.46], tilt: -3.5, scale: 0.965, lean: 0.035, spin: 0.05 },
      { open: [0.32, 0.62], tilt: 2.5, scale: 1.03, lean: -0.03, spin: -0.04 },
      { open: [0.48, 0.78], tilt: -1.5, scale: 0.985, lean: 0.02, spin: 0.03 },
      { open: [0.64, 0.96], tilt: 3.0, scale: 1.01, lean: -0.025, spin: -0.02 },
    ],
  },

  material: {
    /** Petal body: the product's primary botanical green. */
    petalColor: "#309e56",
    /** Overlaps and deep folds accumulate toward this. */
    attenuationColor: "#a9e0bb",
    attenuationDistance: 0.85,
    roughness: 0.36,
    transmission: 0.38,
    thickness: 0.45,
    ior: 1.37,
    clearcoat: 0.24,
    clearcoatRoughness: 0.25,
    iridescence: 0.08,
    /** Centre: the palette's deepest green, satin rather than translucent. */
    centreColor: "#123a20",
    centreRoughness: 0.5,
    /** Just enough to stop the centre reading as a dead black hole. */
    centreEmissive: "#1d5c33",
    centreEmissiveIntensity: 0.16,
  },

  lighting: {
    key: { color: "#fff6ea", intensity: 4.2, position: [-2.4, 3.4, 2.6] },
    /** Traces the outer petal edges and separates the bloom from the page. */
    rim: { color: "#8fe3ab", intensity: 3.6, position: [2.8, 1.4, -2.9] },
    fill: { color: "#ffffff", intensity: 0.55, position: [0.6, -1.2, 2.4] },
    /** Catches the inner ring without reading as a stage spotlight. */
    top: { color: "#eafff1", intensity: 0.7, position: [0.2, 3.2, -0.4] },
    /** The rim strengthens slightly as the bloom completes. */
    rimBoostAtFullBloom: 0.55,
    environmentIntensity: 0.55,
    exposure: 1.06,
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
    breathSpeed: 0.34,
    breathAmount: 0.012,
    driftSpeed: 0.11,
    driftAmount: 0.055,
  },

  performance: {
    maxPixelRatioDesktop: 1.75,
    maxPixelRatioMobile: 1.25,
    /** Mobile drops transmission entirely — it is the expensive part. */
    mobileTransmission: 0.18,
    mobileSegmentsU: 32,
    mobileSegmentsV: 16,
  },
} as const

/** Five primary petals, one per workflow stage. Not a decorative count. */
export const PETAL_COUNT = FLOWER.pose.petals.length
