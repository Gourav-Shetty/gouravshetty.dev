/* Undertale-style intro dialogue: typewriter textbox with voice blips,
 * portrait, and page advance. The avatar introduces the owner on first
 * load and teaches the controls. */
export const INTRO = [
  '* Howdy! I am GOURAV. Welcome to my projects.',
  '* These walls hold my projects. Walk with WASD or the arrow keys.',
  '* See a circle on the floor? Stand on it and I will show you what is hanging there.',
  '* Then hit SEE DETAILS to open the project. MENU, top right, lists everything.',
  '* Press H any time to replay this chat.',
  '* Found the Guestwall on the left wall by the deep end? Stand on its circle and press G to pin your own note.',
  '* Enjoy the walk!',
];

export class Dialogue {
  constructor() {
    this.active = false;
    this.pages = [];
    this.onDone = null;
    this.timer = 0;
    // reduced motion: the typewriter still reads, but it does not tick slowly
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.buildBox();
    this.buildPortrait();
    this._key = (e) => {
      if (!this.active) return;
      if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.advance();
      }
    };
    addEventListener('keydown', this._key);
  }

  buildBox() {
    this.el = document.createElement('div');
    this.el.className = 'dbox';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Introduction');
    this.el.innerHTML = `<canvas width="96" height="96" aria-hidden="true"></canvas><div class="dtext"></div><div class="dnext">▼</div>`;
    this.el.addEventListener('click', () => this.active && this.advance());
    document.body.appendChild(this.el);
    this.textEl = this.el.querySelector('.dtext');
    this.nextEl = this.el.querySelector('.dnext');
  }

  buildPortrait() {
    // mini scribble afro in light strokes so it reads on the black box
    const c = this.el.querySelector('canvas');
    const g = c.getContext('2d');
    g.clearRect(0, 0, 96, 96);
    g.strokeStyle = '#e8e8e8';
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 26;
      const x = 48 + Math.cos(a) * r, y = 40 + Math.sin(a) * r;
      g.lineWidth = 0.8 + Math.random();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 14, y + (Math.random() - 0.5) * 14);
      g.stroke();
    }
    g.fillStyle = '#000';
    g.beginPath(); g.arc(48, 40, 15, 0, 7); g.fill();
    g.fillStyle = '#e8e8e8';
    g.beginPath(); g.arc(48, 78, 9, 0, 7); g.fill();
  }

  ensureAudio() {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* no audio */ }
  }

  blip() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = 500 + Math.random() * 120;
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.06);
  }

  play(pages, onDone) {
    if (this.active) return;
    this.ensureAudio();
    this.active = true;
    this.pages = [...pages];
    this.onDone = onDone || null;
    this.el.classList.add('show');
    this.nextPage();
  }

  nextPage() {
    this.full = this.pages.shift();
    this.shown = 0;
    this.textEl.textContent = '';
    this.nextEl.style.opacity = '0';
    clearInterval(this.timer);
    if (this.reduced) {
      // show the whole line at once, no typewriter, no blips
      this.shown = this.full.length;
      this.textEl.textContent = this.full;
      this.nextEl.style.opacity = '1';
      return;
    }
    this.timer = setInterval(() => {
      this.shown++;
      this.textEl.textContent = this.full.slice(0, this.shown);
      if (this.shown % 2 === 0) this.blip();
      if (this.shown >= this.full.length) {
        clearInterval(this.timer);
        this.nextEl.style.opacity = '1';
      }
    }, 22);
  }

  advance() {
    this.ensureAudio();
    if (this.shown < this.full.length) {
      // first press completes the page instantly (their Z-skip)
      clearInterval(this.timer);
      this.shown = this.full.length;
      this.textEl.textContent = this.full;
      this.nextEl.style.opacity = '1';
      return;
    }
    if (this.pages.length) this.nextPage();
    else this.finish();
  }

  finish() {
    if (!this.active) return;
    clearInterval(this.timer);
    this.active = false;
    this.el.classList.remove('show');
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb();
  }
}
