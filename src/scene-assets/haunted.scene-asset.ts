import {
  BoxGeometry,
  ConeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
} from '@iwsdk/core';
import { CLEAR_SPOTS, HOUSE, SPAWN } from '../layout.js';
import { makeRandom } from './lib/hardsurface.js';
import * as M from './materials.js';
import { markerSpot, part } from './props.scene-asset.js';

// The vr_haunted_house scene rebuilt without textures: the same floor, house,
// bushes and graves, with flat colours in place of the image maps. Each asset
// is placed at the house centre (0, 0, -3).

/**
 * The 20 m ground. Per-vertex shading stands in for the sand-and-rocks
 * texture, and per-vertex alpha fades the edges out like the original's
 * round alpha map.
 */
export function createFloor(): Mesh {
  const geo = new PlaneGeometry(20, 20, 60, 60).rotateX(-Math.PI / 2);
  const rand = makeRandom(7);
  const pos = geo.getAttribute('position');
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const s = 0.75 + rand() * 0.4;
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    const t = Math.min(1, Math.max(0, (r - 5) / 5));
    colors.push(s, s, s, 1 - t * t * (3 - 2 * t));
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 4));
  const floor = new Mesh(geo, M.ground);
  floor.name = 'Floor';
  return floor;
}

/** Walls and pyramid roof, as in the original. */
export function createHouse(): Group {
  const house = new Group();
  house.name = 'House';
  const { size, wallHeight } = HOUSE;
  house.add(part('Walls', new BoxGeometry(size, wallHeight, size), M.brick, 0, wallHeight / 2, 0));
  const roof = part('Roof', new ConeGeometry(3.5, 1.5, 4), M.slate, 0, wallHeight + 0.75, 0);
  roof.rotation.y = Math.PI * 0.25;
  house.add(roof);
  return house;
}

/**
 * The original's four bushes by the door. They are their own asset (rather
 * than part of the house) so the bushes can be pressed as a moment.
 */
export function createBushes(): Group {
  const bushes = new Group();
  bushes.name = 'Bushes';
  const geo = new SphereGeometry(1, 16, 16);
  const spots: [number, number, number, number][] = [
    [0.5, 0.8, 0.2, 2.2],
    [0.25, 1.4, 0.1, 2.1],
    [0.4, -0.8, 0.1, 2.2],
    [0.15, -1, 0.05, 2.6],
  ];
  spots.forEach(([s, x, y, z], i) => {
    const b = part(`Bush ${i + 1}`, geo, M.leaves, x, y, z);
    b.scale.setScalar(s);
    b.rotation.x = -0.75;
    bushes.add(b);
  });
  bushes.add(markerSpot(1.75, 3.35));
  return bushes;
}

/**
 * 30 graves in a ring 3-7 m from the house, using the original's seeded
 * random placement. Spots taken by a moment prop are skipped and re-rolled,
 * so there are still 30.
 */
export function createGraves(): Group {
  const graves = new Group();
  graves.name = 'Graves';
  const geo = new BoxGeometry(0.6, 0.8, 0.2);
  const rand = makeRandom(1337);
  const clear = CLEAR_SPOTS.map(([x, z]) => [x - HOUSE.x, z - HOUSE.z]);
  let placed = 0;
  while (placed < 30) {
    const angle = rand() * Math.PI * 2;
    const radius = 3 + rand() * 4;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const y = rand() * 0.4;
    const rx = (rand() - 0.5) * 0.4;
    const ry = (rand() - 0.5) * 0.4;
    const rz = (rand() - 0.5) * 0.4;
    if (clear.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 1.4)) continue;
    const grave = part(`Grave ${placed + 1}`, geo, M.graveStone, x, y, z);
    grave.rotation.set(rx, ry, rz);
    graves.add(grave);
    placed++;
  }
  // The press ring goes round the grave nearest the player's start.
  const sx = SPAWN[0] - HOUSE.x;
  const sz = SPAWN[2] - HOUSE.z;
  let nearest = graves.children[0];
  for (const g of graves.children) {
    if (Math.hypot(g.position.x - sx, g.position.z - sz) < Math.hypot(nearest.position.x - sx, nearest.position.z - sz)) nearest = g;
  }
  graves.add(markerSpot(nearest.position.x, nearest.position.z));
  return graves;
}
