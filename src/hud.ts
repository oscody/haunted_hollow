import { VisibilityState, World } from '@iwsdk/core';
import { synth } from './audio.js';
import { FINALE_TEXT, MOMENT_ORDER, MOMENT_TEXT, progress } from './progress.js';

// The flat-screen overlay: intro card, moment checklist, toast and buttons.
// None of this is visible inside a headset; CaptionSystem covers that.

const html = String.raw;

export function mountHud(world: World): void {
  const root = document.getElementById('ui-root')!;
  root.innerHTML = html`
    <section id="intro" class="card">
      <p class="seal">☾</p>
      <h1>Hollow House</h1>
      <p class="sub">An old house among the graves, just after sunset.</p>
      <p>Three things are waiting in the yard. Each one you do brings midnight a little closer.</p>
      <div class="actions">
        <button id="btn-enter" class="primary">Step into the yard</button>
        <button id="btn-vr" hidden>Enter VR</button>
      </div>
      <p class="foot">Best with sound on, and the lights off.</p>
    </section>
    <aside id="hud" hidden>
      <h2>☾ <span>Hollow House</span></h2>
      <p id="count"></p>
      <ol id="list"></ol>
    </aside>
    <p id="help" hidden>Drag to look · WASD to walk · click the glowing rings</p>
    <div id="tools" hidden>
      <button id="btn-vr2" hidden>Enter VR</button>
      <button id="btn-mute"></button>
      <button id="btn-reset">Start over</button>
    </div>
    <p id="toast" role="status"></p>
  `;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const intro = $('intro');
  const list = $('list');
  const toast = $('toast');
  const mute = $('btn-mute');
  let toastTimer = 0;

  const render = () => {
    $('count').textContent = progress.finished ? 'It is midnight.' : `${progress.count} of ${MOMENT_ORDER.length} moments`;
    list.innerHTML = MOMENT_ORDER.map((id) => {
      const t = MOMENT_TEXT[id];
      const done = progress.done.has(id);
      return `<li class="${done ? 'done' : ''}"><b>${t.num}</b> ${t.title}<small>${done ? 'done' : t.hint}</small></li>`;
    }).join('');
    mute.textContent = progress.muted ? 'Sound off' : 'Sound on';
  };
  const say = (text: string) => {
    toast.textContent = text;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 5200);
  };
  const begin = () => {
    synth.start(progress.muted);
    progress.start();
  };

  $('btn-enter').addEventListener('click', begin);
  const enterVR = () => {
    begin();
    world.launchXR();
  };
  $('btn-vr').addEventListener('click', enterVR);
  $('btn-vr2').addEventListener('click', enterVR);
  mute.addEventListener('click', () => {
    progress.setMuted(!progress.muted);
    synth.setMuted(progress.muted);
    render();
  });
  $('btn-reset').addEventListener('click', () => {
    progress.reset();
    say('The sun has only just set. Again.');
  });

  void navigator.xr?.isSessionSupported('immersive-vr').then((ok) => {
    $('btn-vr').hidden = !ok;
    $('btn-vr2').hidden = !ok;
  });

  // Entering VR from the browser's own prompt also counts as stepping inside.
  world.visibilityState.subscribe((state) => {
    if (state !== VisibilityState.NonImmersive) begin();
  });

  progress.on((e) => {
    if (e.type === 'started') {
      intro.hidden = true;
      for (const id of ['hud', 'help', 'tools']) $(id).hidden = false;
    }
    if (e.type === 'moment') say(`${MOMENT_TEXT[e.id].title} — ${MOMENT_TEXT[e.id].done}`);
    if (e.type === 'finale') say(`${FINALE_TEXT.title}. ${FINALE_TEXT.done}`);
    render();
  });
  render();
}
