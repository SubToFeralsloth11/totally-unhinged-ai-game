// DOM overlays: GERALD's speech box, rule banner, deal popups, fake crash screen.
import { rand } from './util.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(audio) {
    this.audio = audio;
    this.box = $('gerald');
    this.text = $('gerald-text');
    this.banner = $('banner');
    this.typeTimer = null;
    this.hideTimer = null;
    this.modalOpen = false;
    this.crashing = false;
  }

  say(text, { glitch = false, quiet = false } = {}) {
    if (!text) return;
    clearInterval(this.typeTimer);
    clearTimeout(this.hideTimer);
    this.box.classList.remove('hidden', 'glitch');
    void this.box.offsetWidth; // restart pop-in animation
    if (glitch) this.box.classList.add('glitch');
    this.box.classList.add('talking');
    this.text.textContent = '';
    let i = 0;
    this.typeTimer = setInterval(() => {
      i += 1;
      this.text.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(this.typeTimer);
        this.box.classList.remove('talking');
      }
    }, 22);
    if (!quiet) this.audio.speak(text, { glitch });
    else this.audio.babble(text);
    this.hideTimer = setTimeout(() => this.box.classList.add('hidden'), 2500 + text.length * 55);
  }

  announce(name) {
    this.banner.classList.add('hidden');
    void this.banner.offsetWidth;
    this.banner.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = `⚠ RULE CHANGE: ${name}`;
    this.banner.append(span);
    this.banner.classList.remove('hidden');
    this.audio.sfx('announce');
  }

  // Resolves with the clicked button index. Evasive buttons dodge the cursor a few times.
  modal(deal) {
    this.modalOpen = true;
    $('modal-title').textContent = deal.title;
    $('modal-text').textContent = deal.text;
    const wrap = $('modal-buttons');
    wrap.innerHTML = '';
    $('modal').classList.remove('hidden');
    this.audio.sfx('glitch');
    this.audio.speak(deal.text);

    return new Promise((resolve) => {
      const finish = (i) => {
        this.modalOpen = false;
        $('modal').classList.add('hidden');
        resolve(i);
      };
      deal.buttons.forEach((b, i) => {
        const btn = document.createElement('button');
        btn.textContent = b.label;
        btn.addEventListener('click', () => finish(i));
        if (b.evasive) {
          btn.classList.add('evasive');
          let dodges = 0;
          const place = () => {
            btn.style.left = `${rand(10, wrap.clientWidth - btn.offsetWidth - 10)}px`;
            btn.style.top = `${rand(4, wrap.clientHeight - btn.offsetHeight - 4)}px`;
          };
          requestAnimationFrame(place);
          btn.addEventListener('mouseenter', () => {
            if (dodges >= 6) {
              btn.textContent = `${b.label} (fine.)`;
              return;
            }
            dodges++;
            place();
            this.audio.sfx('hit');
          });
        }
        wrap.append(btn);
      });
    });
  }

  fakeCrash(seconds) {
    this.crashing = true;
    const el = $('bsod');
    const pct = $('bsod-pct');
    el.classList.remove('hidden');
    this.audio.sfx('glitch');
    speechSynthesis?.cancel();
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      // progress that goes backwards right before the end, because GERALD
      const p = t < seconds * 0.7 ? (t / (seconds * 0.7)) * 99 : 99 - (t - seconds * 0.7) * 120;
      pct.textContent = Math.max(-404, Math.floor(p));
      if (t < seconds) requestAnimationFrame(tick);
      else {
        el.classList.add('hidden');
        this.crashing = false;
      }
    };
    tick();
  }
}
