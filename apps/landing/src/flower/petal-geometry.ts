import { BufferAttribute, BufferGeometry, Vector3 } from "three"

/*
  A petal, generated rather than modelled.

  The surface is defined parametrically over u (base to tip) and v (across the
  width), then given real thickness by offsetting that mid-surface along its
  own normal in both directions and closing the gap with a rim. The result is
  a solid, which is what the translucent material needs: light has to travel
  through something to pick up depth and colour, and a flat plane would just
  look like tinted glass.

  One geometry is shared by every petal in the flower — variation comes from
  group transforms, not from separate meshes.
*/

export type PetalOptions = {
  segmentsU: number
  segmentsV: number
  length: number
  halfWidth: number
  thickness: number
  cup: number
  ridge: number
  curl: number
  edgePull: number
  twist: number
}

/**
 * Width profile. Zero at the base and tip, widest at roughly two fifths of
 * the length — a tapered base opening into a full middle, then closing to a
 * softly rounded tip rather than a spike.
 */
function halfWidthAt(u: number, o: PetalOptions) {
  return o.halfWidth * Math.sin(Math.PI * u) * (0.55 + 0.45 * u)
}

/** Thicker at the base, thinner toward the tip and the outer edges, so the
 * silhouette catches light where the material is thin. */
function thicknessAt(u: number, v: number, o: PetalOptions) {
  return o.thickness * (1 - 0.55 * v * v) * (1 - 0.45 * u * u)
}

function surfacePoint(u: number, v: number, o: PetalOptions, target: Vector3) {
  const hw = halfWidthAt(u, o)

  // The spine: straight along the length, curling away from the centre near
  // the tip. +Z is away from the flower's axis once the petal is placed.
  const spineY = (o.length * (1 - Math.cos(Math.PI * u))) / 2
  const along = (1 - Math.cos(Math.PI * u)) / 2
  const spineZ = o.curl * o.length * along * along

  const x = hw * v
  const bowl = (hw * hw) / o.halfWidth
  const y = spineY - o.edgePull * bowl * v * v
  // Edges turn inward (-Z) while the centre line stands slightly proud of
  // them (+Z): together those two terms are the shallow central ridge.
  const z = spineZ - o.cup * bowl * v * v + o.ridge * bowl * (1 - v * v) * u

  // A gentle spiral about the petal's own axis, growing toward the tip.
  const a = o.twist * u
  const cos = Math.cos(a)
  const sin = Math.sin(a)

  return target.set(x * cos + z * sin, y, z * cos - x * sin)
}

const pU = new Vector3()
const pV = new Vector3()
const pC = new Vector3()
const tangentU = new Vector3()
const tangentV = new Vector3()

/**
 * Normal by finite difference. Samples are nudged off the exact boundary
 * because the width collapses to zero at both the base and the tip, where a
 * derivative across v would otherwise be a zero-length vector.
 */
function surfaceNormal(u: number, v: number, o: PetalOptions, target: Vector3) {
  const e = 0.004
  const u0 = Math.min(Math.max(u, e), 1 - e)
  const v0 = Math.min(Math.max(v, -1 + e), 1 - e)

  surfacePoint(u0, v0, o, pC)
  surfacePoint(u0 + e, v0, o, pU)
  surfacePoint(u0, v0 + e, o, pV)

  tangentU.subVectors(pU, pC)
  tangentV.subVectors(pV, pC)

  return target.crossVectors(tangentV, tangentU).normalize()
}

export function buildPetalGeometry(o: PetalOptions) {
  const { segmentsU: su, segmentsV: sv } = o
  const gridCount = (su + 1) * (sv + 1)
  const vertexCount = gridCount * 2

  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)

  const point = new Vector3()
  const normal = new Vector3()

  for (let iu = 0; iu <= su; iu++) {
    const u = iu / su
    for (let iv = 0; iv <= sv; iv++) {
      const v = (iv / sv) * 2 - 1

      surfacePoint(u, v, o, point)
      surfaceNormal(u, v, o, normal)

      const half = thicknessAt(u, v, o) / 2
      const i = iu * (sv + 1) + iv

      // Front shell, offset along +normal; back shell along -normal.
      for (const [slot, sign] of [
        [i, 1],
        [i + gridCount, -1],
      ] as const) {
        positions[slot * 3] = point.x + normal.x * half * sign
        positions[slot * 3 + 1] = point.y + normal.y * half * sign
        positions[slot * 3 + 2] = point.z + normal.z * half * sign
        normals[slot * 3] = normal.x * sign
        normals[slot * 3 + 1] = normal.y * sign
        normals[slot * 3 + 2] = normal.z * sign
        uvs[slot * 2] = (v + 1) / 2
        uvs[slot * 2 + 1] = u
      }
    }
  }

  const indices: number[] = []
  const at = (iu: number, iv: number) => iu * (sv + 1) + iv

  for (let iu = 0; iu < su; iu++) {
    for (let iv = 0; iv < sv; iv++) {
      const a = at(iu, iv)
      const b = at(iu + 1, iv)
      const c = at(iu + 1, iv + 1)
      const d = at(iu, iv + 1)

      // Front shell faces +normal; the back shell is the same quads reversed.
      indices.push(a, c, b, a, d, c)
      indices.push(a + gridCount, b + gridCount, c + gridCount)
      indices.push(a + gridCount, c + gridCount, d + gridCount)
    }
  }

  /*
    The rim closing the two shells. Walking the grid boundary counterclockwise
    in (v, u) keeps every rim quad facing outward, which lets the whole petal
    render single-sided — worth doing, because transmission on double-sided
    geometry costs twice for no visible gain here.
  */
  let previous = at(0, 0)
  const bridgeTo = (next: number) => {
    indices.push(previous, previous + gridCount, next + gridCount)
    indices.push(previous, next + gridCount, next)
    previous = next
  }

  for (let iv = 1; iv <= sv; iv++) bridgeTo(at(0, iv))
  for (let iu = 1; iu <= su; iu++) bridgeTo(at(iu, sv))
  for (let iv = sv - 1; iv >= 0; iv--) bridgeTo(at(su, iv))
  for (let iu = su - 1; iu >= 0; iu--) bridgeTo(at(iu, 0))

  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(positions, 3))
  geometry.setAttribute("normal", new BufferAttribute(normals, 3))
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()

  return geometry
}
