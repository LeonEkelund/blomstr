import { Box3, Color, type Group, type Material, MathUtils, Mesh, MeshPhysicalMaterial, Quaternion, Texture, Vector3 } from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { FLOWER } from "@/flower/flower-config"

type MorphPetal = {
  mesh: Mesh
  closed: number
  position: Vector3
  outward: Vector3
  /** Rest orientation, so the fold twist is always applied from the pose the
   * asset shipped with rather than accumulated frame over frame. */
  quaternion: Quaternion
}

function petal(root: Group, name: string): MorphPetal {
  const mesh = root.getObjectByName(name)
  if (
    !(mesh instanceof Mesh) ||
    !mesh.morphTargetInfluences ||
    mesh.morphTargetDictionary?.Bloom_Closed === undefined
  ) {
    throw new Error(`Aurelia V4 is missing ${name} or its Bloom_Closed morph`)
  }
  const spread = mesh.morphTargetDictionary.Spread_Out
  if (spread !== undefined) mesh.morphTargetInfluences[spread] = 0
  return {
    mesh,
    closed: mesh.morphTargetDictionary.Bloom_Closed,
    position: mesh.position.clone(),
    outward: new Vector3(1, 0, 0).applyQuaternion(mesh.quaternion),
    quaternion: mesh.quaternion.clone(),
  }
}

/** Flower axis. Petals swing about it, pivoting on their own attachment
 * point, which is what turns five closing petals into a wrapped bud. */
const AXIS = new Vector3(0, 1, 0)
const twist = new Quaternion()

function setTwist(petal: MorphPetal, closure: number) {
  twist.setFromAxisAngle(AXIS, closure * FLOWER.pose.foldTwist)
  petal.mesh.quaternion.copy(petal.quaternion).premultiply(twist)
}

function setClosed(petal: MorphPetal, value: number) {
  if (petal.mesh.morphTargetInfluences)
    petal.mesh.morphTargetInfluences[petal.closed] = value
}

