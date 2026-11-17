import gsap from 'gsap';

/* DOM side of the spotlight intro. Knows about the scrim/caption elements and
 * nothing about chapters or timing — createIntro drives it via onChapter. */
export function createOverlay() {
  const root = document.getElementById('intro');
  const hole = document.getElementById('introHole');
  const caption = document.getElementById('introCaption');
  const num = document.getElementById('introNum');
  const label = document.getElementById('introLabel');
  const line = document.getElementById('introLine');
  const sub = document.getElementById('introSub');
  const hint = document.getElementById('introHint');
  const skipSurface = document.getElementById('introSkip');

  let shown = false;

  const moveHole = (h, instant) => {
    if (!h) return; // phone end-wall stop is caption-only
    gsap.to(hole, {
      left: `${h.x}%`, top: `${h.y}%`,
      width: h.r * 2, height: h.r * 2,
      duration: instant ? 0 : 0.9, ease: 'sine.inOut', overwrite: true,
    });
  };

  return {
    get shown() { return shown; },

    onSkip(fn) {
      skipSurface.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      });
    },

    show(chapter, i, { isPhone = false } = {}) {
      shown = true;
      root.classList.add('show');
      gsap.set(root, { opacity: 1 });
      hint.textContent = isPhone ? 'tap to skip' : 'tap or press Esc to skip';
      document.body.classList.add('intro-active');

      num.textContent = `0${i + 1} / 04`;
      label.textContent = chapter.label;
      line.textContent = chapter.caption;
      sub.textContent = chapter.sub;

      gsap.fromTo(caption,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.14, ease: 'sine.out', overwrite: true });
      const h = isPhone ? chapter.phoneHole : chapter.hole;
      moveHole(h, i === 0);
    },

    hide(duration = 0.9) {
      if (!shown) return;
      shown = false;
      document.body.classList.remove('intro-active');
      const d = Math.max(0, duration);
      gsap.to(caption, { opacity: 0, y: -12, duration: Math.min(0.35, d), ease: 'sine.in', overwrite: true });
      gsap.to(root, {
        opacity: 0, duration: d, ease: 'sine.inOut', overwrite: true,
        onComplete: () => {
          root.classList.remove('show');
          gsap.set(root, { clearProps: 'opacity' });
          gsap.set(caption, { clearProps: 'opacity,transform' });
          gsap.set(hole, { clearProps: 'left,top,width,height' });
        },
      });
    },
  };
}
