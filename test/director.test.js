import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeMods, DEFAULT_MODS } from '../src/mods.js';
import { Director, CHAOS_STEP, MAX_CHAOS } from '../src/director.js';
import { MUTATIONS } from '../src/mutations.js';

function fakeGame() {
  const g = {
    bosses: 0,
    say() {},
    announce() {},
    flash() {},
    spawnBoss() {
      g.bosses++;
    },
    spawnEnemy() {},
    spawnPickup() {},
    ui: { fakeCrash() {}, modal: async () => null },
    profile: { name: 'Tester', deaths: 0 },
    score: 0,
    kills: 0,
    player: { hp: 6 },
    bigText: null,
    over: false,
  };
  g.director = new Director(g);
  return g;
}

test('composeMods: booleans OR, additive keys sum, other numbers multiply', () => {
  const m = composeMods([
    { invertX: true, gravity: 100, timeScale: 2 },
    { invertX: false, gravity: 50, timeScale: 0.5, rotation: 1 },
  ]);
  assert.equal(m.invertX, true);
  assert.equal(m.gravity, 150);
  assert.equal(m.timeScale, 1);
  assert.equal(m.rotation, 1);
});

test('composeMods rejects mods that the game does not understand', () => {
  assert.throws(() => composeMods([{ invertZ: true }]), /Unknown mod/);
});

test('every mutation only declares known mods', () => {
  for (const m of MUTATIONS) {
    const mods = typeof m.mods === 'function' ? m.mods() : m.mods ?? {};
    assert.doesNotThrow(() => composeMods([mods]), m.id);
  }
});

test('director never stacks more rules than the chaos level allows', () => {
  const g = fakeGame();
  const d = g.director;
  for (let level = 1; level <= MAX_CHAOS; level++) {
    d.chaos = level;
    for (let i = 0; i < 20; i++) d.mutate();
    assert.ok(d.active.length <= Math.min(3, level), `chaos ${level}: ${d.active.length} active`);
  }
});

test('clearing the director restores default rules and runs exit hooks', () => {
  const g = fakeGame();
  const d = g.director;
  d.chaos = 3;
  d.mutate('bigtext');
  d.mutate('inverted');
  d.mutate('gravity');
  assert.ok(g.bigText);
  assert.equal(d.mods.invertX, true);
  d.clear();
  assert.deepEqual(d.mods, { ...DEFAULT_MODS });
  assert.equal(g.bigText, null);
});

test('timed mutations expire on their own', () => {
  const g = fakeGame();
  const d = g.director;
  d.nextMutation = Infinity;
  d.nextDeal = Infinity;
  const inst = d.mutate('gift');
  d.update(inst.duration + 0.1);
  assert.equal(d.active.includes(inst), false);
});

test('chaos escalates over time and the boss arrives exactly once at max chaos', () => {
  const g = fakeGame();
  const d = g.director;
  d.nextDeal = Infinity;
  for (let t = 0; t < CHAOS_STEP * (MAX_CHAOS + 2); t += 0.5) d.update(0.5);
  assert.equal(d.chaos, MAX_CHAOS);
  assert.equal(g.bosses, 1);
});
