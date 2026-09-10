# Aurelia V4 — sculpted optical glass

This revision rebuilds the petal geometry. Broad, quiet curves replace the pointed, rippled surfaces. Each petal is a rounded lens-shaped shell with continuous edges, a satin glass face and a narrow polished blue glass perimeter. The smaller inner bloom uses deeper smoke-blue glass.

## Files

- `aurelia_flower.blend`: editable model and studio setup; saved fully folded.
- `aurelia_flower.glb`: the model only, with materials and morph targets; loads fully folded.
- `aurelia_hero.png`: the open model, rendered in Cycles.
- `aurelia_closed.png`: the folded model.
- `build_flower.py`: standalone rebuild script for Blender.
- `validation.json`: mesh and export checks.

## Existing Three.js motion

The five outer meshes remain `Petal_01`, `Petal_02`, `Petal_03`, `Petal_04`, `Petal_05`. Their origins are at the attachment points. There are five additional meshes named `Inner_Petal_01` through `Inner_Petal_05`, a small `Flower_Center`, and the parent `Flower_Root`.

`Bloom_Closed` is present on all ten petals: **1 = folded, 0 = open**. `Spread_Out` remains on the outer five: **0 = normal open shape, 1 = further outward extension**. Use the extension with `Bloom_Closed` at zero.

Your Three.js animation can continue driving those names and morphs. This model intentionally contains no baked animation clips. Geometry and curvature have changed, so review the motion against the new silhouette.

Each named petal exports as a single mesh primitive. The edge tint uses vertex colors, and a tiny embedded roughness map gives the perimeter its polished finish. The face and edge therefore remain one mesh for your existing controls.

## Material and rendering

Faces use moderately rough transmissive glass with a small metallic component. Polished edges use stronger transmission and a blue tint. The surfaces have real rounded thickness. Alpha remains opaque; the transparency effect comes from physical transmission.

Use the imported PBR materials and a good environment map in Three.js. Blender's studio lights and floor are excluded from the GLB. Rendering appearance depends on the environment and renderer. This asset has been structurally checked and rendered in Blender, not tested inside your Three.js application.

This is a detailed hero asset; the exact triangle count and file size are listed in `validation.json`.
