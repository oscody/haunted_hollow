import { MomentId, MomentIds } from './moment-component.js';

// Which moments are done, plus the words shown for each. Saved per browser;
// add ?fresh to the URL to start without (and without touching) saved progress.

export const MOMENT_ORDER: MomentId[] = [
  MomentIds.Knock,
  MomentIds.Bushes,
  MomentIds.Graves,
];

export const MOMENT_TEXT: Record<MomentId, { num: string; title: string; hint: string; done: string }> = {
  knock: { num: 'I', title: 'Knock at the door', hint: 'The front door of the house', done: 'Three knocks echo inside, and the door creaks open on its own.' },
  bushes: { num: 'II', title: 'Rustle the bushes', hint: 'Beside the front door', done: 'Something in the bushes opens its eyes, and watches you.' },
  graves: { num: 'III', title: 'Disturb the graves', hint: 'Any of the graves around the house', done: 'The graves shudder, and cold mist seeps up out of the earth.' },
};

export const FINALE_TEXT = {
  num: 'XII',
  title: 'Midnight at Hollow House',
  done: 'All three ghosts have come home. Stay as long as you dare.',
};

export type ProgressEvent =
  | { type: 'moment'; id: MomentId; firstTime: boolean }
  | { type: 'reset' }
  | { type: 'started' }
  | { type: 'finale' };

const KEY = 'hollow-house:v1';
const fresh = new URLSearchParams(location.search).has('fresh');

class Progress {
  readonly done = new Set<MomentId>();
  started = false;
  muted = false;
  private listeners = new Set<(e: ProgressEvent) => void>();

  constructor() {
    if (fresh) return;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      for (const id of saved?.done ?? []) if (MOMENT_ORDER.includes(id)) this.done.add(id);
      this.muted = saved?.muted === true;
    } catch {
      // Storage can be blocked (private mode); progress then lasts one visit.
    }
  }

  get count(): number {
    return this.done.size;
  }

  get finished(): boolean {
    return this.done.size === MOMENT_ORDER.length;
  }

  on(fn: (e: ProgressEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.emit({ type: 'started' });
  }

  /** Marks a moment done (or replays it); listeners hear about both. */
  complete(id: MomentId): void {
    const firstTime = !this.done.has(id);
    this.done.add(id);
    this.save();
    this.emit({ type: 'moment', id, firstTime });
  }

  reset(): void {
    this.done.clear();
    this.save();
    this.emit({ type: 'reset' });
  }

  /** Called once the last moment's evening has fully arrived. */
  announceFinale(): void {
    this.emit({ type: 'finale' });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.save();
  }

  private emit(e: ProgressEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  private save(): void {
    if (fresh) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ done: [...this.done], muted: this.muted }));
    } catch {
      // See constructor.
    }
  }
}

export const progress = new Progress();
