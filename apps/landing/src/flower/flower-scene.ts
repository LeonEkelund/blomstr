import {
  ACESFilmicToneMapping,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { Atmosphere } from "@/flower/atmosphere"
import { AureliaModel } from "@/flower/aurelia-model"
import { FLOWER } from "@/flower/flower-config"

/** What the page tells the scene. Everything else is the scene's own business. */
export type FlowerTargets = {
  /** 0 = dormant bud, 1 = completed bloom. */
  progress: number
  /** -1 pins the bloom to the left of frame, +1 to the right. */
  anchorX: number
  /** Positive lifts the bloom toward the top of frame. */
  anchorY: number
  /** Pointer position in -1..1, already normalised to the viewport. */
  pointerX: number
  pointerY: number
  /**
   * Viewport heights scrolled past the hero. Unbounded and always increasing
   * as the page goes down; the scene decides how much rotation that buys.
   */
  spin: number
  /**
   * How much of the page is still at rest on the hero, 1 down to 0. Scales the
   * bloom's own rotation, which is what turns it before anyone has scrolled.
   */
  idle: number
}

const damp = (current: number, target: number, factor: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-factor * dt * 60))

/** Radius the camera frames for. Comfortably larger than the open bloom, so
 * the silhouette keeps breathing room rather than filling the frame. */
const FIT_RADIUS = 1.4

/** Smoothstep over an arbitrary window, clamped outside it. */
function stageEase(progress: number, start: number, end: number) {
  const t = MathUtils.clamp((progress - start) / (end - start), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * A soft elliptical smudge used as a contact shadow. Cheaper than a shadow
 * map by an order of magnitude, and for a floating object with one dominant
 * key light the difference is not visible.
 */
function createContactShadowTexture() {
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext("2d")
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    )
    // Green-neutral rather than black: a pure black shadow under a green
    // object reads as dirt on the page.
    gradient.addColorStop(0, "rgba(24, 58, 36, 0.42)")
    gradient.addColorStop(0.45, "rgba(24, 58, 36, 0.16)")
    gradient.addColorStop(1, "rgba(24, 58, 36, 0)")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }

  return new CanvasTexture(canvas)
}

