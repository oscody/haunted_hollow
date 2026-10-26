import { createComponent, Types } from '@iwsdk/core';

// A light that circles the house. Pair it with a PointLight on the same node.
export const Ghost = createComponent(
  'Ghost',
  {
    center: {
      type: Types.Vec3,
      default: [0, 0, -3],
      label: 'Orbit center',
    },
    radius: { type: Types.Float32, default: 4, label: 'Radius', min: 0 },
    speed: {
      type: Types.Float32,
      default: 0.5,
      label: 'Speed (rad/s)',
      help: 'Negative values orbit the other way.',
      step: 0.01,
    },
    appearsAfter: {
      type: Types.Int8,
      default: 0,
      label: 'Appears after',
      help: 'How many moments must be done before this ghost fades in.',
      min: 0,
      max: 5,
    },
  },
  'Orbits a point and bobs up and down',
);
