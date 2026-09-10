import {
  ACESFilmicToneMapping,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { FLOWER, PETAL_COUNT } from "@/flower/flower-config"
import { buildPetalGeometry } from "@/flower/petal-geometry"

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
}

const DEG = MathUtils.degToRad
const damp = (current: number, target: number, factor: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-factor * dt * 60))

/** Radius the camera frames for. Comfortably larger than the open bloom, so
 * the silhouette keeps breathing room rather than filling the frame. */
const FIT_RADIUS = 1.4

/** A primary petal and everything the pose function needs to place it. */
type Petal = {
  pivot: Group
  material: MeshPhysicalMaterial
  spec: (typeof FLOWER.pose.petals)[number]
}

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
  private readonly petals: Petal[] = []
  private readonly innerPivots: Group[] = []
  private readonly disposables: { dispose(): void }[] = []
  private readonly rimLight: DirectionalLight
  private readonly isMobile: boolean

  /** Camera framing, resolved once and re-fitted on every resize. */
  private readonly target: Vector3
  private readonly baseDirection: Vector3
  private readonly baseDistance: number
  private frameWidth = 2
  private frameHeight = 2

  private readonly targets: FlowerTargets = {
    progress: 0,
    anchorX: 0,
    anchorY: 0,
    pointerX: 0,
    pointerY: 0,
  }
  private readonly current: FlowerTargets = { ...this.targets }

  private frame = 0
  private lastTime = 0
  private elapsed = 0
  private running = false
  private reducedMotion = false

  constructor(canvas: HTMLCanvasElement, options: { isMobile: boolean }) {
    this.isMobile = options.isMobile

    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !options.isMobile,
      powerPreference: "high-performance",
    })
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
    this.buildFlower()
    this.buildContactShadow()
    this.buildLightShafts()

    this.root.add(this.bloom)
    this.scene.add(this.root)
    this.applyPose(0)
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

  private buildLightShafts() {
    // Soft, depth-integrated light cones, isolated to the flower's local space.
    // No full-screen post-processing or light behind the page's CTA.
    const geometry = new PlaneGeometry(3.8, 4.2)
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { tint: { value: new Color("#a9e0bb") } },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vUv;
        uniform vec3 tint;
        void main() {
          vec2 p = vUv - vec2(0.7, 0.96);
          float depth = -p.y;
          float beam = 0.0;
          for (int i = 0; i < 12; i++) {
            float z = float(i) / 12.0;
            float width = 0.016 + depth * (0.12 + z * 0.05);
            float axis = p.x + depth * (0.3 + z * 0.16);
            beam += exp(-pow(axis / width, 2.0) * 2.0) * 0.035;
            beam += exp(-pow((axis + depth * 0.27) / (width * 0.32), 2.0)) * 0.012;
          }
          float fade = smoothstep(0.0, 0.18, depth) * (1.0 - smoothstep(0.3, 0.86, depth));
          gl_FragColor = vec4(tint, beam * fade * 0.42);
        }`,
    })
    const shafts = new Mesh(geometry, material)
    shafts.position.set(0, 0.6, -0.55)
    shafts.quaternion.copy(this.camera.quaternion)
    shafts.renderOrder = -1
    this.root.add(shafts)
    this.disposables.push(geometry, material)
  }

  private buildFlower() {
    const g = FLOWER.geometry
    const petalGeometry = buildPetalGeometry({
      ...g,
      segmentsU: this.isMobile ? FLOWER.performance.mobileSegmentsU : g.segmentsU,
      segmentsV: this.isMobile ? FLOWER.performance.mobileSegmentsV : g.segmentsV,
    })
    this.disposables.push(petalGeometry)

    const m = FLOWER.material
    const baseMaterial = new MeshPhysicalMaterial({
      color: new Color(m.petalColor),
      metalness: 0,
      roughness: m.roughness,
      // Transmission is the expensive part of this material, so mobile keeps
      // only enough of it to preserve the luminous edges.
      transmission: this.isMobile
        ? FLOWER.performance.mobileTransmission
        : m.transmission,
      thickness: m.thickness,
      ior: m.ior,
      clearcoat: m.clearcoat,
      clearcoatRoughness: m.clearcoatRoughness,
      iridescence: m.iridescence,
      attenuationColor: new Color(m.attenuationColor),
      attenuationDistance: m.attenuationDistance,
      emissive: new Color(m.petalColor),
      emissiveIntensity: 0,
    })

    // Five primary petals, one per workflow stage.
    for (const [i, spec] of FLOWER.pose.petals.entries()) {
      const ring = new Group()
      ring.rotation.y = (i / PETAL_COUNT) * Math.PI * 2 + spec.spin

      const pivot = new Group()
      // Set out from the axis so the closed petals wrap the centre instead of
      // intersecting it.
      pivot.position.set(0, 0.02, 0.055)
      pivot.rotation.z = spec.lean
      pivot.scale.setScalar(spec.scale)

      const material = baseMaterial.clone()
      // A barely-there per-petal colour shift. Reads as depth, not as five
      // differently coloured petals.
      material.color.offsetHSL(0, (i % 2 === 0 ? 1 : -1) * 0.012, i * 0.004)
      this.disposables.push(material)

      pivot.add(new Mesh(petalGeometry, material))
      ring.add(pivot)
      this.bloom.add(ring)
      this.petals.push({ pivot, material, spec })
    }

    // An inner ring that gives the centre something to sit behind. Offset
    // from the primary petals so it reads through the gaps between them.
    const innerMaterial = baseMaterial.clone()
    innerMaterial.color.offsetHSL(0, 0.03, -0.05)
    innerMaterial.transmission = (baseMaterial.transmission as number) * 0.8
    this.disposables.push(innerMaterial)

    for (let i = 0; i < FLOWER.inner.count; i++) {
      const ring = new Group()
      ring.rotation.y = (i / FLOWER.inner.count) * Math.PI * 2 + Math.PI / PETAL_COUNT

      const pivot = new Group()
      pivot.position.set(0, 0.03, 0.03)
      pivot.scale.setScalar(FLOWER.inner.scale)

      pivot.add(new Mesh(petalGeometry, innerMaterial))
      ring.add(pivot)
      this.bloom.add(ring)
      this.innerPivots.push(pivot)
    }

    this.bloom.add(this.buildCentre())
    this.disposables.push(baseMaterial)
  }

  private buildCentre() {
    const { centre, material } = FLOWER
    const source = new IcosahedronGeometry(centre.radius, 3)
    source.deleteAttribute("normal")
    source.deleteAttribute("uv")
    const geometry = mergeVertices(source)
    source.dispose()

    // Nudge each vertex along its own direction so the receptacle reads as an
    // organic form rather than a sphere.
    const position = geometry.getAttribute("position")
    const v = new Vector3()
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i)
      const noise = Math.sin(v.x * 9.1) * Math.cos(v.y * 7.7) * Math.sin(v.z * 8.3 + 1.4)
      v.multiplyScalar(1 + noise * centre.irregularity)
      position.setXYZ(i, v.x, v.y * centre.flatten, v.z)
    }
    geometry.computeVertexNormals()

    const centreMaterial = new MeshPhysicalMaterial({
      color: new Color(material.centreColor),
      metalness: 0,
      roughness: material.centreRoughness,
      // Satin, not translucent: the centre has to contrast with the petals.
      transmission: 0,
      clearcoat: 0.1,
      emissive: new Color(material.centreEmissive),
      emissiveIntensity: material.centreEmissiveIntensity,
    })

    this.disposables.push(geometry, centreMaterial)

    const mesh = new Mesh(geometry, centreMaterial)
    mesh.position.y = 0.06
    mesh.name = "centre"
    return mesh
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
    const { closedDegrees, openDegrees } = FLOWER.pose
    const breath = this.reducedMotion
      ? 0
      : Math.sin(this.elapsed * FLOWER.motion.breathSpeed) * FLOWER.motion.breathAmount

    for (const [i, petal] of this.petals.entries()) {
      const open = stageEase(progress, petal.spec.open[0], petal.spec.open[1])
      const tilt = MathUtils.lerp(closedDegrees, openDegrees + petal.spec.tilt, open)

      // Petal tips keep breathing slightly out of phase with each other, so
      // the idle bloom never looks like a single rigid object pulsing.
      petal.pivot.rotation.x = DEG(tilt) * (1 + breath * Math.sin(i * 1.7))

      // The closed bud holds its petals a little tighter than the open bloom.
      petal.pivot.scale.setScalar(petal.spec.scale * MathUtils.lerp(0.94, 1, open))

      // As a stage becomes active its petal lifts fractionally in luminance.
      // This is the "highlight travelling toward the tip" reduced to
      // something a physical material can actually do.
      const active = open > 0.04 && open < 0.98 ? Math.sin(open * Math.PI) : 0
      petal.material.emissiveIntensity = 0.035 + active * 0.06
    }

    for (const pivot of this.innerPivots) {
      pivot.rotation.x = DEG(MathUtils.lerp(4, FLOWER.inner.openDegrees, progress))
    }

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
    }
  }

  resize(width: number, height: number) {
    const ratio = this.isMobile
      ? FLOWER.performance.maxPixelRatioMobile
      : FLOWER.performance.maxPixelRatioDesktop

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, ratio))
    this.renderer.setSize(width, height, false)

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

    const drift = this.reducedMotion
      ? 0
      : Math.sin(this.elapsed * motion.driftSpeed) *
        Math.cos(this.elapsed * motion.driftSpeed * 0.41) *
        motion.driftAmount

    // Pointer nudges the pose; it never replaces it. The scroll stage stays
    // in charge of where the petals are.
    this.bloom.rotation.y = drift + this.current.pointerX * motion.pointerRange
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
    }
    c.anchorX = damp(c.anchorX, t.anchorX, motion.anchorDamping, dt)
    c.anchorY = damp(c.anchorY, t.anchorY, motion.anchorDamping, dt)

    this.applyPose(c.progress)
    this.updateTransform()
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.stop()
    for (const item of this.disposables) item.dispose()
    this.scene.clear()
    this.renderer.dispose()
  }
}
