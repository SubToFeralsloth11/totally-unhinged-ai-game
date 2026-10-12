// Simulation + rendering for one run. GERALD (Director) bends the rules through `mods`.
import { Director } from './director.js';
import { LINES } from './lines.js';
import { W, H, rand, pick, clamp, lerp, dist2, chance } from './util.js';

const PLAYER_R = 14;
const MAX_ENEMIES = 80;

const ENEMY_TYPES = {
  bug: { r: 14, hp: 1, speed: 115, score: 10, color: '#b6ff3b' },
  cursor: { r: 11, hp: 1, speed: 230, score: 15, color: '#ffffff' },
  popup: { r: 24, hp: 3, speed: 55, score: 30, color: '#ff2fa8', shoots: 2.6 },
  captcha: { r: 30, hp: 9, speed: 42, score: 60, color: '#e8e8e8', minChaos: 2 },
  clone: { r: 14, hp: 2, speed: 150, score: 40, color: '#ff3b3b', shoots: 1.8, spawnOnly: true },
};

export class Game {
  constructor({ canvas, ui, audio, profile, onEnd }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.audio = audio;
    this.profile = profile;
    this.onEnd = onEnd;
    this.input = { keys: new Set(), mouseX: W / 2, mouseY: H / 2, mouseDown: false };
    this.player = {
      x: W / 2, y: H / 2, vx: 0, vy: 0, hp: 6, maxHp: 6,
      speed: 320, fireRate: 1, multishot: 1, pierce: 0,
      fireCd: 0, iframes: 0, dashT: 0, dashCd: 0, aim: 0,
      still: 0, lavaCd: 0, heading: 0, spinAccum: 0, zapCd: 0,
    };
    this.bullets = [];
    this.enemies = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];
    this.score = 0;
    this.kills = 0;
    this.time = 0;
    this.spawnT = 1;
    this.over = false;
    this.won = false;
    this.paused = false;
    this.boss = null;
    this.bigText = null;
    this.flashColor = null;
    this.flashT = 0;
    this.shakeT = 0;
    this.angle = 0;
    this.cam = { x: W / 2, y: H / 2 };
    this.camMatrix = new DOMMatrix();
    this.camInverse = new DOMMatrix();
    this.lastBossLine = 0;
    this.director = new Director(this);
  }

  get mods() {
    return this.director.mods;
  }

  get frozen() {
    return this.paused || this.ui.modalOpen || this.ui.crashing || this.over;
  }

  // --- interface used by GERALD -----------------------------------------
  say(text, opts) {
    this.ui.say(text, opts);
  }
  announce(name) {
    this.ui.announce(name);
    this.flash('#ffe600');
  }
  flash(color) {
    this.flashColor = color;
    this.flashT = 0.35;
  }
  forceMutation(id) {
    this.director.mutate(id);
  }

  nuke() {
    this.audio.sfx('explode');
    this.flash('#ffffff');
    this.shakeT = 0.6;
    for (const e of [...this.enemies]) {
      if (e.type === 'boss') this.damageEnemy(e, 25);
      else this.killEnemy(e, false);
    }
    this.bullets = this.bullets.filter((b) => b.friendly);
  }

  spawnEnemy(type, x, y, gen = 0) {
    if (this.enemies.length >= MAX_ENEMIES) return null;
    const t = ENEMY_TYPES[type];
    if (x === undefined) {
      const side = Math.floor(rand(4));
      x = side === 0 ? -30 : side === 1 ? W + 30 : rand(W);
      y = side === 2 ? -30 : side === 3 ? H + 30 : rand(H);
    }
    const e = {
      type, x, y, vx: 0, vy: 0, r: t.r * (gen ? 0.7 ** gen : 1), hp: Math.max(1, Math.ceil(t.hp / (gen + 1))),
      speed: t.speed * rand(0.85, 1.15), gen, shootCd: rand(1, 3), wob: rand(10), hitT: 0,
      label: pick(['HOT SINGLES', 'YOU WON!!', 'FREE RAM', '1 VIRUS!!', 'CLICK ME']),
    };
    this.enemies.push(e);
    return e;
  }

  spawnBoss() {
    this.audio.sfx('boss');
    this.shakeT = 1.2;
    const hp = 420;
    this.boss = { type: 'boss', x: W / 2, y: -160, vx: 0, vy: 0, r: 95, hp, maxHp: hp, t: 0, attackT: 0, summonT: 3, hitT: 0, mouthOpen: 0, entered: false };
    this.enemies.push(this.boss);
  }

  spawnPickup(kind, x, y) {
    this.pickups.push({ kind, x, y, t: 0 });
  }

  // --- simulation -------------------------------------------------------
  update(rawDt) {
    if (this.frozen) return;
    const dt = Math.min(rawDt, 1 / 20);
    this.director.update(dt);
    const m = this.mods;
    const sdt = dt * m.timeScale;
    this.time += dt;
    if (m.spin) this.angle += m.spin * dt;
    else this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle)) * Math.exp(-3 * dt); // ease back upright
    this.audio.disco = m.disco;
    this.audio.tempo = 112 + this.director.chaos * 10 + (m.timeScale > 1 ? 30 : m.timeScale < 1 ? -40 : 0);

    this.updatePlayer(sdt, m);
    this.updateSpawning(sdt, m);
    this.updateEnemies(sdt, m);
    this.updateBullets(sdt, m);
    this.updatePickups(sdt);
    this.updateFx(sdt);

    this.shakeT = Math.max(0, this.shakeT - dt);
    this.flashT = Math.max(0, this.flashT - dt);
  }

  updatePlayer(dt, m) {
    const p = this.player;
    const k = this.input.keys;
    let ix = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let iy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (m.invertX) ix = -ix;
    if (m.invertY) iy = -iy;
    const len = Math.hypot(ix, iy) || 1;
    ix /= len;
    iy /= len;

    p.dashCd -= dt;
    p.dashT -= dt;
    if (k.has('Space') && p.dashCd <= 0 && (ix || iy)) {
      p.dashT = 0.16;
      p.dashCd = 0.9;
      p.iframes = Math.max(p.iframes, 0.25);
      this.audio.sfx('dash');
      for (let i = 0; i < 12; i++) this.particle(p.x, p.y, '#2ff7ff', 120);
    }
    const speed = p.speed * m.playerSpeed * (p.dashT > 0 ? 3.4 : 1);
    const response = m.ice ? 1.6 : 14;
    const blend = 1 - Math.exp(-response * dt);
    p.vx = lerp(p.vx, ix * speed, blend);
    p.vy = lerp(p.vy, iy * speed, blend);
    p.vy += m.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const r = PLAYER_R * m.playerScale;
    if (m.wrap) {
      if (p.x < -r) p.x = W + r;
      if (p.x > W + r) p.x = -r;
      if (p.y < -r) p.y = H + r;
      if (p.y > H + r) p.y = -r;
    } else {
      if (p.x < r || p.x > W - r) p.vx *= m.ice ? -0.8 : 0;
      if (p.y < r || p.y > H - r) p.vy *= m.ice ? -0.8 : 0;
      p.x = clamp(p.x, r, W - r);
      p.y = clamp(p.y, r, H - r);
    }

    const moving = Math.hypot(p.vx, p.vy) > 60;
    this.director.onIdle(dt, moving || this.input.mouseDown);

    // pacifist: spinning in circles = love blast
    if (moving) {
      const heading = Math.atan2(p.vy, p.vx);
      let d = heading - p.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.heading = heading;
      if (m.pacifist) p.spinAccum += Math.abs(d);
    }
    p.spinAccum *= Math.exp(-0.7 * dt);
    if (m.pacifist && p.spinAccum > Math.PI * 2) {
      p.spinAccum = 0;
      this.loveBlast();
    }

    // floor is lava
    if (m.lavaFloor) {
      p.still = moving ? 0 : p.still + dt;
      p.lavaCd -= dt;
      if (p.still > 0.5) {
        if (chance(0.5)) this.particle(p.x + rand(-r, r), p.y + r, pick(['#ff5a00', '#ffcc00']), 80);
        if (p.lavaCd <= 0) {
          p.lavaCd = 0.7;
          this.hurtPlayer('LAVA');
        }
      }
    }

    // aim + shoot
    const aimX = this.mouseWorld.x + m.aimOffsetX;
    const aimY = this.mouseWorld.y + m.aimOffsetY;
    p.aim = Math.atan2(aimY - p.y, aimX - p.x);
    p.fireCd -= dt;
    p.zapCd -= dt;
    p.iframes -= dt;
    if (this.input.mouseDown && p.fireCd <= 0) {
      p.fireCd = 1 / (6.5 * p.fireRate * m.fireRate);
      if (m.pacifist) {
        if (p.zapCd <= 0) {
          p.zapCd = 0.8;
          this.text(p.x, p.y - 30, 'NO VIOLENCE', '#ff2fa8');
          this.hurtPlayer('VIOLENCE');
        }
      } else {
        this.firePlayer(p, m);
      }
    }
  }

  get mouseWorld() {
    return this.camInverse.transformPoint(new DOMPoint(this.input.mouseX, this.input.mouseY));
  }

  firePlayer(p, m) {
    const base = p.aim + (m.backwardsGun ? Math.PI : 0);
    const n = p.multishot;
    const spread = 0.13;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread + rand(-0.03, 0.03);
      const sp = 760 * m.bulletSpeed;
      this.bullets.push({
        x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 5 * m.bulletScale, friendly: true, life: 1.4 / m.bulletSpeed, pierce: p.pierce, hit: new Set(),
      });
    }
    this.audio.sfx('shoot');
  }

  fireEnemy(e, a, speed = 250, r = 6, color = '#ff2fa8') {
    this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, friendly: false, life: 6, color });
  }

  loveBlast() {
    const p = this.player;
    this.audio.sfx('pickup');
    this.text(p.x, p.y - 40, '💖 LOVE BLAST 💖', '#ff7ad9', 28);
    for (let i = 0; i < 40; i++) this.particle(p.x, p.y, '#ff7ad9', 420);
    for (const e of [...this.enemies]) {
      if (dist2(e, p) < 240 ** 2) {
        if (e.type === 'boss') this.damageEnemy(e, 20);
        else this.killEnemy(e);
      }
    }
  }

  updateSpawning(dt, m) {
    if (this.boss && this.boss.hp > 0) return; // the boss summons its own minions
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const rate = (0.9 + this.time * 0.018 + this.director.chaos * 0.35) * m.spawnRate;
    this.spawnT = 1 / rate;
    const options = Object.entries(ENEMY_TYPES).filter(([, t]) => !t.spawnOnly && (t.minChaos ?? 1) <= this.director.chaos);
    const weights = { bug: 6, cursor: 3, popup: 2, captcha: 1 };
    const total = options.reduce((s, [k]) => s + weights[k], 0);
    let roll = rand(total);
    for (const [k] of options) {
      roll -= weights[k];
      if (roll <= 0) {
        this.spawnEnemy(k);
        break;
      }
    }
  }

  updateEnemies(dt, m) {
    const p = this.player;
    for (const e of this.enemies) {
      e.hitT -= dt;
      e.wob += dt * 8;
      if (e.type === 'boss') {
        this.updateBoss(e, dt);
        continue;
      }
      const t = ENEMY_TYPES[e.type];
      let ang = Math.atan2(p.y - e.y, p.x - e.x);
      let sp = e.speed * m.enemySpeed;
      if (e.type === 'cursor') sp *= 0.6 + Math.max(0, Math.sin(e.wob * 0.5)) * 1.4; // lunges
      if (e.type === 'popup') ang += Math.sin(e.wob * 0.3) * 1.2; // drifts like an ad
      if (m.disco) ang += Math.sin(e.wob) * 1.4;
      e.vx = lerp(e.vx, Math.cos(ang) * sp, 1 - Math.exp(-5 * dt));
      e.vy = lerp(e.vy, Math.sin(ang) * sp, 1 - Math.exp(-5 * dt));
      e.vy += m.gravity * 0.15 * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;

      const shootEvery = t.shoots ?? (m.enemiesShoot ? 2.4 : 0);
      if (shootEvery) {
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = shootEvery * rand(0.8, 1.3);
          this.fireEnemy(e, Math.atan2(p.y - e.y, p.x - e.x) + rand(-0.15, 0.15), 240, 6, t.color);
        }
      }

      const er = e.r * m.enemyScale;
      const pr = PLAYER_R * m.playerScale;
      if (dist2(e, p) < (er + pr) ** 2) {
        this.hurtPlayer(e.type);
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        e.vx = Math.cos(a) * 400;
        e.vy = Math.sin(a) * 400;
      }
    }
  }

  updateBoss(b, dt) {
    const p = this.player;
    b.t += dt;
    const enraged = b.hp < b.maxHp / 2;
    const tx = W / 2 + Math.sin(b.t * 0.55) * 400;
    const ty = 170 + Math.sin(b.t * 1.1) * 70;
    b.x = lerp(b.x, tx, 1 - Math.exp(-2 * dt));
    b.y = lerp(b.y, ty, 1 - Math.exp(-(b.entered ? 2 : 0.8) * dt));
    if (b.y > 60) b.entered = true;
    if (!b.entered) return;

    b.mouthOpen = Math.max(0, b.mouthOpen - dt * 3);
    const phase = Math.floor(b.t / 6) % 3;
    b.attackT -= dt;
    if (b.attackT <= 0) {
      b.mouthOpen = 1;
      if (phase === 0) {
        b.attackT = enraged ? 0.06 : 0.09;
        const a = b.t * 3.2;
        this.fireEnemy(b, a, 220, 7, '#ff2fa8');
        this.fireEnemy(b, a + Math.PI, 220, 7, '#2ff7ff');
        if (enraged) this.fireEnemy(b, a + Math.PI / 2, 220, 7, '#ffe600');
      } else if (phase === 1) {
        b.attackT = enraged ? 0.6 : 0.85;
        const base = Math.atan2(p.y - b.y, p.x - b.x);
        for (let i = -3; i <= 3; i++) this.fireEnemy(b, base + i * 0.13, 330, 8, '#ffe600');
      } else {
        b.attackT = enraged ? 1.1 : 1.6;
        const n = enraged ? 28 : 20;
        const off = rand(Math.PI);
        for (let i = 0; i < n; i++) this.fireEnemy(b, off + (i / n) * Math.PI * 2, 200, 9, '#b6ff3b');
      }
    }
    b.summonT -= dt;
    if (b.summonT <= 0) {
      b.summonT = enraged ? 2.2 : 3.5;
      for (let i = 0; i < 3; i++) this.spawnEnemy(pick(['bug', 'cursor', 'popup']), b.x + rand(-60, 60), b.y + 60);
    }
    if (dist2(b, p) < (b.r + PLAYER_R * this.mods.playerScale) ** 2) this.hurtPlayer('GERALD');
  }

  updateBullets(dt, m) {
    const p = this.player;
    const pr = PLAYER_R * m.playerScale;
    for (const b of this.bullets) {
      b.vy += m.gravity * 0.35 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (m.wrap) {
        if (b.x < 0) b.x += W;
        else if (b.x > W) b.x -= W;
        if (b.y < 0) b.y += H;
        else if (b.y > H) b.y -= H;
      } else if (b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) b.life = 0;
      if (b.life <= 0) continue;

      if (b.friendly) {
        for (const e of this.enemies) {
          if (b.hit.has(e)) continue;
          const er = e.type === 'boss' ? e.r : e.r * m.enemyScale;
          if (dist2(b, e) < (er + b.r) ** 2) {
            b.hit.add(e);
            this.damageEnemy(e, 1);
            if (b.pierce-- <= 0) {
              b.life = 0;
              break;
            }
          }
        }
      } else if (dist2(b, p) < (pr + b.r * 0.8) ** 2) {
        b.life = 0;
        this.hurtPlayer('bullet');
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  updatePickups(dt) {
    const p = this.player;
    for (const k of this.pickups) {
      k.t += dt;
      if (dist2(k, p) < (PLAYER_R * this.mods.playerScale + 16) ** 2) {
        k.taken = true;
        if (k.kind === 'heart') {
          p.hp = Math.min(p.maxHp, p.hp + 1);
          this.audio.sfx('pickup');
          this.text(k.x, k.y - 20, '+1 HP', '#ff7ad9');
          if (chance(0.25)) this.say(pick(LINES.pickupHeart), { quiet: true });
        } else {
          this.audio.sfx('explode');
          for (let i = 0; i < 30; i++) this.particle(k.x, k.y, pick(['#ff5a00', '#ffe600']), 360);
          this.hurtPlayer('bomb');
          for (const e of [...this.enemies]) if (e.type !== 'boss' && dist2(e, k) < 200 ** 2) this.killEnemy(e);
          this.say(pick(LINES.pickupBomb), { quiet: true });
        }
      }
      if (k.t > 14) k.taken = true;
    }
    this.pickups = this.pickups.filter((k) => !k.taken);
  }

  updateFx(dt) {
    for (const q of this.particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.94;
      q.vy *= 0.94;
      q.life -= dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const t of this.texts) {
      t.y -= 40 * dt;
      t.life -= dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  damageEnemy(e, dmg) {
    e.hp -= dmg;
    e.hitT = 0.08;
    this.audio.sfx('hit');
    if (e.type === 'boss') {
      this.shakeT = Math.max(this.shakeT, 0.08);
      if (this.time - this.lastBossLine > 7) {
        this.lastBossLine = this.time;
        this.say(pick(e.hp < e.maxHp * 0.25 ? LINES.bossLow : LINES.bossHurt), { quiet: true });
      }
      if (e.hp <= 0) this.winGame();
      return;
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e, split = true) {
    const idx = this.enemies.indexOf(e);
    if (idx === -1) return;
    this.enemies.splice(idx, 1);
    const t = ENEMY_TYPES[e.type];
    const gained = Math.round(t.score * (1 + (this.director.chaos - 1) * 0.5));
    this.score += gained;
    this.kills++;
    this.director.onKill();
    const ducks = this.mods.ducks;
    this.audio.sfx(ducks ? 'quack' : 'explode');
    for (let i = 0; i < 14; i++) this.particle(e.x, e.y, ducks ? pick(['#ffe600', '#ff9a00', '#fff']) : t.color, 260);
    if (ducks && chance(0.5)) this.text(e.x, e.y - 10, 'QUACK', '#ffe600');
    else this.text(e.x, e.y - 10, `+${gained}`, '#ffffffaa', 14);
    if (split && this.mods.splitters && e.gen < 2) {
      for (let i = 0; i < 2; i++) {
        const c = this.spawnEnemy(e.type, e.x + rand(-10, 10), e.y + rand(-10, 10), e.gen + 1);
        if (c) {
          c.vx = rand(-300, 300);
          c.vy = rand(-300, 300);
        }
      }
    }
    if (chance(0.045)) this.spawnPickup('heart', e.x, e.y);
  }

  hurtPlayer(source) {
    const p = this.player;
    if (p.iframes > 0 || this.over) return;
    p.hp -= 1;
    p.iframes = 0.9;
    this.shakeT = 0.3;
    this.flash('#ff0033');
    this.audio.sfx('hurt');
    for (let i = 0; i < 16; i++) this.particle(p.x, p.y, '#ff3b3b', 240);
    if (p.hp <= 0) {
      this.endGame(false, source);
      return;
    }
    this.director.onHurt();
  }

  winGame() {
    const b = this.boss;
    this.audio.sfx('glitch');
    for (let i = 0; i < 120; i++) this.particle(b.x, b.y, pick(['#ff2fa8', '#2ff7ff', '#ffe600', '#b6ff3b']), 700);
    this.enemies = [];
    this.bullets = [];
    this.score += 5000;
    this.endGame(true, 'GERALD');
  }

  endGame(won, source) {
    this.over = true;
    this.won = won;
    this.director.clear();
    this.onEnd({ won, source, score: this.score, kills: this.kills, time: this.time, chaos: this.director.chaos });
  }

  particle(x, y, color, speed) {
    const a = rand(Math.PI * 2);
    const s = rand(speed * 0.2, speed);
    this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.8), max: 0.8, color, size: rand(2, 5) });
  }

  text(x, y, str, color = '#fff', size = 18) {
    this.texts.push({ x, y, str, color, size, life: 1 });
  }

  // --- rendering --------------------------------------------------------
  font(size, bold = true) {
    const fam = this.mods.comicSans ? '"Comic Sans MS", "Comic Neue", cursive' : '"Courier New", monospace';
    return `${bold ? 'bold ' : ''}${size}px ${fam}`;
  }

  render(now) {
    const ctx = this.ctx;
    const m = this.mods;
    const p = this.player;

    // camera
    const targetX = m.zoom > 1 ? p.x : W / 2;
    const targetY = m.zoom > 1 ? p.y : H / 2;
    this.cam.x = lerp(this.cam.x, targetX, 0.1);
    this.cam.y = lerp(this.cam.y, targetY, 0.1);
    const shake = this.shakeT * 30 + m.shake;
    const cm = new DOMMatrix()
      .translateSelf(W / 2 + rand(-shake, shake), H / 2 + rand(-shake, shake))
      .rotateSelf(((m.rotation + this.angle) * 180) / Math.PI)
      .scaleSelf(m.mirror ? -m.zoom : m.zoom, m.zoom)
      .translateSelf(-this.cam.x, -this.cam.y);
    this.camMatrix = cm;
    this.camInverse = cm.inverse();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05010c';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(cm);

    this.drawFloor(ctx, now, m);
    for (const k of this.pickups) this.drawPickup(ctx, k, now);
    for (const e of this.enemies) this.drawEnemy(ctx, e, m, now);
    for (const b of this.bullets) this.drawBullet(ctx, b);
    if (!this.over || this.won) this.drawPlayer(ctx, p, m, now);
    for (const q of this.particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.fillStyle = t.color;
      ctx.font = this.font(t.size);
      ctx.textAlign = 'center';
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    this.drawCrosshair(ctx, m);

    if (m.darkness) {
      const g = ctx.createRadialGradient(p.x, p.y, 50, p.x, p.y, 280);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.97)');
      ctx.fillStyle = g;
      ctx.fillRect(-W, -H, W * 3, H * 3);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bigText) this.drawBigText(ctx, now);
    this.drawHud(ctx, m, now);
    if (this.flashT > 0) {
      ctx.globalAlpha = this.flashT * 0.8;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = this.font(64);
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2);
      ctx.font = this.font(20, false);
      ctx.fillText('(GERALD is still watching)', W / 2, H / 2 + 40);
    }
  }

  drawFloor(ctx, now, m) {
    const t = now / 1000;
    ctx.save();
    ctx.lineWidth = 1;
    if (m.disco) {
      const s = 80;
      for (let x = 0; x < W; x += s) {
        for (let y = 0; y < H; y += s) {
          const hue = (x * 0.3 + y * 0.5 + t * 240) % 360;
          ctx.fillStyle = `hsla(${hue}, 90%, ${((x + y) / s) % 2 ? 22 : 12}%, 1)`;
          ctx.fillRect(x, y, s, s);
        }
      }
    } else if (m.lavaFloor) {
      ctx.fillStyle = `rgb(${60 + Math.sin(t * 3) * 20}, 8, 0)`;
      ctx.fillRect(0, 0, W, H);
    }
    const hue = (t * 20) % 360;
    ctx.strokeStyle = m.lavaFloor ? 'rgba(255,90,0,0.35)' : `hsla(${hue + 280}, 100%, 60%, 0.13)`;
    const off = (t * 30) % 40;
    ctx.beginPath();
    for (let x = -40 + off; x <= W; x += 40) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = -40 + off; y <= H; y += 40) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.strokeStyle = m.wrap ? 'rgba(47,247,255,0.25)' : '#ff2fa8';
    ctx.lineWidth = m.wrap ? 2 : 4;
    ctx.setLineDash(m.wrap ? [10, 10] : []);
    ctx.shadowColor = '#ff2fa8';
    ctx.shadowBlur = 20;
    ctx.strokeRect(0, 0, W, H);
    ctx.restore();
  }

  drawPlayer(ctx, p, m, now) {
    if (p.iframes > 0 && Math.floor(now / 60) % 2) return;
    const s = m.playerScale;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(s, s);
    ctx.shadowColor = '#2ff7ff';
    ctx.shadowBlur = 18;
    // gun
    ctx.save();
    ctx.rotate(p.aim + (m.backwardsGun ? Math.PI : 0));
    ctx.fillStyle = '#cfffff';
    ctx.fillRect(6, -4, 18, 8);
    ctx.restore();
    // body
    ctx.fillStyle = '#2ff7ff';
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    // face looks at the cursor
    ctx.shadowBlur = 0;
    const lx = Math.cos(p.aim) * 4;
    const ly = Math.sin(p.aim) * 4;
    ctx.fillStyle = '#001';
    ctx.beginPath();
    ctx.arc(-5 + lx, -3 + ly, 2.6, 0, Math.PI * 2);
    ctx.arc(5 + lx, -3 + ly, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (p.dashT > 0) {
      ctx.strokeStyle = '#2ff7ff88';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_R * s + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawEnemy(ctx, e, m, now) {
    if (e.type === 'boss') return this.drawBoss(ctx, e, now);
    const t = ENEMY_TYPES[e.type];
    const r = e.r * m.enemyScale;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (m.disco) ctx.rotate(Math.sin(e.wob) * 0.4);
    const flash = e.hitT > 0;
    if (m.ducks) {
      this.drawDuck(ctx, r, e, flash);
      ctx.restore();
      return;
    }
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = flash ? '#fff' : t.color;
    switch (e.type) {
      case 'bug': {
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          const w = Math.sin(e.wob + i) * 4;
          ctx.beginPath();
          ctx.moveTo(-r, i * 6);
          ctx.lineTo(-r - 7, i * 6 + w);
          ctx.moveTo(r, i * 6);
          ctx.lineTo(r + 7, i * 6 - w);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = this.font(r);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('>:', 0, 1);
        break;
      }
      case 'cursor': {
        const a = Math.atan2(e.vy, e.vx) + Math.PI * 0.75;
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, r * 2);
        ctx.lineTo(r * 0.5, r * 1.5);
        ctx.lineTo(r * 0.9, r * 2.3);
        ctx.lineTo(r * 1.2, r * 2.1);
        ctx.lineTo(r * 0.8, r * 1.35);
        ctx.lineTo(r * 1.45, r * 1.35);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }
      case 'popup': {
        const w = r * 2.4;
        const h = r * 1.7;
        ctx.fillStyle = flash ? '#fff' : '#ddd';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = '#ff2fa8';
        ctx.fillRect(-w / 2, -h / 2, w, 9);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.font = this.font(9);
        ctx.textAlign = 'center';
        ctx.fillText(e.label, 0, 4);
        ctx.fillStyle = '#ff0000';
        ctx.fillText('CLICK', 0, 15);
        break;
      }
      case 'captcha': {
        const w = r * 2.6;
        const h = r * 1.3;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#888';
        ctx.strokeRect(-w / 2 + 8, -8, 16, 16);
        ctx.fillStyle = '#222';
        ctx.font = this.font(10, false);
        ctx.textAlign = 'left';
        ctx.fillText('I am not a robot', -w / 2 + 30, 4);
        ctx.fillStyle = '#ff2fa8';
        ctx.fillRect(-w / 2, h / 2 + 4, (w * e.hp) / ENEMY_TYPES.captcha.hp, 4);
        break;
      }
      case 'clone': {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.fillRect(-8, -5, 5, 2);
        ctx.fillRect(3, -5, 5, 2);
        ctx.font = this.font(10);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('EVIL YOU', 0, -r - 6);
        break;
      }
    }
    ctx.restore();
  }

  drawDuck(ctx, r, e, flash) {
    const dir = e.vx < 0 ? -1 : 1;
    ctx.scale(dir, 1);
    ctx.fillStyle = flash ? '#fff' : '#ffe600';
    ctx.beginPath();
    ctx.ellipse(0, 3, r * 1.1, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.6, -r * 0.5, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8a00';
    ctx.beginPath();
    ctx.moveTo(r * 1.05, -r * 0.55);
    ctx.lineTo(r * 1.6, -r * 0.4);
    ctx.lineTo(r * 1.05, -r * 0.25);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(r * 0.75, -r * 0.65, Math.max(1.5, r * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }

  drawBoss(ctx, b, now) {
    const t = now / 1000;
    const r = b.r;
    const p = this.player;
    ctx.save();
    ctx.translate(b.x + (chance(0.08) ? rand(-10, 10) : 0), b.y);
    ctx.rotate(Math.sin(t * 1.3) * 0.08);
    ctx.shadowColor = '#ff2fa8';
    ctx.shadowBlur = 40;
    const g = ctx.createRadialGradient(0, -r * 0.3, 10, 0, 0, r * 1.3);
    g.addColorStop(0, b.hitT > 0 ? '#fff' : '#ff6ccf');
    g.addColorStop(1, '#5a0045');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.3);
    ctx.fill();
    ctx.shadowBlur = 0;
    // eyes that follow you, one bigger than the other
    const look = Math.atan2(p.y - b.y, p.x - b.x);
    for (const [ex, er] of [[-r * 0.4, r * 0.2], [r * 0.4, r * 0.27]]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex, -r * 0.3, er, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(ex + Math.cos(look) * er * 0.45, -r * 0.3 + Math.sin(look) * er * 0.45, er * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    // mouth
    ctx.fillStyle = '#000';
    const mh = 10 + b.mouthOpen * r * 0.35;
    ctx.beginPath();
    ctx.roundRect(-r * 0.5, r * 0.25, r, mh, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) ctx.fillRect(-r * 0.45 + i * r * 0.2, r * 0.25, r * 0.12, 8);
    ctx.font = this.font(18);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('GERALD.EXE', 0, -r - 14);
    ctx.restore();
  }

  drawBullet(ctx, b) {
    ctx.save();
    ctx.fillStyle = b.friendly ? '#cfffff' : b.color;
    ctx.shadowColor = b.friendly ? '#2ff7ff' : b.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPickup(ctx, k, now) {
    const bob = Math.sin(now / 200 + k.x) * 4;
    ctx.save();
    ctx.translate(k.x, k.y + bob);
    if (k.t > 11 && Math.floor(now / 100) % 2) ctx.globalAlpha = 0.3;
    ctx.font = '26px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💖', 0, 0); // bombs look identical. GERALD lies.
    ctx.restore();
  }

  drawCrosshair(ctx, m) {
    const mw = this.mouseWorld;
    const x = mw.x + m.aimOffsetX;
    const y = mw.y + m.aimOffsetY;
    ctx.save();
    ctx.strokeStyle = '#b6ff3b';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#b6ff3b';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.moveTo(x - 16, y);
    ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + 16, y);
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5);
    ctx.lineTo(x, y + 16);
    ctx.stroke();
    if (m.aimOffsetX || m.aimOffsetY) {
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = '#b6ff3b55';
      ctx.beginPath();
      ctx.moveTo(mw.x, mw.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBigText(ctx, now) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.sin(now / 900) * 0.15);
    ctx.font = this.font(78);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 47, 168, 0.75)';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.strokeText(this.bigText, 0, 0);
    ctx.fillText(this.bigText, 0, 0);
    ctx.restore();
  }

  drawHud(ctx, m, now) {
    const p = this.player;
    ctx.save();
    ctx.textBaseline = 'top';
    // HP
    ctx.font = '26px serif';
    ctx.textAlign = 'left';
    if (m.hideHp) {
      ctx.font = this.font(24);
      ctx.fillStyle = '#ff7ad9';
      const moods = ['???', 'vibes', '¯\\_(ツ)_/¯', 'probably fine', 'NaN', 'ask later'];
      ctx.fillText(`HP: ${moods[Math.floor(now / 700) % moods.length]}`, 20, 18);
    } else {
      for (let i = 0; i < p.maxHp; i++) ctx.fillText(i < p.hp ? '💖' : '🖤', 20 + i * 30, 16);
    }
    // score / time
    ctx.font = this.font(26);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${this.score.toLocaleString()}`, W - 20, 16);
    ctx.font = this.font(14, false);
    ctx.fillStyle = '#aaa';
    const secs = Math.floor(this.time);
    ctx.fillText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}  ·  ${this.kills} kills`, W - 20, 48);

    // chaos meter
    const d = this.director;
    const frac = d.chaos >= 5 ? 1 : (d.time % 45) / 45;
    ctx.textAlign = 'center';
    ctx.font = this.font(13);
    ctx.fillStyle = '#ff2fa8';
    ctx.fillText(`GERALD CHAOS LV ${d.chaos}${d.chaos >= 5 ? ' (MAX)' : ''}`, W / 2, 12);
    ctx.fillStyle = '#ffffff22';
    ctx.fillRect(W / 2 - 150, 30, 300, 8);
    ctx.fillStyle = `hsl(${320 + Math.sin(now / 200) * 20}, 100%, 60%)`;
    ctx.fillRect(W / 2 - 150, 30, 300 * frac, 8);

    // active rules
    ctx.textAlign = 'right';
    ctx.font = this.font(13);
    d.active.forEach((inst, i) => {
      ctx.fillStyle = '#ffe600';
      ctx.fillText(`⚠ ${inst.def.name}`, W - 20, 74 + i * 18);
    });

    // dash cooldown
    if (p.dashCd > 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#2ff7ff88';
      ctx.font = this.font(12);
      ctx.fillText('DASH RECHARGING', 20, 52);
    }

    // boss bar
    if (this.boss && this.boss.hp > 0) {
      const b = this.boss;
      ctx.fillStyle = '#000a';
      ctx.fillRect(W / 2 - 300, H - 44, 600, 22);
      ctx.fillStyle = '#ff2fa8';
      ctx.fillRect(W / 2 - 298, H - 42, 596 * (b.hp / b.maxHp), 18);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = this.font(14);
      ctx.fillText('GERALD.EXE — DELETE HIM', W / 2, H - 40);
    }
    ctx.restore();
  }
}
