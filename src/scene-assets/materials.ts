import { MeshBasicMaterial, MeshStandardMaterial } from '@iwsdk/core';

// One shared material per surface family; placed clones share these. Colours
// stand in for the textures vr_haunted_house uses, since nothing here loads
// an image.
const mat = (name: string, color: string, roughness = 0.9, metalness = 0) => {
  const m = new MeshStandardMaterial({ color, roughness, metalness });
  m.name = name;
  return m;
};

export const ground = mat('Ground', '#6b5d4a', 1);
ground.vertexColors = true;
// The floor's vertex alpha fades its edges, like the original's alpha map.
ground.transparent = true;
export const brick = mat('Brick', '#7a4b3a', 0.95);
export const slate = mat('RoofSlate', '#4a4446', 0.85);
export const leaves = mat('Leaves', '#4f6e35', 0.9);
export const graveStone = mat('GraveStone', '#8e8b84', 0.95);
export const wood = mat('Wood', '#4d3b2c', 0.85);
export const woodDark = mat('WoodDark', '#3a2618', 0.8);
export const trim = mat('Trim', '#2c2826', 0.85);
export const iron = mat('Iron', '#1d1d21', 0.55, 0.6);

/** The dark behind an open door. */
export const doorway = new MeshBasicMaterial({ name: 'Doorway', color: '#040304' });
