import gsap from 'gsap';

/* Scribble-ink page transition, same role as their Pb overlay:
 * black ink closes over the screen (~0.7 s), content swaps, ink opens.
 * 2D canvas blob field instead of their 500-tube GL scene — same feel,
 * no extra GL context. Blocks input while running. */
export class Transition {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'transition';
    Object.assign(this.canvas.style, {
      position: 'fixed', inset: '0', width: '100vw', height: '100vh',
      zIndex: 60, pointerEvents: 'none', opacity: '0',
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.busy = false;
    this.progress = 0;
    // reduced motion: no ink wipe, the page just swaps
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = innerWidth;
    this.canvas.height = innerHeight;
    // ink blobs on a jittered grid — guarantees full coverage at p=1
    this.blobs = [];
    const step = Math.max(90, innerWidth / 16);
    for (let y = step / 2; y < innerHeight + step; y += step) {
      for (let x = step / 2; x < innerWidth + step; x += step) {
        this.blobs.push({
          x: x + (Math.random() - 0.5) * step,
          y: y + (Math.random() - 0.5) * step,
          r: step * 1.15,
          d: Math.hypot(x - innerWidth / 2, y - innerHeight / 2),
        });
      }
    }
    const maxD = Math.max(...this.blobs.map((b) => b.d));
    this.blobs.forEach((b) => { b.t = b.d / maxD; }); // edge-first closing
    this.paint(this.progress);
  }

  paint(p) {
    const { ctx } = this;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (p <= 0) return;
    ctx.fillStyle = '#000';
    for (const b of this.blobs) {
      // staggered: each blob grows in a slice of the timeline
      const local = Math.min(1, Math.max(0, (p * 1.35 - b.t * 0.35) / 0.65));
      if (local <= 0) continue;
      const e = local < 0.5 ? 2 * local * local : 1 - Math.pow(-2 * local + 2, 2) / 2;
      ctx.beginPath();
      // wobbly ink edge
      const rr = b.r * e;
      ctx.arc(b.x, b.y, rr, 0, 7);
      ctx.fill();
    }
  }

  run(to) {
    if (this.reduced) {
      // no ink animation — swap straight through
      this.progress = to;
      this.paint(to);
      if (to === 0) this.canvas.style.opacity = '0';
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const o = { p: this.progress };
      this.canvas.style.opacity = '1';
      gsap.to(o, {
        p: to, duration: 0.7, ease: 'sine.inOut',
        onUpdate: () => { this.progress = o.p; this.paint(o.p); },
        onComplete: () => {
          if (to === 0) this.canvas.style.opacity = '0';
          resolve();
        },
      });
    });
  }

  async open() {
    if (this.busy) return;
    this.busy = true;
    this.canvas.style.pointerEvents = 'all';
    await this.run(1);
  }

  async close() {
    await this.run(0);
    this.canvas.style.pointerEvents = 'none';
    this.busy = false;
  }
}
