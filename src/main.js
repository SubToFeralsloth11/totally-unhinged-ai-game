import { Audio } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { LINES } from './lines.js';
import { W, H, pick, fmt } from './util.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const canvas = $('game');
const audio = new Audio();
const ui = new UI(audio);
const PROFILE_KEY = 'unhinged.profile';

let game = null;
let last = performance.now();
let pauseRefused = false;
let blurAt = 0;
let titleTimer = null;
const ORIGINAL_TITLE = document.title;

const profile = loadProfile();

function loadProfile() {
  try {
    return { name: '', deaths: 0, runs: 0, best: 0, wins: 0, ...JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') };
  } catch {
    return { name: '', deaths: 0, runs: 0, best: 0, wins: 0 };
  }
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

// GERALD can't help himself.
function mangle(name) {
  const strategies = [
    (n) => n.split('').reverse().join(''),
    (n) => `${n}ington III`,
    (n) => n.replace(/[aeiou]/gi, 'oo'),
    () => 'Kevin',
    (n) => `Lil ${n.toUpperCase()}`,
    (n) => `${n.slice(0, Math.ceil(n.length / 2))}-${n.slice(0, Math.ceil(n.length / 2))}`,
  ];
  return pick(strategies)(name);
}

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit);
fit();

// ---------- title ----------
const nameInput = $('name-input');
nameInput.value = profile.name;
if (profile.runs) {
  $('title-stats').textContent = `runs: ${profile.runs} · deaths: ${profile.deaths} · best: ${profile.best.toLocaleString()} · GERALD defeated: ${profile.wins}`;
  $('name-label').textContent = `GERALD: Oh. It's you again. Death count: ${profile.deaths}.`;
}
nameInput.focus();

$('name-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim().slice(0, 16) || 'Nobody';
  const returning = profile.runs > 0 && name === profile.name;
  profile.name = name;
  saveProfile();
  audio.init();
  startRun(returning ? 'returning' : 'new');
});

$('again-btn').addEventListener('click', () => startRun('again'));

function startRun(kind) {
  $('title').classList.add('hidden');
  $('over').classList.add('hidden');
  document.body.classList.add('no-cursor');
  profile.runs++;
  saveProfile();
  game = new Game({ canvas, ui, audio, profile, onEnd });
  audio.startMusic();
  pauseRefused = false;
  const vars = { name: profile.name, deaths: profile.deaths, mangled: mangle(profile.name) };
  if (kind === 'new') {
    ui.say(LINES.boot[0]);
    setTimeout(() => game && !game.over && ui.say(LINES.boot[2]), 5200);
    setTimeout(() => game && !game.over && ui.say(fmt(pick(LINES.nameReply), vars)), 10500);
  } else if (kind === 'returning') {
    ui.say(fmt(pick(LINES.returning), vars));
  } else {
    ui.say(pick(LINES.start));
  }
}

function onEnd({ won, source, score, kills, time, chaos }) {
  if (won) profile.wins++;
  else profile.deaths++;
  const newBest = score > profile.best;
  profile.best = Math.max(profile.best, score);
  saveProfile();
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
  const line = fmt(pick(won ? LINES.victory : LINES.death), { name: profile.name, deaths: profile.deaths, time: timeStr });

  setTimeout(() => {
    document.body.classList.remove('no-cursor', 'comic');
    $('over-title').textContent = won ? 'GERALD.EXE DELETED' : 'GAME OVER';
    $('over-title').dataset.text = $('over-title').textContent;
    $('over-line').textContent = `GERALD: "${line}"`;
    const rows = [
      ['score', `${score.toLocaleString()}${newBest ? '  ★ NEW BEST' : ''}`],
      ['survived', timeStr],
      ['kills', kills],
      ['chaos reached', `${chaos} / 5`],
      ['killed by', won ? 'nothing. you are a legend.' : source],
      ['GERALD\'s rating', pick(['2/10 ducks', '7/10, would torment again', '-3 stars', 'mid', 'my favourite failure', '∞/10 (I divided by zero)'])],
    ];
    $('over-stats').replaceChildren(
      ...rows.flatMap(([k, v]) => {
        const a = document.createElement('span');
        a.textContent = k;
        const b = document.createElement('span');
        b.textContent = v;
        return [a, b];
      }),
    );
    $('over').classList.remove('hidden');
    audio.stopMusic();
    audio.speak(line, { glitch: won });
  }, won ? 2500 : 900);
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (!game || game.over || document.activeElement === nameInput) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    ui.say(muted ? 'Muted. I will just type angrily then.' : 'Sound on. You missed me.', { quiet: true });
    return;
  }
  if (e.code === 'KeyV') {
    const on = audio.toggleVoice();
    ui.say(on ? 'Voice ON. Hello, flesh.' : 'Voice off. Beep boop instead.', { quiet: true });
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game.paused) {
      game.paused = false;
      return;
    }
    if (!pauseRefused && Math.random() < 0.6) {
      pauseRefused = true;
      ui.say(pick(LINES.pauseRefuse));
      return;
    }
    game.paused = true;
    ui.say(pick(LINES.pauseAccept), { quiet: true });
    return;
  }
  game.input.keys.add(e.code);
});
addEventListener('keyup', (e) => game?.input.keys.delete(e.code));

function setMouse(e) {
  if (!game) return;
  const r = canvas.getBoundingClientRect();
  game.input.mouseX = ((e.clientX - r.left) / r.width) * W;
  game.input.mouseY = ((e.clientY - r.top) / r.height) * H;
}
addEventListener('mousemove', setMouse);
canvas.addEventListener('mousedown', (e) => {
  setMouse(e);
  if (game && e.button === 0) game.input.mouseDown = true;
});
addEventListener('mouseup', (e) => {
  if (game && e.button === 0) game.input.mouseDown = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- tab stalking ----------
addEventListener('blur', () => {
  if (!game) return;
  game.input.keys.clear();
  game.input.mouseDown = false;
  if (game.over) return;
  blurAt = performance.now();
  let i = 0;
  clearInterval(titleTimer);
  titleTimer = setInterval(() => {
    document.title = LINES.blurTitle[i++ % LINES.blurTitle.length];
  }, 900);
});
addEventListener('focus', () => {
  clearInterval(titleTimer);
  document.title = ORIGINAL_TITLE;
  if (!game || game.over || !blurAt) return;
  const away = Math.round(performance.now() - blurAt);
  blurAt = 0;
  if (away > 1500) ui.say(fmt(pick(LINES.returnFromBlur), { away: away.toLocaleString() }));
});

// ---------- loop ----------
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (game) {
    game.update(dt);
    game.render(now);
    document.body.classList.toggle('comic', !game.over && game.mods.comicSans);
  } else {
    drawAttract(now);
  }
  requestAnimationFrame(frame);
}

// title-screen background: GERALD's eye, watching
function drawAttract(now) {
  const ctx = canvas.getContext('2d');
  const t = now / 1000;
  ctx.fillStyle = '#05010c';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = `hsla(${(t * 40) % 360}, 100%, 60%, 0.15)`;
  ctx.beginPath();
  for (let x = (t * 30) % 40; x < W; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = (t * 30) % 40; y < H; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
}

requestAnimationFrame(frame);

// debug hook for automated smoke tests
window.__unhinged = { get game() { return game; } };
