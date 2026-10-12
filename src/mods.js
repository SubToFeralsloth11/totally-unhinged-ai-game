// Rule modifiers that GERALD's mutations toggle. The live set is recomputed every
// frame from the active mutations, so removing a mutation can never leave a rule stuck.

export const DEFAULT_MODS = Object.freeze({
  // movement / controls
  invertX: false,
  invertY: false,
  ice: false, // momentum-based sliding
  gravity: 0, // px/s^2 pulling everything down (additive)
  wrap: false, // leave one edge, enter the opposite
  playerSpeed: 1,
  // time
  timeScale: 1,
  // weapons
  bulletScale: 1,
  bulletSpeed: 1,
  fireRate: 1,
  backwardsGun: false,
  pacifist: false, // your bullets hurt you, enemies die when you spin
  aimOffsetX: 0, // additive crosshair drift
  aimOffsetY: 0,
  // enemies
  enemySpeed: 1,
  enemyScale: 1,
  ducks: false,
  splitters: false,
  enemiesShoot: false,
  spawnRate: 1,
  // player
  playerScale: 1,
  lavaFloor: false, // standing still hurts
  hideHp: false,
  // camera / screen
  rotation: 0, // radians, additive
  spin: 0, // radians per second, additive
  mirror: false,
  zoom: 1,
  darkness: false,
  disco: false,
  comicSans: false,
  shake: 0, // additive
});

// Numbers listed here add together when several mutations touch them; every other
// number multiplies. Booleans OR together.
export const ADDITIVE = new Set(['gravity', 'rotation', 'spin', 'aimOffsetX', 'aimOffsetY', 'shake']);

export function composeMods(activeMods) {
  const out = { ...DEFAULT_MODS };
  for (const mods of activeMods) {
    for (const [key, value] of Object.entries(mods)) {
      if (!(key in DEFAULT_MODS)) throw new Error(`Unknown mod "${key}"`);
      const base = out[key];
      if (typeof base === 'boolean') out[key] = base || Boolean(value);
      else if (ADDITIVE.has(key)) out[key] = base + value;
      else out[key] = base * value;
    }
  }
  return out;
}
