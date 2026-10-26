// Shared positions, in meters. Same layout as vr_haunted_house: a 20 m floor
// and a 4 m house both centred at (0, 0, -3), front door facing +Z, graves in
// a ring 3-7 m from the centre, and the player starting at (4, 0, 2).

export const HOUSE = {
  x: 0,
  z: -3,
  size: 4, // square footprint
  wallHeight: 2.5,
} as const;

/** World z of the house's front wall. */
export const HOUSE_FRONT = HOUSE.z + HOUSE.size / 2;

/** Player start; matches the scene's player.transform. */
export const SPAWN = [4, 0, 2] as const;
/** Radians; the player starts facing the house. */
export const SPAWN_YAW = (38.66 * Math.PI) / 180;

/**
 * World [x, z] spots kept free of graves: the front door's press ring, so the
 * walk up to the door stays clear.
 */
export const CLEAR_SPOTS: [number, number][] = [[0, HOUSE_FRONT + 0.9]];
