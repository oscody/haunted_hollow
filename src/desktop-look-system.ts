import { createSystem, LocomotionSystem, Vector3, VisibilityState } from '@iwsdk/core';
import { SPAWN, SPAWN_YAW } from './layout.js';
import { progress } from './progress.js';

const EYE = 1.6;
const LOOK = 0.0042; // radians per dragged pixel

/**
 * Browser (non-headset) view: drag to look around. Walking uses IWSDK's
 * built-in browser locomotion controls (keyboard / gamepad, enabled in
 * iwsdk.config.json), which move relative to the direction set here.
 * Inside XR the headset owns the view instead.
 */
export class DesktopLookSystem extends createSystem({}) {
  private yaw = SPAWN_YAW;
  private pitch = -0.08;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private moved = 0;
  private spawn = new Vector3(SPAWN[0], SPAWN[1], SPAWN[2]);

  init(): void {
    const el = this.renderer.domElement;
    const down = (e: PointerEvent) => {
      this.dragging = true;
      this.moved = 0;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!this.dragging || !progress.started) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      // Ignore the jitter of an ordinary click so it still presses things.
      this.moved += Math.abs(dx) + Math.abs(dy);
      if (this.moved < 4) return;
      this.yaw -= dx * LOOK;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - dy * LOOK));
    };
    const up = () => (this.dragging = false);
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    this.cleanupFuncs.push(
      () => el.removeEventListener('pointerdown', down),
      () => window.removeEventListener('pointermove', move),
      () => window.removeEventListener('pointerup', up),
      progress.on((e) => {
        if (e.type !== 'reset') return;
        // Locomotion owns the player position, so move through it.
        this.world.getSystem(LocomotionSystem)?.setPlayerPosition(this.spawn);
        this.yaw = SPAWN_YAW;
        this.pitch = -0.08;
      }),
    );
  }

  update(): void {
    if (!progress.started || this.world.visibilityState.peek() !== VisibilityState.NonImmersive) return;
    this.player.rotation.set(0, this.yaw, 0);
    this.camera.position.set(0, EYE, 0);
    this.camera.rotation.set(this.pitch, 0, 0);
  }
}
