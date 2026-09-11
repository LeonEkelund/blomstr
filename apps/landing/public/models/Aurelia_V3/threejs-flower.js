import { MathUtils } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Ten petals. Five primary outer controls. Initial pose: fully folded.
export async function loadFlower(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const find = name => {
    const object = gltf.scene.getObjectByName(name);
    if (!object) throw new Error(`Missing ${name}`);
    const meshes = [];
    object.traverse(mesh => {
      if (mesh.morphTargetDictionary?.Bloom_Closed !== undefined) meshes.push(mesh);
    });
    if (!meshes.length) throw new Error(`Missing morph on ${name}`);
    return { object, meshes };
  };
  const outer = Array.from({ length: 5 }, (_, i) => find(`Petal_${String(i + 1).padStart(2, '0')}`));
  const inner = Array.from({ length: 5 }, (_, i) => find(`Inner_Petal_${String(i + 1).padStart(2, '0')}`));
  const clamp = v => MathUtils.clamp(v, 0, 1);
  const ease = v => { const t = clamp(v); return t * t * (3 - 2 * t); };
  let progress = 0;
  let playback = null;
  function pose(petal, openness) {
    for (const mesh of petal.meshes) {
      mesh.morphTargetInfluences[mesh.morphTargetDictionary.Bloom_Closed] = 1 - clamp(openness);
      const spread = mesh.morphTargetDictionary.Spread_Out;
      if (spread !== undefined) mesh.morphTargetInfluences[spread] = 0;
    }
  }
  function applyProgress(value) {
    progress = clamp(value);
    for (let i = 0; i < 5; i++) {
      const step = progress * 5 - i;
      pose(outer[i], ease(step));
      pose(inner[i], ease((step - 1 / 3) * 1.5));
    }
  }
  applyProgress(0);
  return {
    object: gltf.scene,
    outerPetals: outer.map(p => p.object),
    innerPetals: inner.map(p => p.object),
    clips: gltf.animations,
    // Scroll-friendly: 0 = fully folded; 1 = all five steps completed.
    setProgress(value) { playback = null; applyProgress(value); },
    // Direct outer control, optionally opening its matching inner petal.
    // For smooth transitions, animate openness from its current value.
    setPetal(number, openness, includeInner = true) {
      if (!Number.isInteger(number) || number < 1 || number > 5) throw new RangeError('Petal number must be 1–5.');
      playback = null;
      pose(outer[number - 1], openness);
      if (includeInner) pose(inner[number - 1], openness);
    },
    // Plays from the current sequence progress. After manual setPetal calls,
    // setProgress first to return to a consistent sequence pose.
    playUnfold(seconds = 5) { playback = { from: progress, to: 1, elapsed: 0, duration: Math.max(.001, seconds) }; },
    fold(seconds = 5) { playback = { from: progress, to: 0, elapsed: 0, duration: Math.max(.001, seconds) }; },
    stop() { playback = null; },
    update(deltaSeconds) {
      if (!playback) return;
      playback.elapsed += Math.max(0, deltaSeconds);
      const t = Math.min(1, playback.elapsed / playback.duration);
      applyProgress(MathUtils.lerp(playback.from, playback.to, t));
      if (t === 1) playback = null;
    },
  };
}
