# UNHINGED.EXE

A neon top-down arena shooter designed, run, and constantly sabotaged by **GERALD**, an AI game director who has stopped taking his patches.

## Play

- **Mac:** double-click `run.command`
- **Anywhere with Node 18+:** `npm start` → opens http://localhost:8787

No dependencies, no build step, no assets: every sound and sprite is generated in code.

| Key | Action |
| --- | --- |
| WASD / arrows | move |
| Mouse | aim |
| Click (hold) | shoot |
| Space | dash (brief invincibility) |
| P / Esc | pause (GERALD may refuse) |
| M | mute |
| V | toggle GERALD's spoken voice / robot babble |

## What GERALD does

- **Rewrites the rules** every few seconds: 31 mutations including inverted controls, gravity, screen spin, Australia mode, mirror world, rubber-duck enemies, floor-is-lava, pacifist mode (shooting hurts *you*; run in circles to kill with love), hidden health bar, stolen crosshair, darkness, enemy mitosis, fake blue screen of death, evil clones, Comic Sans.
- **Escalates** through 5 chaos levels (one every 45 s). More rules stack at once as he gets worse.
- **Offers deals** in Windows 98 popups. Some buttons run away from your cursor. Some choices are all "YES".
- **Heckles you** about kill streaks, damage, idling, and alt-tabbing. Rewrites the tab title while you're away.
- **Remembers you** across sessions: your name (which he mangles), deaths, best score.
- **Final boss** at chaos level 5: GERALD.EXE himself. Delete him to win.

## Code map

| File | Role |
| --- | --- |
| `src/mods.js` | Rule flags + how stacked mutations combine |
| `src/mutations.js` | Every rule change GERALD can make |
| `src/director.js` | GERALD's brain: chaos, mutation rotation, deals, reactions |
| `src/lines.js` | All dialogue and deals |
| `src/game.js` | Simulation and canvas rendering |
| `src/ui.js` | Speech box, banner, popups, fake BSOD |
| `src/audio.js` | Synth SFX, procedural music, voice |
| `src/main.js` | Boot, input, profile, screens |

Add a mutation by appending to `MUTATIONS` in `src/mutations.js`. Use `mods` for rule flags from `DEFAULT_MODS`, plus `enter`/`exit` hooks for side effects.

## Tests

```sh
npm test
```