/** Release the imported geometry, shared materials and embedded texture resources once. */
function disposeObject(object: Group) {
  const geometries = new Set<Mesh["geometry"]>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  object.traverse((node) => {
    if (!(node instanceof Mesh)) return
    geometries.add(node.geometry)
    for (const material of Array.isArray(node.material)
      ? node.material
      : [node.material]) {
      materials.add(material)
      for (const value of Object.values(material))
        if (value instanceof Texture) textures.add(value)
    }
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
  for (const texture of textures) {
    texture.dispose()
    const source = texture.source.data
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap)
      source.close()
  }
  object.removeFromParent()
}

export class AureliaModel {
  readonly object: Group
  /** Where the first outer petal points, and the angle between consecutive
   * petals. Together they let the scroll rotation follow the opening order. */
  private readonly baseAngle: number = 0
  private readonly step: number = 0
  private readonly heart: MorphPetal[] = []
  private readonly pairs: {
    outer: MorphPetal
    inner: MorphPetal
    window: readonly [number, number]
  }[]

  static async load(signal?: AbortSignal) {
    const url = `${import.meta.env.BASE_URL}${FLOWER.model.url.slice(1)}`
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error(`Aurelia V4 download failed (${response.status})`)
    const gltf = await new GLTFLoader().parseAsync(
      await response.arrayBuffer(),
      url.slice(0, url.lastIndexOf("/") + 1),
    )
    try {
      signal?.throwIfAborted()
      return new AureliaModel(gltf.scene)
    } catch (error) {
      disposeObject(gltf.scene)
      throw error
    }
  }

  private constructor(object: Group) {
    this.object = object
    this.pairs = FLOWER.pose.petals.map((spec) => ({
      outer: petal(object, spec.name),
      inner: petal(object, spec.inner),
      window: spec.open,
    }))
    for (const [index, pair] of this.pairs.entries()) {
      const source = pair.inner.mesh
      const mesh = source.clone()
      mesh.name = `Heart_Petal_${String(index + 1).padStart(2, "0")}`
      mesh.scale.multiplyScalar(FLOWER.heart.scale)
      mesh.position.multiplyScalar(FLOWER.heart.radiusScale)
      mesh.position.applyAxisAngle(new Vector3(0, 1, 0), FLOWER.heart.rotation)
      mesh.position.y = FLOWER.heart.height
      mesh.rotateY(FLOWER.heart.rotation)
      source.parent?.add(mesh)
      this.heart.push(petal(object, mesh.name))
    }
    this.applyFinish()
    // Measure the actual open geometry, not the conservative morph-target bounds.
    this.applyPose(1)
    object.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(object, true)
    const radius = Math.max(
      Math.abs(bounds.min.x),
      Math.abs(bounds.max.x),
      Math.abs(bounds.min.z),
      Math.abs(bounds.max.z),
    )
    if (!Number.isFinite(radius) || radius <= 0)
      throw new Error("Aurelia V4 has invalid bounds")
    object.scale.setScalar(FLOWER.model.radius / radius)
    object.position.y = FLOWER.model.baseY
    this.applyPose(0)
  }

  private applyFinish() {
    const finish = FLOWER.finish
    const materials = new Map<Material, MeshPhysicalMaterial>()
    const oldGeometries = new Set<Mesh["geometry"]>()
    this.object.traverse((node) => {
      if (!(node instanceof Mesh)) return
      const original = node.material
      if (!(original instanceof MeshPhysicalMaterial)) return
      let material = materials.get(original)
      if (!material) {
        const frosted = original.clone()
        // Transmission is a dielectric effect; any metalness eats into it.
        frosted.metalness = 0
        frosted.metalnessMap = null
        /*
          The roughness map is kept, not discarded. It is what gives the petal
          perimeter its polished edge against the satin face, and dropping it
          flattened every petal to one uniform finish. `roughness` multiplies
          the map, so it softens the contrast instead of erasing it.
        */
        frosted.roughness = finish.roughness
        frosted.transmission = finish.transmission
        frosted.thickness = finish.thickness
        frosted.attenuationColor = new Color(finish.attenuationColor)
        frosted.attenuationDistance = finish.attenuationDistance
        frosted.clearcoat = finish.clearcoat
        frosted.clearcoatRoughness = finish.clearcoatRoughness
        frosted.ior = finish.ior
        materials.set(original, frosted)
        material = frosted
      }
      node.material = material
      if (node.name === "Flower_Center") {
        material.color.set(finish.core)
        return
      }
      oldGeometries.add(node.geometry)
      node.geometry = node.geometry.clone()
      const colors = node.geometry.getAttribute("color")
      if (!colors) return
      const supporting = node.name.startsWith("Inner_") || node.name.startsWith("Heart_")
      const body = new Color(node.name.startsWith("Heart_") ? finish.heart : supporting ? finish.inner : finish.outer)
      const edge = new Color(finish.edge)
      const color = new Color()
      for (let i = 0; i < colors.count; i++) {
        const edgeWeight = supporting
          ? MathUtils.clamp((colors.getZ(i) - 0.32) / 0.08, 0, 1)
          : MathUtils.clamp((0.25 - colors.getX(i)) / 0.205, 0, 1)
        color.copy(body).lerp(edge, edgeWeight * 0.6)
        colors.setXYZ(i, color.r, color.g, color.b)
      }
      colors.needsUpdate = true
    })
    /*
      Retire the source materials, but only the maps none of the replacements
      kept. The clones share the originals' texture objects, so disposing every
      source texture here would pull the roughness map out from under the
      material still using it.
    */
    const kept = new Set<Texture>()
    for (const material of materials.values())
      for (const value of Object.values(material)) if (value instanceof Texture) kept.add(value)
    const textures = new Set<Texture>()
    for (const original of materials.keys()) {
      for (const value of Object.values(original))
        if (value instanceof Texture && !kept.has(value)) textures.add(value)
      original.dispose()
    }
    for (const texture of textures) texture.dispose()
    for (const geometry of oldGeometries) geometry.dispose()
  }

  applyPose(progress: number) {
    const closed = this.pairs.map((pair) => {
      const [start, end] = pair.window
      return 1 - MathUtils.smoothstep(progress, start, end)
    })
    for (const [index, pair] of this.pairs.entries()) {
      const closure = closed[index] ?? 1
      setClosed(pair.outer, closure * FLOWER.pose.foldLimit)
      setTwist(pair.outer, closure)
      /*
        Carry the opening petal outward past its neighbours, but weight the
        travel toward the folded end where they actually collide. Cubing the
        input moves the peak from half-open to about 80% closed: at half-open
        the petal is fully in view and a bump there read as the bloom flying
        apart rather than as petals clearing each other.
      */
      pair.outer.mesh.position
        .copy(pair.outer.position)
        .addScaledVector(
          pair.outer.outward,
          Math.sin(Math.PI * closure ** 3) * FLOWER.pose.openingClearance,
        )
      // Each inner petal lies between outer i and i+1; both must clear it.
      // This also tucks the inner petals away first when scrolling backward.
      const inner = Math.max(closure, closed[(index + 1) % closed.length] ?? 1)
      setClosed(pair.inner, inner)
      setTwist(pair.inner, inner)
    }
    for (const [index, petal] of this.heart.entries()) {
      setClosed(petal, 1 - MathUtils.smoothstep(progress, FLOWER.heart.openStart + index * FLOWER.heart.stagger, 1))
    }
  }

  dispose() {
    disposeObject(this.object)
  }
}
