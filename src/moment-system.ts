import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  createSystem,
  Entity,
  Euler,
  Group,
  Hovered,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Points,
  PointsMaterial,
  Pressed,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { synth } from './audio.js';
import { Moment, MomentId } from './moment-component.js';
import { progress } from './progress.js';

/** How long each moment's own animation runs before it can be replayed. */
const DURATION: Record<MomentId, number> = { knock: 3.6, bushes: 3.4, graves: 3 };
const DOOR_OPEN = -1.15;
const MIST_PER_GRAVE = 5;
/** How far each grave settles into the ground once disturbed. */
const SINK = 0.12;

/** A soft round puff drawn in code, so mist particles aren't hard squares. */
function puffTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** A piece that shakes and remembers where it started. */
interface Shaker {
  object: Object3D;
  position: Vector3;
  rotation: Euler;
  scale: number;
}

/** Named parts of one placed prop, looked up once when it appears. */
interface Parts {
  id: MomentId;
  marker: Mesh;
  markerMat: MeshBasicMaterial;
  door?: Object3D;
  knocker?: Object3D;
  /** Bushes or graves, depending on the moment. */
  shakers: Shaker[];
  eyes?: Group;
  mist?: Points;
  mistAge?: Float32Array;
}

/**
 * Plays the yard moments, all on objects from the original scene: knock and
 * the door swings open, rustle the bushes and eyes open inside, disturb the
 * graves and mist seeps up. A press (click or controller trigger) records
 * progress and starts the animation; finished moments keep their end state.
 */
