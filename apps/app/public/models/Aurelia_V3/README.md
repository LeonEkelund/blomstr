# Aurelia V3 — ten petals, five outer animation controls

Reflective smoked glass with higher transmission and a restrained metallic sheen. Five smaller, offset inner petals add depth while five larger outer petals provide the primary animation controls.

**The asset starts fully folded and unfolds one outer petal at a time, from Petal_01 through Petal_05.** Each matching inner petal follows slightly later within that step. At the end all ten petals are open. Folding works in reverse.

## Files and naming

- `aurelia_flower.blend`: editable model, ten separate petal meshes, studio and animation. Starts at folded frame 1.
- `aurelia_flower.glb`: only the flower, with its folded default pose, PBR materials, morph targets and ten coordinated clips.
- `Petal_01`–`Petal_05`: the five outer petals, ordered around the flower.
- `Inner_Petal_01`–`Inner_Petal_05`: smaller supporting petals, offset between the outer petals.
- `Flower_Center`: graphite center ring.
- `Flower_Root`: asset parent.
- `aurelia_hero.png`, `aurelia_closed.png`, `aurelia_sequence.png`: open, folded and mid-sequence previews.
- `aurelia_spread.png`: optional further-spread pose beyond the normal unfolding animation.

## Recommended Three.js integration

```js
import { loadFlower } from './threejs-flower.js';
const flower = await loadFlower('/aurelia_flower.glb');
scene.add(flower.object); // initially folded
flower.playUnfold(5);    // five consecutive steps over five seconds

// In the render loop:
flower.update(deltaSeconds);

// Instead of timed playback, use scroll or UI progress:
flower.setProgress(0.4); // first two outer petals and their inner partners open

// Or control a single outer petal (optionally including its inner partner):
flower.setPetal(3, 0.5); // half-open third pair
flower.setPetal(3, 0.5, false); // only the third outer petal
```

Use one control mode at a time. `setProgress(0)` resets to the folded start. `fold(5)` reverses the sequence from its current progress. After manual `setPetal` control, use `setProgress` to establish a sequence pose before timed playback.

The raw morph is `Bloom_Closed`: 1 = folded, 0 = open. The outer petals also retain `Spread_Out`: 0 = normal open flower, 1 = a further outward extension. Use it with `Bloom_Closed` at zero. The supplied sequence helper leaves this optional extension at zero.

Alternatively, play all exported clips together with one AnimationMixer. Their coordinated timing is already embedded: each outer petal gets its own non-overlapping opening interval, and its inner partner starts a little later. Do not run the exported clips and the supplied procedural helper simultaneously.

Provide an environment map and studio lighting for the glass reflections and transmission. Blender studio lights and backdrop are excluded from the GLB. Metallic and transmissive PBR settings approximate the intended material; appearance depends on the renderer and environment.

The model's folded default weights, open/closed endpoint values, mesh connectivity and exported names are checked in `validation.json`. The JavaScript helper has not been browser-tested. See `asset_info.json` for geometry size; this ten-petal hero asset has approximately 88,000 triangles.
