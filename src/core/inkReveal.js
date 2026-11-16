/* Procedural ink-spread mask — mirrors the menu preview stack exactly:
 * artwork <img> underneath, animated ink <canvas> on top with
 * mix-blend-mode: multiply. White ink on black reveals the art as it
 * spreads, like a drop falling in water. No video file needed. */
export class InkReveal {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.raf = 0;
    this.progress = 1;
    this.seeds = [];
    this.resize();
  }

  resize(size = 320) {
    this.canvas.width = size;
    this.canvas.height = size;
  }

  play() {
    // fresh random bloom on every hover, like the video restarting
    const n = 12 + ((Math.random() * 5) | 0);
    this.seeds = [];
    for (let i = 0; i < n; i++) {
      this.seeds.push({
        x: 0.15 + Math.random() * 0.7,
        y: 0.15 + Math.random() * 0.7,
        maxR: 0.2 + Math.random() * 0.2,
        delay: Math.random() * 0.4,
        p1: Math.random() * 7, p2: Math.random() * 7, p3: Math.random() * 7,
      });
    }
    this.start = performance.now();
    this.progress = 0;
    cancelAnimationFrame(this.raf);
    this.tick();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  fill() {
    // fully revealed resting state (menu closed / first paint)
    this.stop();
    this.progress = 1;
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.width);
  }

  blob(s, t) {
    // local 0..1 growth with stagger delay, eased in-out for a slow bloom
    const local = Math.min(1, Math.max(0, (t - s.delay) / (1 - s.delay)));
    const e = local < 0.5 ? 2 * local * local : 1 - Math.pow(-2 * local + 2, 2) / 2;
    return e <= 0 ? 0 : s.maxR * e;
  }

  tick() {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const t = Math.min(1, (performance.now() - this.start) / 1600);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = '#fff';
    for (const s of this.seeds) {
      const r = this.blob(s, t) * W;
      if (r <= 0.5) continue;
      // wobbly ink edge: layered harmonics read as fractal bleed
      ctx.beginPath();
      const cx = s.x * W, cy = s.y * W;
      for (let a = 0; a <= 6.29; a += 0.12) {
        const rr = r * (1 + 0.32 * Math.sin(3 * a + s.p1) + 0.18 * Math.sin(7 * a + s.p2) + 0.1 * Math.sin(13 * a + s.p3));
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    this.progress = t;
    if (t < 1) {
      this.raf = requestAnimationFrame(() => this.tick());
    } else {
      this.raf = 0;
      // snap fully open so no corner stays masked
      this.ctx.fillStyle = '#fff';
      this.ctx.fillRect(0, 0, canvas.width, canvas.width);
    }
  }
}