export class MomentSystem extends createSystem({
  moments: { required: [Moment] },
  pressed: { required: [Moment, Pressed] },
  hovered: { required: [Moment, Hovered] },
}) {
  private parts = new Map<Entity, Parts>();
  private now = 0;

  init(): void {
    this.cleanupFuncs.push(
      this.queries.moments.subscribe('qualify', (e) => this.attach(e)),
      this.queries.moments.subscribe('disqualify', (e) => this.parts.delete(e)),
      this.queries.pressed.subscribe('qualify', (e) => this.press(e)),
      progress.on((ev) => {
        if (ev.type === 'reset') for (const e of this.queries.moments.entities) this.restore(e);
      }),
    );
    for (const e of this.queries.moments.entities) this.attach(e);
  }

  private attach(entity: Entity): void {
    const root = entity.object3D;
    if (!root || this.parts.has(entity)) return;
    const id = entity.getValue(Moment, 'momentId') as MomentId;
    const find = (name: string) => root.getObjectByName(name) ?? undefined;
    const markerMat = new MeshBasicMaterial({ color: '#9dff8a', transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false });
    const marker = new Mesh(new RingGeometry(0.62, 0.7, 48).rotateX(-Math.PI / 2), markerMat);
    marker.name = 'MomentMarker';
    const spot = find('MarkerSpot');
    if (spot) marker.position.copy(spot.position);
    marker.position.y += 0.025;
    root.add(marker);
    const p: Parts = { id, marker, markerMat, shakers: [] };
    p.door = find('Door');
    p.knocker = find('Knocker');
    const prefix = id === 'bushes' ? 'Bush ' : id === 'graves' ? 'Grave ' : null;
    if (prefix) {
      for (const child of root.children) {
        if (!child.name.startsWith(prefix)) continue;
        p.shakers.push({ object: child, position: child.position.clone(), rotation: child.rotation.clone(), scale: child.scale.x });
      }
    }
    if (id === 'bushes' && p.shakers.length > 0) this.buildEyes(root, p);
    if (id === 'graves') this.buildMist(root, p);
    this.parts.set(entity, p);
    if (progress.done.has(id)) {
      entity.setValue(Moment, 'done', true);
      this.applyFinished(p);
    }
  }

  /** Two glowing eyes tucked into the front of the biggest bush. */
  private buildEyes(root: Object3D, p: Parts): void {
    const big = p.shakers.reduce((a, b) => (b.scale > a.scale ? b : a));
    const eyes = new Group();
    eyes.name = 'Eyes';
    const geo = new SphereGeometry(0.035, 10, 8);
    const mat = new MeshBasicMaterial({ color: '#e8ff5a', toneMapped: false });
    for (const x of [-0.07, 0.07]) {
      const eye = new Mesh(geo, mat);
      eye.position.x = x;
      eye.scale.set(1.3, 0.8, 0.5);
      eyes.add(eye);
    }
    eyes.position.set(big.position.x, big.position.y + big.scale * 0.45, big.position.z + big.scale * 0.88);
    eyes.visible = false;
    root.add(eyes);
    p.eyes = eyes;
  }

  /** Low puffs of mist that rise from every grave once they are disturbed. */
  private buildMist(root: Object3D, p: Parts): void {
    const n = p.shakers.length * MIST_PER_GRAVE;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    const mist = new Points(
      geo,
      new PointsMaterial({ color: '#a9c4c0', map: puffTexture(), size: 0.9, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    mist.name = 'GraveMist';
    mist.frustumCulled = false;
    mist.visible = false;
    root.add(mist);
    p.mist = mist;
    p.mistAge = new Float32Array(n);
    for (let i = 0; i < n; i++) p.mistAge[i] = (i % MIST_PER_GRAVE) / MIST_PER_GRAVE;
  }

  private press(entity: Entity): void {
    const p = this.parts.get(entity);
    if (!p || !progress.started) return;
    const started = entity.getValue(Moment, 'startedAt') ?? -1;
    if (started >= 0 && this.now - started < DURATION[p.id]) return;
    entity.setValue(Moment, 'startedAt', this.now);
    entity.setValue(Moment, 'done', true);
    p.marker.visible = false;
    const sound = { knock: () => synth.knock(), bushes: () => synth.rustle(), graves: () => synth.rumble() };
    sound[p.id]();
    progress.complete(p.id);
  }

  /** End state for a moment finished on an earlier visit (or just now). */
  private applyFinished(p: Parts): void {
    p.marker.visible = false;
    if (p.door) p.door.rotation.y = DOOR_OPEN;
    if (p.eyes) p.eyes.visible = true;
    if (p.mist) p.mist.visible = true;
    if (p.id === 'graves') for (const s of p.shakers) s.object.position.y = s.position.y - SINK;
  }

  private restore(entity: Entity): void {
    const p = this.parts.get(entity);
    if (!p) return;
    entity.setValue(Moment, 'done', false);
    entity.setValue(Moment, 'startedAt', -1);
    p.marker.visible = true;
    p.door?.rotation.set(0, 0, 0);
    p.knocker?.rotation.set(0, 0, 0);
    for (const s of p.shakers) {
      s.object.position.copy(s.position);
      s.object.rotation.copy(s.rotation);
    }
    if (p.eyes) p.eyes.visible = false;
    if (p.mist) p.mist.visible = false;
  }

  update(delta: number, time: number): void {
    this.now = time;
    for (const entity of this.queries.moments.entities) {
      const p = this.parts.get(entity);
      if (!p) continue;
      const done = entity.getValue(Moment, 'done') === true;
      const startedAt = entity.getValue(Moment, 'startedAt') ?? -1;
      // A moment restored from storage has no start time: treat it as long finished.
      const t = startedAt >= 0 ? time - startedAt : 1e4;
      if (!done) {
        p.markerMat.opacity = entity.hasComponent(Hovered) ? 0.95 : 0.32 + 0.2 * Math.sin(time * 2.6);
        continue;
      }
      if (p.id === 'knock') this.animateKnock(p, t);
      else if (p.id === 'bushes') this.animateBushes(p, t, time);
      else if (p.id === 'graves') this.animateGraves(p, t, delta);
    }
  }

  private animateKnock(p: Parts, t: number): void {
    if (t > DURATION.knock) return;
    if (p.knocker) {
      let lift = 0;
      for (let i = 0; i < 3; i++) {
        const k = (t - i * 0.45) / 0.3;
        if (k > 0 && k < 1) lift = Math.sin(Math.PI * k);
      }
      p.knocker.rotation.x = -0.55 * lift;
    }
    if (p.door) {
      const k = (t - 1.5) / 1.9;
      p.door.rotation.y = DOOR_OPEN * smooth(k) + (k > 0 && k < 1 ? 0.03 * Math.sin(k * 40) : 0);
    }
  }

  /** Thrash for a second and a half, then the eyes open and blink now and then. */
  private animateBushes(p: Parts, t: number, time: number): void {
    if (t < DURATION.bushes) {
      const amp = 0.22 * (1 - smooth(t / 1.6));
      p.shakers.forEach((s, i) => {
        const w = Math.sin(t * 31 + i * 1.9);
        s.object.rotation.set(s.rotation.x + amp * w, s.rotation.y, s.rotation.z + amp * Math.sin(t * 27 + i));
        s.object.position.x = s.position.x + amp * 0.15 * w;
      });
    }
    const eyes = p.eyes;
    if (!eyes) return;
    eyes.visible = t > 1.8;
    // Open slowly the first time, then a quick blink every few seconds.
    const open = smooth((t - 1.8) / 0.6);
    const blink = Math.sin(time * 0.9) > 0.985 ? 0.1 : 1;
    eyes.scale.set(1, Math.max(0.05, open * blink), 1);
  }

  /** Shudder, sink a little, then breathe mist from then on. */
  private animateGraves(p: Parts, t: number, delta: number): void {
    if (t < DURATION.graves) {
      const amp = 0.06 * (1 - smooth(t / DURATION.graves));
      p.shakers.forEach((s, i) => {
        s.object.rotation.set(
          s.rotation.x + amp * Math.sin(t * 40 + i * 2.3),
          s.rotation.y,
          s.rotation.z + amp * Math.sin(t * 35 + i * 1.1),
        );
        s.object.position.y = s.position.y - SINK * smooth(t / DURATION.graves);
      });
    }
    const mist = p.mist;
    const age = p.mistAge;
    if (!mist || !age || t < 0.8) return;
    mist.visible = true;
    const pos = mist.geometry.getAttribute('position') as BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < age.length; i++) {
      age[i] += delta / 6;
      if (age[i] > 1) age[i] -= 1;
      const a = age[i];
      const g = p.shakers[Math.floor(i / MIST_PER_GRAVE)].position;
      arr[i * 3] = g.x + Math.sin(a * 4 + i) * 0.35 * a;
      arr[i * 3 + 1] = 0.1 + a * 0.9;
      arr[i * 3 + 2] = g.z + Math.cos(a * 3 + i * 0.7) * 0.35 * a;
    }
    pos.needsUpdate = true;
  }
}
