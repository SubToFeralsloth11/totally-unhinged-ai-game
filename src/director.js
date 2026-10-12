// GERALD's brain: escalates chaos, rotates mutations, interrupts with deals, and
// heckles. Talks to the game only through the `game` interface so it stays testable.
import { composeMods } from './mods.js';
import { MUTATIONS, eligibleMutations } from './mutations.js';
import { LINES, DEALS } from './lines.js';
import { pick, rand, fmt, shuffle } from './util.js';

export const CHAOS_STEP = 45; // seconds per chaos level
export const MAX_CHAOS = 5;
const RECENT_MEMORY = 6;

export class Director {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.chaos = 1;
    this.active = []; // { def, mods, age, duration }
    this.recent = [];
    this.nextMutation = 5;
    this.nextDeal = rand(30, 40);
    this.bossSpawned = false;
    this.streak = 0;
    this.idleTime = 0;
    this.lastHurtLine = -99;
    this.lastLowHpLine = -99;
    this.mods = composeMods([]);
  }

  get maxActive() {
    return Math.min(3, this.chaos);
  }

  get interval() {
    return Math.max(6, 13 - this.chaos * 1.4);
  }

  update(dt) {
    this.time += dt;
    const chaos = Math.min(MAX_CHAOS, 1 + Math.floor(this.time / CHAOS_STEP));
    if (chaos > this.chaos) {
      this.chaos = chaos;
      this.game.say(LINES.chaosUp[chaos], { glitch: true });
      this.game.flash('#ff00aa');
      if (chaos === MAX_CHAOS && !this.bossSpawned) {
        this.bossSpawned = true;
        this.game.spawnBoss();
        this.game.say(pick(LINES.boss), { glitch: true });
      }
    }

    for (const inst of this.active) {
      inst.age += dt;
      inst.def.update?.(this.game, dt, inst);
    }
    for (const inst of this.active.filter((i) => i.duration !== undefined && i.age >= i.duration)) {
      this.remove(inst);
    }

    this.nextMutation -= dt;
    if (this.nextMutation <= 0) {
      this.nextMutation = this.interval;
      this.mutate();
    }

    this.nextDeal -= dt;
    if (this.nextDeal <= 0) {
      this.nextDeal = rand(40, 60);
      this.offerDeal();
    }

    this.mods = composeMods(this.active.map((i) => i.mods));
  }

  mutate(forcedId) {
    let def;
    if (forcedId) {
      def = MUTATIONS.find((m) => m.id === forcedId);
      if (!def) throw new Error(`Unknown mutation ${forcedId}`);
    } else {
      const exclude = new Set([...this.recent, ...this.active.map((i) => i.def.id)]);
      let options = eligibleMutations(this.chaos, exclude);
      if (!options.length) options = eligibleMutations(this.chaos, new Set(this.active.map((i) => i.def.id)));
      if (!options.length) return null;
      def = pick(options);
    }

    const existing = this.active.find((i) => i.def.id === def.id);
    if (existing) this.remove(existing);
    while (this.active.length >= this.maxActive) this.remove(this.active[0]);

    const inst = {
      def,
      mods: typeof def.mods === 'function' ? def.mods() : def.mods ?? {},
      age: 0,
      duration: def.duration,
    };
    this.active.push(inst);
    this.recent.push(def.id);
    if (this.recent.length > RECENT_MEMORY) this.recent.shift();
    def.enter?.(this.game, inst);
    this.game.announce(def.name);
    this.game.say(fmt(pick(def.lines), this.vars()));
    this.mods = composeMods(this.active.map((i) => i.mods));
    return inst;
  }

  remove(inst) {
    const idx = this.active.indexOf(inst);
    if (idx === -1) return;
    this.active.splice(idx, 1);
    inst.def.exit?.(this.game, inst);
    this.mods = composeMods(this.active.map((i) => i.mods));
  }

  clear() {
    for (const inst of [...this.active]) this.remove(inst);
  }

  async offerDeal() {
    const deal = pick(DEALS);
    const effects = deal.shuffleEffects ? shuffle(deal.effects) : deal.effects;
    const choice = await this.game.ui.modal(deal);
    if (choice === null || this.game.over) return;
    const reply = effects[choice](this.game);
    this.game.say(reply);
  }

  // --- reactions -------------------------------------------------------
  vars(extra = {}) {
    const g = this.game;
    return { name: g.profile.name, deaths: g.profile.deaths, score: g.score, kills: g.kills, streak: this.streak, ...extra };
  }

  onKill() {
    this.streak++;
    if (this.streak > 0 && this.streak % 15 === 0) this.game.say(fmt(pick(LINES.streak), this.vars()));
  }

  onHurt() {
    this.streak = 0;
    const p = this.game.player;
    if (p.hp <= 2 && this.time - this.lastLowHpLine > 20) {
      this.lastLowHpLine = this.time;
      this.game.say(pick(LINES.lowHp));
    } else if (this.time - this.lastHurtLine > 9) {
      this.lastHurtLine = this.time;
      this.game.say(pick(LINES.hurt), { quiet: true });
    }
  }

  onIdle(dt, moving) {
    this.idleTime = moving ? 0 : this.idleTime + dt;
    if (this.idleTime > 6) {
      this.idleTime = -10;
      this.game.say(pick(LINES.idle));
      for (let i = 0; i < 4; i++) this.game.spawnEnemy('cursor');
    }
  }
}
