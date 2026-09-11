import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  type PerspectiveCamera,
  PlaneGeometry,
  Points,
  ShaderMaterial,
} from "three"
import { FLOWER } from "@/flower/flower-config"

/*
  The haze around the bloom, built from three cheap layers rather than a
  post-processing chain.

  Post-processing is the obvious way to get bloom and god rays, and it is the
  wrong tool here: this canvas is transparent and composites over live HTML, so
  a full-screen pass has to preserve alpha through every render target, and
  UnrealBloomPass in particular does not. Everything below is an ordinary
  alpha-blended draw, which composites over the page for free.

  Layer 1 — shafts: a fan of soft cones integrated along their depth, on a
  billboarded plane. This is the standard cheat for volumetric light and it
  holds up because the shafts are soft enough to have no silhouette of
  their own.
  Layer 2 — halo: a two-lobe radial falloff standing in for lens bloom.
  Layer 3 — motes: drifting pollen, depth-tested so the flower occludes them.
*/

/** Shared preamble: every layer is a tinted wash with its own strength. */
const TINTED = `
  uniform vec3 tint;
  uniform float strength;
`

const SHAFT_FRAGMENT = `
  ${TINTED}
  uniform float time;
  varying vec2 vUv;

  // Cheap per-beam scatter. A texture fetch would be overkill for something
  // this soft, and the beams only need to be *unequal*, not truly random.
  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    // The source sits above and right of the plane, matching the rim light.
    vec2 p = vUv - vec2(0.72, 1.04);
    float depth = -p.y;
    if (depth <= 0.0) discard;

    float beam = 0.0;
    for (int i = 0; i < 7; i++) {
      float seed = hash(float(i) * 12.9898);
      // Each shaft leaves the source on its own angle and widens on its own
      // rate, so the fan reads as light through a gap rather than as stripes.
      float angle = -0.46 + seed * 0.62;
      float width = 0.012 + depth * (0.085 + seed * 0.1);
      // Squared by multiplication, not pow(): pow() with a negative base is
      // undefined in GLSL, and this axis is negative on one side of every beam.
      float axis = (p.x - depth * angle) / width;
      float slice = exp(-axis * axis * 1.7);
      // A slow breath per shaft. Without it the fan sits perfectly still and
      // immediately reads as a painted texture.
      float drift = 0.86 + 0.14 * sin(time * (0.17 + seed * 0.22) + seed * 6.28);
      beam += slice * drift * (0.022 + seed * 0.03);
    }

    float fade = smoothstep(0.0, 0.2, depth) * (1.0 - smoothstep(0.32, 0.92, depth));
    gl_FragColor = vec4(tint, beam * fade * strength);
  }
`

const HALO_FRAGMENT = `
  ${TINTED}
  uniform float swell;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    p.y *= 1.14;
    float d = length(p);
    /*
      A tight core inside a wide skirt. The two-lobe falloff is the whole
      trick: a single gaussian reads as a painted circle, while a bright
      centre bleeding into a long tail is what the eye accepts as light.
    */
    float core = exp(-d * d * 6.0);
    float skirt = exp(-d * d * 1.2);
    // Weighted toward the skirt: the halo is fixed in frame while the flower
    // travels, so a flat pool of light keeps the bloom lit at either end of
    // its travel where a tight core would only light the middle.
    // Ascending edges then inverted: smoothstep is undefined when edge0 >=
    // edge1, even though most drivers happen to ramp it the other way.
    float glow = (core * 0.35 + skirt * 0.65) * (1.0 - smoothstep(0.3, 1.0, d));
    gl_FragColor = vec4(tint, glow * strength * swell);
  }
`

