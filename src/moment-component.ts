import { createComponent, Types } from '@iwsdk/core';

export const MomentIds = {
  Knock: 'knock',
  Bushes: 'bushes',
  Graves: 'graves',
} as const;
export type MomentId = (typeof MomentIds)[keyof typeof MomentIds];

/**
 * Something in the yard the visitor can do once. Pair it with
 * RayInteractable so a click or controller trigger presses it.
 */
export const Moment = createComponent(
  'Moment',
  {
    momentId: {
      type: Types.Enum,
      enum: MomentIds,
      default: MomentIds.Knock,
      label: 'Moment',
    },
    done: { type: Types.Boolean, default: false, label: 'Done' },
    startedAt: {
      type: Types.Float32,
      default: -1,
      label: 'Started at (s)',
      help: 'World time the animation began; -1 while idle.',
    },
  },
  'A one-time yard activity that brings midnight closer',
);
