import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import * as M from './materials.js';

// Shared helpers for scene assets, plus the front door. Moving parts are named
// groups whose pivots sit where they turn, so systems animate them by name.

export const part = (name: string, geo: Mesh['geometry'], mat: Mesh['material'], x = 0, y = 0, z = 0) => {
  const m = new Mesh(geo, mat);
  m.name = name;
  m.position.set(x, y, z);
  return m;
};

/** Where the glowing "press me" ring goes when the prop's origin is unsuitable. */
export const markerSpot = (x: number, z: number) => {
  const o = new Object3D();
  o.name = 'MarkerSpot';
  o.position.set(x, 0, z);
  return o;
};

/**
 * The front door, set against the house's front wall. Origin on the ground at
 * the wall face; the door is hinged on its left and swings out toward +Z.
 */
export function createFrontDoor(): Group {
  const g = new Group();
  g.name = 'FrontDoor';
  const base = 0;
  const w = 1.2;
  const h = 2.1;
  g.add(part('Doorway', new PlaneGeometry(w, h + 0.05), M.doorway, 0, base + h / 2, 0.01));
  const jamb = new BoxGeometry(0.12, h + 0.05, 0.14);
  for (const s of [-1, 1]) g.add(part('Jamb', jamb, M.trim, s * (w / 2 + 0.06), base + h / 2, 0.07));
  g.add(part('Lintel', new BoxGeometry(w + 0.36, 0.18, 0.16), M.trim, 0, base + h + 0.12, 0.08));
  g.add(part('Cornice', new BoxGeometry(w + 0.56, 0.08, 0.24), M.trim, 0, base + h + 0.25, 0.1));

  const door = new Group();
  door.name = 'Door';
  door.position.set(-w / 2, base, 0.03);
  door.add(part('Panel', new BoxGeometry(w, h, 0.07), M.woodDark, w / 2, h / 2, 0.035));
  const inset = new BoxGeometry(0.38, 0.65, 0.02);
  for (const x of [w / 2 - 0.24, w / 2 + 0.24]) {
    for (const y of [0.55, 1.4]) door.add(part('Inset', inset, M.wood, x, y, 0.075));
  }
  door.add(part('Knob', new SphereGeometry(0.04, 10, 8), M.iron, w - 0.13, 1.0, 0.1));
  const knocker = new Group();
  knocker.name = 'Knocker';
  knocker.position.set(w / 2, 1.7, 0.08);
  knocker.add(part('Plate', new CylinderGeometry(0.06, 0.06, 0.02, 16).rotateX(Math.PI / 2), M.iron));
  knocker.add(part('Ring', new TorusGeometry(0.09, 0.015, 8, 24), M.iron, 0, -0.1, 0.02));
  door.add(knocker);
  g.add(door);
  g.add(markerSpot(0, 0.9));
  return g;
}





