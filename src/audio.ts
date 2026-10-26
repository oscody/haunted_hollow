// Every sound in Hollow House is synthesized live with Web Audio: no files.
// The context can only start after a user gesture, so call start() from a
// click or XR session start; every other method is a no-op until then.

/** D harmonic minor, for the finale. */
const MINOR = [146.83, 164.81, 174.61, 196.0, 220.0, 233.08, 277.18, 293.66];

class Synth {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private windFilter!: BiquadFilterNode;
  private windGain!: GainNode;
  private drone!: GainNode;
  private night = 0;
  private timer = 0;

  start(muted: boolean): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = muted ? 0 : 0.8;
    this.master.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.startWind();
    this.startDrone();
    this.setNight(this.night);
    this.timer = window.setInterval(() => this.ambientTick(), 700);
  }

  setMuted(muted: boolean): void {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.1);
  }

  /** 0 = just after sunset (crickets), 1 = midnight (owls, howling wind, drone). */
  setNight(n: number): void {
    this.night = n;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windFilter.frequency.setTargetAtTime(360 + 320 * n, t, 1);
    this.windGain.gain.setTargetAtTime(0.05 + 0.05 * n, t, 1);
    this.drone.gain.setTargetAtTime(0.035 * n, t, 2);
  }

  dispose(): void {
    window.clearInterval(this.timer);
    void this.ctx?.close();
    this.ctx = null;
  }

  private startWind(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    // A narrow band-pass makes the noise howl rather than hiss.
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.Q.value = 4;
    this.windFilter.frequency.value = 360;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.09;
    const sweepDepth = ctx.createGain();
    sweepDepth.gain.value = 180;
    sweep.connect(sweepDepth).connect(this.windFilter.frequency);
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.05;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.035;
    swell.connect(swellDepth).connect(this.windGain.gain);
    src.connect(this.windFilter).connect(this.windGain).connect(this.master);
    src.start();
    sweep.start();
    swell.start();
  }

  /** Two slightly detuned low tones that beat slowly; silent until night falls. */
  private startDrone(): void {
    const ctx = this.ctx!;
    this.drone = ctx.createGain();
    this.drone.gain.value = 0;
    this.drone.connect(this.master);
    for (const f of [55, 55.6, 82.4]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(this.drone);
      o.start();
    }
  }

  private ambientTick(): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (Math.random() < 0.55 * (1 - this.night) + 0.05) this.cricket();
    if (Math.random() < 0.03 + 0.1 * this.night) this.owl();
  }

  private env(at: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    g.connect(this.master);
    return g;
  }

  private tone(type: OscillatorType, freq: number, at: number, peak: number, attack: number, decay: number): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    o.connect(this.env(at, peak, attack, decay));
    o.start(at);
    o.stop(at + attack + decay + 0.05);
    return o;
  }

  private burst(at: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number): BiquadFilterNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, at);
    f.Q.value = q;
    src.connect(f).connect(this.env(at, peak, 0.005, dur));
    src.start(at, Math.random());
    src.stop(at + dur + 0.05);
    return f;
  }

  private cricket(): void {
    const t = this.ctx!.currentTime + Math.random() * 0.5;
    const f = 4300 + Math.random() * 500;
    for (let i = 0; i < 3; i++) this.tone('sine', f, t + i * 0.045, 0.012, 0.004, 0.03);
  }

  /** A distant owl: hoo, hoo-hoo. */
  private owl(): void {
    const t = this.ctx!.currentTime + Math.random() * 0.4;
    const f = 380 + Math.random() * 40;
    [0, 0.55, 0.8].forEach((dt, i) => {
      const o = this.tone('sine', f, t + dt, 0.035, 0.05, i === 0 ? 0.35 : 0.22);
      o.frequency.exponentialRampToValueAtTime(f * 0.92, t + dt + 0.3);
    });
  }

  /** A wooden creak: a buzzy tone squeezed through a resonant filter. */
  private creakAt(at: number, dur: number, from: number, to: number, peak: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(from, at);
    o.frequency.linearRampToValueAtTime(to, at + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 9;
    f.frequency.setValueAtTime(900, at);
    f.frequency.linearRampToValueAtTime(1300, at + dur);
    o.connect(f).connect(this.env(at, peak, 0.05, dur));
    o.start(at);
    o.stop(at + dur + 0.1);
  }

  /** Three knocks on wood, then the door creaks slowly open. */
  knock(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.45;
      this.burst(at, 0.09, 'lowpass', 420, 1, 0.5);
      const o = this.tone('sine', 110, at, 0.35, 0.003, 0.16);
      o.frequency.exponentialRampToValueAtTime(70, at + 0.15);
    }
    this.creakAt(t + 1.55, 1.8, 70, 120, 0.06);
  }





  /** Leaves thrashing, then a low growl from inside the bushes. */
  rustle(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    for (let i = 0; i < 14; i++) this.burst(t + i * 0.11 + Math.random() * 0.04, 0.14, 'bandpass', 3000 + Math.random() * 1500, 0.8, 0.16 * (1 - i / 18));
    const at = t + 1.7;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(62, at);
    o.frequency.linearRampToValueAtTime(48, at + 1.6);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    // A fast wobble on the gain makes the tone rattle like a throat.
    const rattle = ctx.createOscillator();
    rattle.frequency.value = 23;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    rattle.connect(depth).connect(g.gain);
    o.connect(f).connect(g).connect(this.env(at, 0.22, 0.3, 1.4));
    o.start(at);
    rattle.start(at);
    o.stop(at + 1.8);
    rattle.stop(at + 1.8);
  }

  /** The ground rumbling, then breathy whispers that rise and fall. */
  rumble(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    this.burst(t, 2.6, 'lowpass', 110, 1, 0.5);
    this.tone('sine', 41, t, 0.25, 0.4, 2.4);
    for (let i = 0; i < 4; i++) {
      const at = t + 1.2 + i * 0.55;
      const f = this.burst(at, 0.7, 'bandpass', 900 + Math.random() * 600, 6, 0.09);
      f.frequency.exponentialRampToValueAtTime(1800 + Math.random() * 700, at + 0.5);
    }
  }

  /** A soft, low swell as a ghost fades in. */
  ghostRise(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.05;
    const o = this.tone('sine', 220, t, 0.05, 1.2, 2.5);
    o.frequency.exponentialRampToValueAtTime(330, t + 3.5);
    this.tone('sine', 223, t, 0.03, 1.2, 2.5);
  }

  /** Midnight: a slow minor arpeggio over a low organ chord. */
  finale(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.05;
    [0, 2, 4, 6, 7].forEach((n, i) => this.tone('triangle', MINOR[n] * 2, t + i * 0.5, 0.08, 0.01, 4.5));
    for (const f of [73.42, 110, 146.83, 174.61]) this.tone('sawtooth', f, t, 0.018, 1.5, 7);
  }
}

export const synth = new Synth();
