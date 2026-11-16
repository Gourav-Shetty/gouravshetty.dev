import gsap from 'gsap';
import { homeHTML, galleryWalkHTML, projectHTML, aboutHTML, notFoundHTML } from '../pages.js';

/* SPA router — their flow: menu button slides away → ink transition opens
 * (~0.7 s) → content + Prismic data swap → transition closes → entrances.
 * Input stays locked while the ink is up. */
export class Router {
  constructor(projects, hooks) {
    this.projects = projects;
    this.hooks = hooks;
    this.path = location.pathname;
    this.main = document.getElementById('main');
    this.busy = false;
    addEventListener('popstate', () => this.render(location.pathname, true));
    document.addEventListener('click', (e) => {
      // anchors only — body carries a data-route attr for styling, and matching
      // it would preventDefault every click in the app (kills form submits)
      const a = e.target.closest('a[data-route]');
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute('data-route');
      if (href === this.path) return;
      history.pushState({}, '', href);
      this.render(href, false);
    });
  }

  projectByUid(uid) {
    return this.projects.find((p) => p.uid === uid);
  }

  neighbors(uid) {
    const i = this.projects.findIndex((p) => p.uid === uid);
    const prev = this.projects[(i - 1 + this.projects.length) % this.projects.length];
    const next = this.projects[(i + 1) % this.projects.length];
    return { prev, next, index: i };
  }

  swap(path) {
    document.body.dataset.route = path;
    if (path === '/') {
      this.main.innerHTML = homeHTML();
      this.hooks.setMode('walk');
    } else if (path === '/projects') {
      // the long exhibition hall — 3D only, no overlay (their /gallery walk)
      this.main.innerHTML = galleryWalkHTML();
      this.hooks.setMode('walk');
    } else if (path.startsWith('/project/')) {
      const uid = path.split('/')[2];
      const p = this.projectByUid(uid);
      if (!p) {
        this.main.innerHTML = notFoundHTML();
        this.hooks.setMode('walk');
      } else {
        const { prev, next } = this.neighbors(uid);
        this.main.innerHTML = projectHTML(p, prev, next);
        this.hooks.setMode('focus', p);
        document.getElementById('projectContact')?.addEventListener('click', () => this.hooks.contact(p));
      }
    } else if (path === '/about') {
      this.main.innerHTML = aboutHTML();
      document.getElementById('projectContact')?.addEventListener('click', () => this.hooks.contact(null));
      this.hooks.setMode('walk');
    } else {
      this.main.innerHTML = notFoundHTML();
      this.hooks.setMode('walk');
    }
    this.hooks.menu?.markActive(path);
    if (!this._isPop) window.scrollTo(0, 0);
  }

  entrances(path) {
    gsap.fromTo('.menu_open button', { y: '-100%' }, { y: '0%', duration: 0.3, delay: 0.3, ease: 'sine.inOut', overwrite: true });
    if (path === '/' || path === '/projects') {
      gsap.to('#hud', { opacity: 1, duration: 0.4, delay: 0.6, overwrite: true });
    }
    if (path.startsWith('/project/') || path === '/about') {
      // their article entrance: data lines rise, arrows slide in from sides
      gsap.fromTo('.data_top li span span, .data_bottom li span span',
        { y: '110%' }, { y: '0%', duration: 0.6, stagger: 0.06, delay: 0.2, ease: 'sine.out', overwrite: true });
      gsap.fromTo('.arrowL a', { x: '100%', opacity: 0 }, { x: '0%', opacity: 0.8, duration: 0.5, delay: 0.4, ease: 'sine.out', overwrite: true });
      gsap.fromTo('.arrowR a', { x: '-100%', opacity: 0 }, { x: '0%', opacity: 0.8, duration: 0.5, delay: 0.4, ease: 'sine.out', overwrite: true });
      gsap.fromTo('.contact_button', { opacity: 0 }, { opacity: 0.8, duration: 0.5, delay: 0.7, overwrite: true });
    }
  }

  async render(path, isPop) {
    if (this.busy) return;
    this._isPop = isPop;
    this.prevPath = this.path;
    this.path = path;
    const first = !this._booted;
    this._booted = true;
    if (first) {
      // boot: no ink, just swap + entrances (loader covered the wait)
      this.swap(path);
      this.entrances(path);
      return;
    }
    this.busy = true;
    this.hooks.menu?.close();
    this.hooks.lock?.(true);
    gsap.to('.menu_open button', { y: '-100%', duration: 0.25, ease: 'sine.inOut', overwrite: true });
    await this.hooks.transition?.open();
    this.swap(path);
    this.entrances(path);
    await this.hooks.transition?.close();
    this.hooks.onReady?.(path);
    this.hooks.lock?.(false);
    this.busy = false;
  }
}