export class FlowerScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly root = new Group()
  private readonly bloom = new Group()
  private readonly model: AureliaModel
  private readonly atmosphere: Atmosphere
  private readonly disposables: { dispose(): void }[] = []
  private readonly rimLight: DirectionalLight
  private readonly isMobile: boolean

  /** Camera framing, resolved once and re-fitted on every resize. */
  private readonly target: Vector3
  private readonly baseDirection: Vector3
  private readonly baseDistance: number
  private frameWidth = 2
  private frameHeight = 2

  // The page opens on a finished bloom at rest, so that is the pose the scene
  // starts from — not the bud it used to fold out of.
  private readonly targets: FlowerTargets = {
    progress: 1,
    anchorX: 0,
    anchorY: 0,
    pointerX: 0,
    pointerY: 0,
    spin: 0,
    idle: 1,
  }
  private readonly current: FlowerTargets = { ...this.targets }

  private frame = 0
  private lastTime = 0
  private elapsed = 0
  /** Accumulated idle rotation. It only ever grows, so the handoff to
   * scroll-driven spin stops the turn rather than rewinding it. */
  private idleAngle = 0
  private running = false
  private reducedMotion = false

  static async create(
    canvas: HTMLCanvasElement,
    options: { isMobile: boolean },
    signal?: AbortSignal,
  ) {
    const model = await AureliaModel.load(signal)
    try {
      return new FlowerScene(canvas, options, model)
    } catch (error) {
      model.dispose()
      throw error
    }
  }

  private constructor(
    canvas: HTMLCanvasElement,
    options: { isMobile: boolean },
    model: AureliaModel,
  ) {
    this.model = model
    this.isMobile = options.isMobile

    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !options.isMobile,
      powerPreference: "high-performance",
    })
    this.renderer.transmissionResolutionScale = options.isMobile
      ? FLOWER.performance.transmissionResolutionMobile
      : FLOWER.performance.transmissionResolutionDesktop
    this.renderer.setClearAlpha(0)
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = FLOWER.lighting.exposure
    this.renderer.outputColorSpace = SRGBColorSpace

    const { camera: cam } = FLOWER
    const position = new Vector3(...cam.position)
    this.target = new Vector3(...cam.target)
    this.baseDirection = position.clone().sub(this.target)
    this.baseDistance = this.baseDirection.length()
    this.baseDirection.normalize()

    this.camera = new PerspectiveCamera(cam.fov, 1, 0.1, 40)
    this.camera.position.copy(position)
    this.camera.lookAt(this.target)

    // A generated studio, never shown: it exists so transmission and
    // reflections have something meaningful to pick up. The canvas stays
    // transparent so the page background shows through.
    const pmrem = new PMREMGenerator(this.renderer)
    const studio = new RoomEnvironment()
    const environment = pmrem.fromScene(studio, 0.04)
    studio.dispose()
    this.scene.environment = environment.texture
    this.scene.environmentIntensity = FLOWER.lighting.environmentIntensity
    this.disposables.push(environment, pmrem)

    this.buildLights()
    this.rimLight = this.scene.getObjectByName("rim") as DirectionalLight
    this.bloom.add(model.object)
    this.buildContactShadow()

    /*
      Both haze groups hang off the scene rather than `root`, so none of it is
      dragged along by the flower's travel across the page. The halo is allowed
      to copy some of that travel back via `atmosphere.halo.follow`, which is
      the one dial that decides whether the glow belongs to the room or to the
      bloom. Neither group goes on `bloom`, which spins.
    */
    this.atmosphere = new Atmosphere(this.camera, options)
    this.scene.add(this.atmosphere.field)
    this.scene.add(this.atmosphere.glow)

    this.root.add(this.bloom)
    this.scene.add(this.root)
    this.applyPose(this.current.progress)
  }

  private buildLights() {
    const { key, rim, fill, top } = FLOWER.lighting

    for (const [name, spec] of Object.entries({ key, rim, fill, top })) {
      const light = new DirectionalLight(new Color(spec.color), spec.intensity)
      light.position.set(spec.position[0], spec.position[1], spec.position[2])
      light.name = name
      this.scene.add(light)
    }
  }

  private buildContactShadow() {
    const texture = createContactShadowTexture()
    const geometry = new PlaneGeometry(2.6, 2.6)
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.32,
    })

    const plane = new Mesh(geometry, material)
    plane.rotation.x = -Math.PI / 2
    plane.position.y = -0.2
    plane.name = "contact-shadow"

    this.disposables.push(texture, geometry, material)
    this.root.add(plane)
  }

  /**
   * The whole flower story as a function of one number.
   *
   * Each petal opens across its own overlapping window, so the bloom reads as
   * one continuous movement rather than five discrete events, and scrubbing
   * backwards is simply the same function evaluated at a lower progress.
   */
  private applyPose(progress: number) {
    this.model.applyPose(progress)

    // The rim strengthens slightly as the bloom completes, which is what
    // makes the finished silhouette feel resolved rather than merely open.
    this.rimLight.intensity =
      FLOWER.lighting.rim.intensity *
      (1 + FLOWER.lighting.rimBoostAtFullBloom * stageEase(progress, 0.6, 1))
  }

  setTargets(next: Partial<FlowerTargets>) {
    Object.assign(this.targets, next)
    if (this.reducedMotion) {
      this.targets.progress = 1
      Object.assign(this.current, this.targets)
      this.renderStatic()
    }
  }

  setTheme(dark: boolean) {
    this.atmosphere.setTheme(dark)
    if (!this.running) this.renderStatic()
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced
    if (reduced) {
      // Reduced motion gets the finished composition immediately, with no
      // scroll coupling, breathing, drift or pointer response.
      this.targets.progress = 1
      this.current.progress = 1
      this.targets.pointerX = 0
      this.targets.pointerY = 0
      this.current.pointerX = 0
      this.current.pointerY = 0
      this.targets.idle = 0
      this.current.idle = 0
    }
  }

  resize(width: number, height: number) {
    const ratio = this.isMobile
      ? FLOWER.performance.maxPixelRatioMobile
      : FLOWER.performance.maxPixelRatioDesktop

    const pixelRatio = Math.min(window.devicePixelRatio, ratio)
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height, false)
    // Point sizes are in device pixels, so the mote field has to be told.
    this.atmosphere.setPixelRatio(pixelRatio)

    const aspect = width / height
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()

    /*
      Dolly back far enough that the open bloom fits.

      Vertical field of view is fixed, so on a portrait phone the *horizontal*
      frame is the narrow one and a flower framed for desktop would have its
      petal tips cropped off. Fitting against whichever field of view is
      smaller is what makes the same scene work from a tall phone to a wide
      desktop without art-directing the camera twice.
    */
    const vFov = MathUtils.degToRad(this.camera.fov)
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const fitDistance = FIT_RADIUS / Math.tan(Math.min(vFov, hFov) / 2)

    this.camera.position
      .copy(this.baseDirection)
      .multiplyScalar(Math.max(this.baseDistance, fitDistance))
      .add(this.target)
    this.camera.lookAt(this.target)

    // How much world space one frame covers, so anchor offsets can be
    // expressed as a fraction of the frame rather than in raw units.
    const distance = this.camera.position.distanceTo(this.target)
    this.frameHeight = 2 * distance * Math.tan(vFov / 2)
    this.frameWidth = this.frameHeight * aspect
  }

  start() {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.frame = requestAnimationFrame(this.tick)
  }

  stop() {
    if (!this.running) return
    this.running = false
    cancelAnimationFrame(this.frame)
  }

  /** One frame with no animation, for reduced motion and for the first paint. */
  renderStatic() {
    Object.assign(this.current, this.targets)
    this.applyPose(this.current.progress)
    this.atmosphere.update(this.reducedMotion ? 0 : this.elapsed, this.current.progress)
    this.updateTransform()
    this.renderer.render(this.scene, this.camera)
    // Physical transmission settles after the initial environment upload.
    this.renderer.render(this.scene, this.camera)
  }

  private updateTransform() {
    const { motion } = FLOWER
    // Anchors are fractions of the visible frame rather than world units, so
    // "pinned to the right" lands in the same place on a laptop and on an
    // ultrawide instead of drifting toward the middle.
    this.root.position.x = this.current.anchorX * this.frameWidth * 0.22
    this.root.position.y = this.current.anchorY * this.frameHeight * 0.28

    // Fixed in frame at follow = 0, locked to the bloom at 1.
    const follow = FLOWER.atmosphere.halo.follow
    this.atmosphere.glow.position.set(
      this.root.position.x * follow,
      this.root.position.y * follow,
      0,
    )

    const drift = this.reducedMotion
      ? 0
      : Math.sin(this.elapsed * motion.driftSpeed) *
        Math.cos(this.elapsed * motion.driftSpeed * 0.41) *
        motion.driftAmount

    /*
      Rotation is the bloom's own turn, then scroll, then the idle drift, then
      the pointer. Reduced motion drops both spins entirely — they are the
      parts of the pose that are rotation for its own sake, so they have to go.
    */
    const spin = this.reducedMotion
      ? 0
      : this.idleAngle + this.current.spin * motion.spinTurnsPerViewport * Math.PI * 2

    // Pointer nudges the pose; it never replaces it. The scroll stage stays
    // in charge of where the petals are.
    this.bloom.rotation.y = spin + drift + this.current.pointerX * motion.pointerRange
    this.bloom.rotation.x = this.current.pointerY * motion.pointerRange * 0.5
  }

  private readonly tick = (time: number) => {
    if (!this.running) return
    this.frame = requestAnimationFrame(this.tick)

    const dt = Math.min((time - this.lastTime) / 1000, 0.05)
    this.lastTime = time
    this.elapsed += dt

    const { motion } = FLOWER
    const c = this.current
    const t = this.targets

    // Scroll is smoothed before it reaches the petals: bound straight to the
    // scrollbar, the bloom feels like a slider rather than something physical.
    if (!this.reducedMotion) {
      c.progress = damp(c.progress, t.progress, motion.progressDamping, dt)
      c.pointerX = damp(c.pointerX, t.pointerX, motion.pointerDamping, dt)
      c.pointerY = damp(c.pointerY, t.pointerY, motion.pointerDamping, dt)
      c.spin = damp(c.spin, t.spin, motion.spinDamping, dt)
      c.idle = damp(c.idle, t.idle, motion.idleDamping, dt)
      // A rate, not a position: the hero turns the bloom continuously, and
      // scrolling eases that rate to zero instead of snapping the angle back.
      this.idleAngle += dt * c.idle * motion.idleTurnsPerSecond * Math.PI * 2
    }
    c.anchorX = damp(c.anchorX, t.anchorX, motion.anchorDamping, dt)
    c.anchorY = damp(c.anchorY, t.anchorY, motion.anchorDamping, dt)

    this.applyPose(c.progress)
    this.atmosphere.update(this.reducedMotion ? 0 : this.elapsed, c.progress)
    this.updateTransform()
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.stop()
    this.atmosphere.dispose()
    this.model.dispose()
    for (const item of this.disposables) item.dispose()
    this.scene.clear()
    this.renderer.dispose()
  }
}
