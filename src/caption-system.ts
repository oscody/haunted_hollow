import {
  CanvasTexture,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import { Moment, MomentId } from './moment-component.js';
import { FINALE_TEXT, MOMENT_ORDER, MOMENT_TEXT, progress } from './progress.js';

const SHOW_SECONDS = 6.5;
const W = 1024;
const H = 340;

/**
 * A world-space text card that appears above a moment when it is done (and in
 * front of the visitor for the finale). Unlike the HTML overlay it is visible
 * inside a headset.
 */
export class CaptionSystem extends createSystem({ moments: { required: [Moment] } }) {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private texture = new CanvasTexture(this.canvas);
  private material = new MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false, depthWrite: false, opacity: 0 });
  private card = new Mesh(new PlaneGeometry(1.7, (1.7 * H) / W), this.material);
  private shownAt = -100;
  private now = 0;
  private head = new Vector3();
  private anchor = new Vector3();
  private pendingFinale = false;

  init(): void {
    this.canvas.width = W;
    this.canvas.height = H;
    this.texture.colorSpace = SRGBColorSpace;
    this.card.name = 'Caption';
    this.card.renderOrder = 10;
    this.card.visible = false;
    this.world.createTransformEntity(this.card);
    this.cleanupFuncs.push(
      progress.on((e) => {
        if (e.type === 'moment') this.showMoment(e.id);
        if (e.type === 'finale') this.pendingFinale = true;
        if (e.type === 'reset') this.shownAt = -100;
      }),
    );
  }

  private showMoment(id: MomentId): void {
    for (const entity of this.queries.moments.entities) {
      if (entity.getValue(Moment, 'momentId') !== id || !entity.object3D) continue;
      // Props centred on the house mark their press spot; rise above that instead.
      (entity.object3D.getObjectByName('MarkerSpot') ?? entity.object3D).getWorldPosition(this.anchor);
      const y = this.anchor.y + 2.7;
      // Bring the card 1.2 m toward the visitor so it clears the roof, but
      // never closer than 2.2 m.
      this.player.head.getWorldPosition(this.head);
      this.anchor.sub(this.head).setY(0);
      const d = this.anchor.length();
      if (d > 1e-3) this.anchor.multiplyScalar(Math.max(2.2, d - 1.2) / d);
      this.anchor.add(this.head).setY(y);
    }
    const t = MOMENT_TEXT[id];
    const count = progress.finished ? 'All done · midnight is coming' : `${progress.count} of ${MOMENT_ORDER.length} moments`;
    this.draw(t.num, t.title, t.done, count);
  }

  private showFinale(): void {
    // 2.4 m in front of the visitor, at eye height.
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldDirection(this.anchor);
    this.anchor.y = 0;
    if (this.anchor.lengthSq() < 1e-4) this.anchor.set(0, 0, -1);
    // getWorldDirection returns +Z of the head; the view looks down -Z.
    this.anchor.normalize().multiplyScalar(-2.4).add(this.head);
    this.draw(FINALE_TEXT.num, FINALE_TEXT.title, FINALE_TEXT.done, '');
  }

  private draw(num: string, title: string, line: string, foot: string): void {
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(12, 10, 18, 0.85)';
    c.strokeStyle = 'rgba(157, 255, 138, 0.75)';
    c.lineWidth = 4;
    c.beginPath();
    c.roundRect(6, 6, W - 12, H - 12, 28);
    c.fill();
    c.stroke();
    c.textAlign = 'center';
    c.fillStyle = '#ff9a3c';
    c.font = '600 60px Georgia, serif';
    c.fillText(num, W / 2, 88);
    c.fillStyle = '#efe8f5';
    c.font = '600 46px Georgia, serif';
    c.fillText(title, W / 2, 152);
    c.font = 'italic 32px Georgia, serif';
    c.fillStyle = '#cfc6dc';
    this.wrap(line, W / 2, 210, W - 120, 40);
    c.font = '26px Georgia, serif';
    c.fillStyle = '#8f88a2';
    c.fillText(foot, W / 2, H - 34);
    this.texture.needsUpdate = true;
    this.card.position.copy(this.anchor);
    this.card.visible = true;
    this.shownAt = this.now;
  }

  private wrap(text: string, x: number, y: number, max: number, lh: number): void {
    let row = '';
    for (const word of text.split(' ')) {
      const test = row ? `${row} ${word}` : word;
      if (this.ctx.measureText(test).width > max && row) {
        this.ctx.fillText(row, x, y);
        row = word;
        y += lh;
      } else row = test;
    }
    this.ctx.fillText(row, x, y);
  }

  update(_delta: number, time: number): void {
    this.now = time;
    if (this.pendingFinale) {
      this.pendingFinale = false;
      this.showFinale();
    }
    const age = time - this.shownAt;
    if (age > SHOW_SECONDS) {
      this.card.visible = false;
      return;
    }
    this.material.opacity = Math.min(1, age / 0.4, (SHOW_SECONDS - age) / 0.8);
    this.player.head.getWorldPosition(this.head);
    this.head.y = this.card.position.y;
    this.card.lookAt(this.head);
  }
}
