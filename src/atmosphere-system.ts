import {
  AmbientLightComponent,
  createSystem,
  DirectionalLightComponent,
  DomeGradient,
  Entity,
  FogExp2,
  PointLightComponent,
} from '@iwsdk/core';
import { synth } from './audio.js';
import { MOMENT_ORDER, progress } from './progress.js';

type RGB = [number, number, number];
interface Key { at: number; sky: RGB; horizon: RGB; ground: RGB; moon: RGB; moonI: number; ambient: number; fog: RGB; fogD: number }

// Just after sunset → dusk → night → midnight. `at` is the night value 0..1.
// The last key is vr_haunted_house's own look: teal fog, cold blue moonlight.
const KEYS: Key[] = [
  { at: 0, sky: [0.3, 0.22, 0.4], horizon: [0.62, 0.36, 0.32], ground: [0.12, 0.09, 0.11], moon: [1, 0.68, 0.52], moonI: 1.4, ambient: 0.55, fog: [0.36, 0.26, 0.34], fogD: 0.045 },
  { at: 0.45, sky: [0.12, 0.1, 0.26], horizon: [0.3, 0.2, 0.32], ground: [0.05, 0.05, 0.08], moon: [0.7, 0.7, 0.95], moonI: 1.2, ambient: 0.42, fog: [0.14, 0.14, 0.24], fogD: 0.065 },
  { at: 0.75, sky: [0.03, 0.12, 0.17], horizon: [0.03, 0.17, 0.21], ground: [0.02, 0.06, 0.08], moon: [0.55, 0.78, 1], moonI: 1.05, ambient: 0.32, fog: [0.025, 0.18, 0.22], fogD: 0.085 },
  { at: 1, sky: [0.016, 0.204, 0.247], horizon: [0.016, 0.204, 0.247], ground: [0.016, 0.204, 0.247], moon: [0.525, 0.804, 1], moonI: 1, ambient: 0.275, fog: [0.016, 0.204, 0.247], fogD: 0.1 },
];

const DOOR_LIGHT = 5;
const FINALE_DELAY = 2.5;

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/**
 * Moves the yard from just after sunset to midnight as moments are done:
 * sky, fog, moonlight and a door light that starts to fail. Plays the finale
 * once they are all finished.
 */
export class AtmosphereSystem extends createSystem({}) {
  private night = 0;
  private sentNight = -1;
  private finaleAt = -1;
  private finalePlayed = false;
  private now = 0;
  /** Seconds left in the door light's current blackout. */
  private blackout = 0;
  private moon?: Entity;
  private ambient?: Entity;
  private door?: Entity;
  private mix: Key = { ...KEYS[0], sky: [0, 0, 0], horizon: [0, 0, 0], ground: [0, 0, 0], moon: [0, 0, 0], fog: [0, 0, 0] };

  init(): void {
    if (progress.finished) {
      this.finaleAt = 0;
      this.finalePlayed = true;
    }
    this.night = this.nightTarget();
    this.cleanupFuncs.push(
      progress.on((e) => {
        if (e.type === 'moment' && e.firstTime && progress.finished) this.finaleAt = this.now + FINALE_DELAY;
        if (e.type === 'reset') {
          this.finaleAt = -1;
          this.finalePlayed = false;
        }
      }),
    );
  }

  private midnight(): boolean {
    return this.finaleAt >= 0 && this.now >= this.finaleAt;
  }

  private nightTarget(): number {
    if (progress.finished) return this.midnight() ? 1 : 0.85;
    return (progress.count / MOMENT_ORDER.length) * 0.7;
  }

  update(delta: number, time: number): void {
    this.now = time;
    this.night += (this.nightTarget() - this.night) * Math.min(1, delta * 0.3);
    if (this.midnight() && !this.finalePlayed) {
      this.finalePlayed = true;
      synth.finale();
      progress.announceFinale();
    }
    this.applySky();
    this.updateDoorLight(delta, time);
    if (Math.abs(this.night - this.sentNight) > 0.01) {
      this.sentNight = this.night;
      synth.setNight(this.night);
    }
  }

  private applySky(): void {
    const n = this.night;
    let k = 0;
    while (k < KEYS.length - 2 && n > KEYS[k + 1].at) k++;
    const a = KEYS[k];
    const b = KEYS[k + 1];
    const t = smooth((n - a.at) / (b.at - a.at));
    const mix = this.mix;
    for (const f of ['sky', 'horizon', 'ground', 'moon', 'fog'] as const) {
      for (let c = 0; c < 3; c++) mix[f][c] = a[f][c] + (b[f][c] - a[f][c]) * t;
    }
    for (const f of ['moonI', 'ambient', 'fogD'] as const) mix[f] = a[f] + (b[f] - a[f]) * t;

    const root = this.world.activeLevel.peek();
    if (root?.hasComponent(DomeGradient)) {
      this.writeRGB(root, DomeGradient, 'sky', mix.sky);
      this.writeRGB(root, DomeGradient, 'equator', mix.horizon);
      this.writeRGB(root, DomeGradient, 'ground', mix.ground);
    }
    this.moon ??= this.world.getSceneEntity('moon-light') ?? undefined;
    this.ambient ??= this.world.getSceneEntity('ambient-light') ?? undefined;
    if (this.moon?.hasComponent(DirectionalLightComponent)) {
      this.writeRGB(this.moon, DirectionalLightComponent, 'color', mix.moon);
      this.moon.setValue(DirectionalLightComponent, 'intensity', mix.moonI);
    }
    if (this.ambient?.hasComponent(AmbientLightComponent)) this.ambient.setValue(AmbientLightComponent, 'intensity', mix.ambient);
    const fog = this.scene.fog;
    if (fog instanceof FogExp2) {
      fog.color.setRGB(mix.fog[0], mix.fog[1], mix.fog[2]);
      fog.density = mix.fogD;
    }
  }

  /** Steady at first; past halfway it stutters and sometimes goes out. */
  private updateDoorLight(delta: number, time: number): void {
    this.door ??= this.world.getSceneEntity('door-light') ?? undefined;
    if (!this.door?.hasComponent(PointLightComponent)) return;
    const unease = smooth((this.night - 0.4) / 0.6);
    if (this.blackout > 0) this.blackout -= delta;
    else if (Math.random() < unease * delta * 0.35) this.blackout = 0.08 + Math.random() * 0.9;
    const wobble = 1 - unease * 0.25 * (0.5 + 0.5 * Math.sin(time * 23) * Math.sin(time * 7.3));
    this.door.setValue(PointLightComponent, 'intensity', this.blackout > 0 ? DOOR_LIGHT * 0.05 : DOOR_LIGHT * wobble);
  }

  private writeRGB(entity: Entity, component: Parameters<Entity['getVectorView']>[0], field: string, rgb: RGB): void {
    // Color fields must be written through a vector view, never setValue.
    const v = (entity.getVectorView as (c: unknown, f: string) => Float32Array)(component, field);
    v[0] = rgb[0];
    v[1] = rgb[1];
    v[2] = rgb[2];
  }
}
