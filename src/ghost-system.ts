import { createSystem, Entity, PointLightComponent } from '@iwsdk/core';
import { synth } from './audio.js';
import { Ghost } from './ghost-component.js';
import { progress } from './progress.js';

/**
 * The three ghost lights from vr_haunted_house, circling the house with the
 * same path. Each stays dark until enough moments are done, then fades in.
 */
export class GhostSystem extends createSystem({
  ghosts: { required: [Ghost, PointLightComponent] },
}) {
  /** Authored intensity of each ghost's light, read once when it appears. */
  private brightness = new Map<Entity, number>();
  private presence = new Map<Entity, number>();

  init(): void {
    const attach = (e: Entity) => {
      if (this.brightness.has(e)) return;
      const brightness = e.getValue(PointLightComponent, 'intensity') ?? 6;
      const presence = this.wanted(e) ? 1 : 0;
      this.brightness.set(e, brightness);
      this.presence.set(e, presence);
      e.setValue(PointLightComponent, 'intensity', brightness * presence);
    };
    this.cleanupFuncs.push(
      this.queries.ghosts.subscribe('qualify', attach),
      this.queries.ghosts.subscribe('disqualify', (e) => {
        this.brightness.delete(e);
        this.presence.delete(e);
      }),
    );
    for (const e of this.queries.ghosts.entities) attach(e);
  }

  private wanted(e: Entity): boolean {
    return progress.count >= (e.getValue(Ghost, 'appearsAfter') ?? 0);
  }

  update(delta: number, time: number): void {
    for (const entity of this.queries.ghosts.entities) {
      const ghost = entity.object3D;
      if (ghost == null) continue;
      const center = entity.getVectorView(Ghost, 'center');
      const radius = entity.getValue(Ghost, 'radius') ?? 0;
      const angle = time * (entity.getValue(Ghost, 'speed') ?? 0);
      ghost.position.set(
        center[0] + Math.cos(angle) * radius,
        center[1] + Math.sin(angle) * Math.sin(angle * 2.34) * Math.sin(angle * 3.45),
        center[2] + Math.sin(angle) * radius,
      );

      const before = this.presence.get(entity) ?? 0;
      const target = this.wanted(entity) ? 1 : 0;
      const next = before + Math.sign(target - before) * Math.min(Math.abs(target - before), delta * 0.4);
      if (next === before) continue;
      if (before === 0 && next > 0 && progress.started) synth.ghostRise();
      this.presence.set(entity, next);
      entity.setValue(PointLightComponent, 'intensity', (this.brightness.get(entity) ?? 6) * smooth(next));
    }
  }
}

function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
