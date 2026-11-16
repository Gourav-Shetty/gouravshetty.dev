import gsap from 'gsap';
import { makeCoverTexture } from '../world/coverTexture.js';
import { InkReveal } from './inkReveal.js';

/* Fullscreen menu — their choreography: main links stagger up, divider
 * line grows 0→100%, artwork links stagger, ink preview blooms in.
 * Hovering an artwork restarts the ink-drop reveal over its cover. */
export class Menu {
  constructor(projects) {
    this.projects = projects;
    this.isOpen = false;
    this.list = document.getElementById('menuList');
    this.input = document.getElementById('searchInput');
    this.preview = document.getElementById('menuPreview');
    this.previewImg = document.getElementById('menuPreviewImg');
    this.ink = new InkReveal(document.getElementById('menuInk'));
    this.line = document.getElementById('menuLine');
    this.covers = {};
    for (const p of projects) {
      try { this.covers[p.uid] = makeCoverTexture(p).toDataURL(); } catch { /* noop */ }
    }
    this.previewFor(this.projects[0], true);
    this.renderList('');
    this.input.addEventListener('input', () => this.renderList(this.input.value));

    document.getElementById('menuOpenBtn').addEventListener('click', () => this.open());
    document.getElementById('menuCloseBtn').addEventListener('click', () => this.close());
    document.getElementById('contactBtn').addEventListener('click', () => {
      this.close();
      window.location.href = 'mailto:shettygourav1@gmail.com?subject=Project%20inquiry';
    });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
      // keep Tab inside the open menu instead of wandering behind it
      if (e.key === 'Tab' && this.isOpen) {
        const items = [...document.querySelectorAll(
          '.menu_main_links a, #searchInput, .menu_links a, #contactBtn, #githubLink'
        )].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  previewFor(p, instant = false) {
    if (!p) return;
    const url = this.covers[p.uid];
    if (!url) return;
    if (this.previewImg.getAttribute('src') !== url) {
      this.previewImg.src = url;
    }
    // restart the ink drop on every hover, like their video scrub
    if (instant) this.ink.fill();
    else this.ink.play();
  }

  renderList(q) {
    const query = q.trim().toLowerCase();
    const items = this.projects.filter((p) =>
      !query || p.title.toLowerCase().includes(query) || (p.stack || []).join(' ').toLowerCase().includes(query)
    );
    this.list.innerHTML = items.length
      ? items.map((p) => `<li><a href="/project/${p.uid}" data-route="/project/${p.uid}" data-uid="${p.uid}">${p.title}</a></li>`).join('')
      : `<li><span style="color:#fff;font-size:15rem">No projects found</span></li>`;
    this.list.querySelectorAll('a').forEach((a) => {
      a.addEventListener('mouseenter', () => {
        this.previewFor(this.projects.find((x) => x.uid === a.dataset.uid));
      });
      a.addEventListener('click', () => this.close());
    });
    if (this.isOpen && items.length) {
      gsap.fromTo('#menuList a', { y: '-100%' }, { y: '0%', duration: 0.25, stagger: 0.02, ease: 'sine.out', overwrite: true });
    }
  }

  markActive(path) {
    document.querySelectorAll('.menu_main_links a').forEach((a) => {
      const r = a.dataset.route;
      a.classList.toggle('active', r === path || (r === '/projects' && path.startsWith('/project')));
    });
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    document.body.classList.add('menu-open');
    document.getElementById('menu').classList.add('open');
    document.getElementById('menuText').setAttribute('aria-hidden', 'false');
    gsap.fromTo('.menu_main_links a', { y: '-110%' }, { y: '0%', duration: 0.3, stagger: 0.06, ease: 'sine.out', overwrite: true });
    gsap.fromTo(this.line, { scaleY: 0 }, { scaleY: 1, duration: 0.9, ease: 'sine.inOut', overwrite: true });
    gsap.fromTo('#menuList a', { y: '-100%' }, { y: '0%', duration: 0.3, stagger: 0.025, ease: 'sine.out', delay: 0.15, overwrite: true });
    gsap.fromTo('#menuPreview', { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.5, delay: 0.3, ease: 'sine.out', overwrite: true });
    gsap.fromTo('#searchBar', { opacity: 0 }, { opacity: 0.9, duration: 0.4, delay: 0.4, overwrite: true });
    gsap.fromTo('.menu_contact,.menu_insta', { opacity: 0 }, { opacity: 0.8, duration: 0.4, delay: 0.5, overwrite: true });
    this.ink.play();
    setTimeout(() => this.input.focus({ preventScroll: true }), 350);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.ink.stop();
    gsap.set('.menu_contact,.menu_insta,#searchBar', { clearProps: 'opacity' });
    document.body.classList.remove('menu-open');
    document.getElementById('menu').classList.remove('open');
    document.getElementById('menuText').setAttribute('aria-hidden', 'true');
    document.getElementById('menuOpenBtn').focus({ preventScroll: true });
  }
}