const BILLBOARD_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const MOTE_VERTEX = `
  uniform float time;
  uniform float pixelRatio;
  uniform float size;
  uniform float span;
  attribute float seed;
  attribute float scale;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    // Motes rise and wrap, so the field drifts forever without emptying.
    p.y = mod(p.y + time * (0.03 + seed * 0.055) + span * 0.5, span) - span * 0.5;
    p.x += sin(time * (0.12 + seed * 0.2) + seed * 8.0) * 0.17;
    p.z += cos(time * (0.1 + seed * 0.17) + seed * 5.0) * 0.17;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Fade into the ends of the wrap, or motes pop in and out at the seam.
    float edge = smoothstep(0.0, 0.3, 1.0 - abs(p.y) / (span * 0.5));
    float twinkle = 0.55 + 0.45 * sin(time * (0.6 + seed * 0.8) + seed * 12.0);
    vAlpha = edge * twinkle;

    gl_PointSize = scale * size * pixelRatio / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }
`

const MOTE_FRAGMENT = `
  ${TINTED}
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    // Bright centre, soft shoulder: a flat disc reads as a dot, not as bokeh.
    float body = exp(-d * d * 11.0) * (1.0 - smoothstep(0.12, 0.5, d));
    gl_FragColor = vec4(tint, body * vAlpha * strength);
  }
`

type Uniforms = ShaderMaterial["uniforms"]
// Structural rather than `typeof FLOWER.atmosphere.dark`: the config is `as
// const`, so that would pin the type to the dark palette's literal hex values.
type Palette = { shaft: string; halo: string; mote: string; strength: number }
/** Each layer carries the tint it wants, so theming never depends on order. */
type Layer = { uniforms: Uniforms; pick: (palette: Palette) => string; opacity: number }

export class Atmosphere {
  /*
    Two groups, because the layers belong to different things.

    `field` is the room: shafts and drifting motes. It is fixed in frame, so
    the flower travels across it as the page scrolls instead of dragging it
    along. `glow` is light coming off the bloom itself, so that one has to
    follow — pinned, the open flower would sit beside its own halo.
  */
  readonly field = new Group()
  readonly glow = new Group()
  private readonly disposables: { dispose(): void }[] = []
  private readonly layers: Layer[] = []
  private readonly timed: Uniforms[] = []
  private readonly haloUniforms: Uniforms
  private readonly moteUniforms: Uniforms

  constructor(camera: PerspectiveCamera, options: { isMobile: boolean }) {
    const { atmosphere } = FLOWER

    const halo = this.buildBillboard(
      this.glow,
      camera,
      new PlaneGeometry(atmosphere.halo.size, atmosphere.halo.size),
      HALO_FRAGMENT,
      { swell: { value: 1 } },
      (palette) => palette.halo,
      atmosphere.halo.opacity,
    )
    halo.mesh.position.set(0, atmosphere.halo.offsetY, atmosphere.halo.offsetZ)
    // Behind the shafts, which are in turn behind the flower.
    halo.mesh.renderOrder = -2
    this.haloUniforms = halo.uniforms

    const shafts = this.buildBillboard(
      this.field,
      camera,
      new PlaneGeometry(atmosphere.shafts.width, atmosphere.shafts.height),
      SHAFT_FRAGMENT,
      { time: { value: 0 } },
      (palette) => palette.shaft,
      atmosphere.shafts.opacity,
    )
    shafts.mesh.position.set(0, atmosphere.shafts.offsetY, atmosphere.shafts.offsetZ)
    shafts.mesh.renderOrder = -1
    this.timed.push(shafts.uniforms)

    this.moteUniforms = this.buildMotes(options.isMobile)
    this.timed.push(this.moteUniforms)
    this.setTheme(document.documentElement.classList.contains("dark"))
  }

