import gsap from 'gsap';

export class Loader {
  constructor() {
    this.el = document.getElementById('loader');
    this.title = document.querySelector('.loader_title');
    this.number = document.getElementById('loaderNumber');
    this.subtitle = document.getElementById('loaderSubtitle');
    this.line = document.getElementById('loaderLine');
    this.progress = 0;
    this._o = { v: 0 };

    if (this.line) {
      this.line.style.marginLeft = 'auto';
      this.line.style.width = '0%';
    }
  }

  setProgress(p, label) {
    const target = Math.min(100, Math.round(p * 100));
    gsap.to(this._o, {
      v: target,
      duration: 0.45,
      ease: 'sine.out',
      overwrite: true,
      onUpdate: () => {
        this.progress = Math.round(this._o.v);
        if (this.number) this.number.textContent = `${this.progress}%`;
        if (this.line) this.line.style.width = `${this.progress}%`;
      },
    });
    if (label && this.subtitle) this.subtitle.textContent = label;
  }

  appear() {
    return new Promise((resolve) => {
      gsap.to('.loader_number', { y: '0%', duration: 0.8, ease: 'sine.inOut' });
      gsap.to('.loader_subtitle', { y: '0%', duration: 0.8, ease: 'sine.inOut', delay: 0.4 });
      gsap.to('.loader_title', { y: '0%', duration: 0.8, ease: 'sine.inOut', onComplete: resolve });
    });
  }

  disappear() {
    return new Promise((resolve) => {
      gsap.to('.loader_number', { y: '-110%', duration: 0.8, ease: 'sine.inOut' });
      gsap.to('.loader_subtitle', { y: '-110%', duration: 0.8, ease: 'sine.inOut', delay: 0.4 });

      // Anchor swap: pin line to LEFT edge so shrinking width pulls it into the left border
      if (this.line) {
        this.line.style.marginLeft = '0';
        this.line.style.width = '100%';
        gsap.to(this.line, {
          width: '0%',
          duration: 0.8,
          ease: 'sine.inOut',
        });
      }

      gsap.to('.loader_title', {
        y: '110%',
        duration: 0.8,
        ease: 'sine.inOut',
        onComplete: () => {
          this.el?.classList.add('done');
          resolve();
        },
      });
    });
  }
}
