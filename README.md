# Hollow House

A short WebXR haunted-house visit built with IWSDK 1.1. It is the
`vr_haunted_house` scene (the three.js Journey lesson: a house, four bushes,
30 graves and three ghost lights), turned into a small experience in the style
of `lantern_ring`. There are three things to do in the yard, and each one
brings midnight closer. When all three are done, the night settles into the
original lesson's teal fog and all three ghosts are out.

```sh
npm install
npm run dev        # https://localhost:8084 (8083 is lantern_ring)
```

Desktop: **Step into the yard**, drag to look, WASD to walk, click the glowing rings.
VR: **Enter VR**, walk with the thumbstick, point and pull the trigger.
Add `?fresh` to the URL to ignore saved progress for one visit.

## The three moments

| # | Moment | What happens |
|---|--------|--------------|
| I | Knock at the door | Three knocks, then the door creaks open onto darkness |
| II | Rustle the bushes | The bushes thrash, then a pair of eyes opens inside |
| III | Disturb the graves | Every grave shudders and sinks, and mist seeps up |

Each one fades in one of the three ghosts and darkens the sky.

## How it is built

- **No model, texture or sound files.** Every mesh is three.js geometry in
  `src/scene-assets/`; flat colours replace the original's texture maps; every
  sound is synthesized in `src/audio.ts`.
- **Scene** – `public/scenes/main.iwsdk.scene.json` uses the original layout:
  floor, house, bushes and graves at `(0, 0, -3)`, the player at `(4, 0, 2)`.
- **Moments** – the door, bushes and graves carry a `Moment` component
  (`src/moment-component.ts`) plus `RayInteractable`. `src/moment-system.ts`
  plays them.
- **Ghosts** – `src/ghost-system.ts` moves the three ghost lights on the
  original's path. Each `Ghost` has an `appearsAfter` count.
- **Night** – `src/atmosphere-system.ts` blends the sky, fog, moonlight and
  ambient light from just after sunset to the original's midnight look, and
  makes the door light start to fail.
- **Text** – `src/hud.ts` is the flat-screen overlay; `src/caption-system.ts`
  draws a floating card that is also visible in a headset.
- **Progress** – `src/progress.ts` saves which moments are done in
  `localStorage` (`hollow-house:v1`). **Start over** clears it.

Ideas for scenery and moments that were drafted and then left out to keep
the scene like the original are in
`../vr_haunted_house_notes/2026-10-26-Hollow-House-Extras.md`.