  private buildBillboard(
    parent: Group,
    camera: PerspectiveCamera,
    geometry: PlaneGeometry,
    fragmentShader: string,
    extra: Uniforms,
    pick: Layer["pick"],
    opacity: number,
  ) {
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { tint: { value: new Color() }, strength: { value: 1 }, ...extra },
      vertexShader: BILLBOARD_VERTEX,
      fragmentShader,
    })
    const mesh = new Mesh(geometry, material)
    // The camera only ever dollies along a fixed axis, so facing it once is
    // enough — there is no orbit to keep up with.
    mesh.quaternion.copy(camera.quaternion)
    parent.add(mesh)
    this.disposables.push(geometry, material)
    this.layers.push({ uniforms: material.uniforms, pick, opacity })
    return { mesh, uniforms: material.uniforms }
  }

  private buildMotes(isMobile: boolean) {
    const { motes } = FLOWER.atmosphere
    const count = isMobile ? motes.countMobile : motes.countDesktop
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const scales = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Square-rooted radius keeps the field even instead of crowding the
      // centre, which is what a uniform random radius would do.
      const radius = Math.sqrt(Math.random()) * motes.radius
      const angle = Math.random() * Math.PI * 2
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = (Math.random() - 0.5) * motes.span
      positions[i * 3 + 2] = Math.sin(angle) * radius
      seeds[i] = Math.random()
      // Biased small: a few large motes near the front carry the depth, and
      // a field of uniformly sized ones just looks like noise.
      scales[i] = 0.35 + Math.random() ** 3 * 1.5
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3))
    geometry.setAttribute("seed", new Float32BufferAttribute(seeds, 1))
    geometry.setAttribute("scale", new Float32BufferAttribute(scales, 1))

    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        tint: { value: new Color() },
        strength: { value: 1 },
        time: { value: 0 },
        pixelRatio: { value: 1 },
        size: { value: motes.size },
        span: { value: motes.span },
      },
      vertexShader: MOTE_VERTEX,
      fragmentShader: MOTE_FRAGMENT,
    })

    const points = new Points(geometry, material)
    // Depth-tested, so the bloom genuinely occludes the motes behind it.
    // That occlusion is most of what sells the field as surrounding the
    // flower rather than floating in front of it.
    points.frustumCulled = false
    this.field.add(points)
    this.disposables.push(geometry, material)
    this.layers.push({
      uniforms: material.uniforms,
      pick: (palette) => palette.mote,
      opacity: motes.opacity,
    })
    return material.uniforms
  }

  /** Light and dark pages need different tints; see the config for why. */
  setTheme(dark: boolean) {
    const palette = dark ? FLOWER.atmosphere.dark : FLOWER.atmosphere.light
    for (const layer of this.layers) {
      const color = layer.uniforms.tint?.value
      if (color instanceof Color) color.set(layer.pick(palette))
      const strength = layer.uniforms.strength
      if (strength) strength.value = layer.opacity * palette.strength
    }
  }

  setPixelRatio(ratio: number) {
    const uniform = this.moteUniforms.pixelRatio
    if (uniform) uniform.value = ratio
  }

  /** `elapsed` is frozen by the caller under reduced motion. */
  update(elapsed: number, progress: number) {
    /*
      The haze keeps its own clock. Scaling it here rather than at each use is
      what lets `motion: 0` still the whole background — motes, shafts and the
      halo's breath together — without touching the flower's own rotation,
      which runs off the raw elapsed time in the scene.
    */
    const time = elapsed * FLOWER.atmosphere.motion
    for (const uniforms of this.timed) {
      const clock = uniforms.time
      if (clock) clock.value = time
    }
    const swell = this.haloUniforms.swell
    // The halo swells with the bloom and breathes a little on its own, so the
    // glow grows into the open flower rather than sitting at full strength
    // behind a bud.
    if (swell)
      swell.value =
        (0.45 + progress * 0.55) *
        (1 + Math.sin(time * 0.32) * FLOWER.atmosphere.halo.breathe)
  }

  dispose() {
    for (const item of this.disposables) item.dispose()
    for (const group of [this.field, this.glow]) {
      group.removeFromParent()
      group.clear()
    }
  }
}
