import './style.css';
import gsap from 'gsap';
import * as THREE from 'three';
import { Experience } from './core/Experience.js';
import { Loader } from './core/Loader.js';
import { Router } from './core/Router.js';
import { Menu } from './core/Menu.js';
import { Transition } from './core/Transition.js';
import { Gallery } from './world/Gallery.js';
import { makeCoverTexture } from './world/coverTexture.js';
import { Dialogue, INTRO } from './core/dialogue.js';
import { createQuests, questText } from './core/quests.js';
import { exitTarget } from './core/doors.js';
import { Character } from './world/Character.js';

import { projectHTML } from './pages.js';

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

async function boot() {
  // HMR re-executes this module on every edit → exactly one world allowed.
  if (window.__portfolioBooted) { location.reload(); return; }
  window.__portfolioBooted = true;
  const loader = new Loader();
  await loader.appear();
  loader.setProgress(0.1, 'projects');

  const res = await fetch('/data/projects.json');
  if (!res.ok) throw new Error('projects.json missing');
  const projects = await res.json();
  loader.setProgress(0.3, 'screenshots');

  // project artwork / repo screenshots for the frames that have them
  await Promise.allSettled(projects.filter((p) => p.image || p.shot).map((p) => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { p._img = img; resolve(); };
    img.onerror = () => resolve();
    img.src = p.image || p.shot;
  })));
  loader.setProgress(0.45, 'gallery');

  const canvas = document.getElementById('webgl');
  const exp = new Experience(canvas);
  const gallery = new Gallery(exp.scene, projects);
  loader.setProgress(0.8, 'character');

  const transition = new Transition();
  let mode = 'walk';
  let menu;

  const character = new Character(exp.scene, exp.camera, {
    onSelect: (p) => {
      history.pushState({}, '', `/project/${p.uid}`);
      router.render(`/project/${p.uid}`, false);
    },
  });
  await character.init();
  character.gallery = gallery;

  // Projected "See details" button — their gallery_link: HTML pinned over
  // the nearest frame within range, hidden otherwise / in focus / menu.
  const frameLink = document.createElement('button');
  frameLink.className = 'gallery_link frame-zoom-link big_link';
  frameLink.innerHTML = '<p>See details</p><div></div>';
  frameLink.style.position = 'fixed';
  frameLink.style.zIndex = '6';
  frameLink.style.left = '-500px';
  frameLink.style.top = '-500px';
  document.body.appendChild(frameLink);
  let frameTarget = null;
  frameLink.addEventListener('click', () => {
    if (!frameTarget || router.busy) return;
    history.pushState({}, '', `/project/${frameTarget.uid}`);
    router.render(`/project/${frameTarget.uid}`, false);
  });
  // Guestwall twin — pinned over the board while standing on its circle.
  const guestLink = document.createElement('button');
  guestLink.className = 'gallery_link frame-zoom-link guest-link';
  guestLink.textContent = 'Sign the wall · G';
  guestLink.style.position = 'fixed';
  guestLink.style.zIndex = '6';
  guestLink.style.left = '-500px';
  guestLink.style.top = '-500px';
  document.body.appendChild(guestLink);
  guestLink.addEventListener('click', () => {
    if (!router.busy) setGuestwallOpen(true);
  });
  const projV = new THREE.Vector3();
  let currentFrame = null;
  let night = false;
  let currentUid = null;

  // In-frame arrow paging — their arrows flip whole pages, but here only the
  // frame content dissolves (ink u_tex→u_next) and the wall labels swap.
  // Capture phase + stopPropagation keeps Router's full transition out.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.article_arrows a');
    if (!a || !currentFrame || !currentUid || router.busy) return;
    e.preventDefault();
    e.stopPropagation();
    const back = a.closest('.arrowL') !== null;
    const len = projects.length;
    const ni = (projects.findIndex((p) => p.uid === currentUid) + (back ? -1 : 1) + len) % len;
    const next = projects[ni];
    const nprev = projects[(ni - 1 + len) % len];
    const nnext = projects[(ni + 1) % len];
    history.pushState({}, '', `/project/${next.uid}`);
    router.path = `/project/${next.uid}`;
    gallery.setTexture(currentFrame.art, makeCoverTexture(next));
    currentUid = next.uid;
    const tmp = document.createElement('div');
    tmp.innerHTML = projectHTML(next, nprev, nnext);
    const cur = document.querySelector('.article_container');
    if (cur) {
      cur.querySelector('.data_top').innerHTML = tmp.querySelector('.data_top').innerHTML;
      cur.querySelector('.data_bottom').innerHTML = tmp.querySelector('.data_bottom').innerHTML;
      cur.querySelector('.article_arrows').innerHTML = tmp.querySelector('.article_arrows').innerHTML;
      gsap.fromTo('.data_top li span span, .data_bottom li span span',
        { y: '110%' }, { y: '0%', duration: 0.5, stagger: 0.05, ease: 'sine.out', overwrite: true });
    }
    menu.markActive(`/project/${next.uid}`);
  }, true);

  const router = new Router(projects, {
    transition,
    menu: null,
    setMode: (m, project) => {
      mode = m;
      if (m === 'focus' && project) {
        // physical frame stays fixed for in-frame paging; logical uid moves
        currentFrame = gallery.frameFor(project.uid)
          || gallery.frames.find((f) => f.project.uid === project.uid) || null;
        currentUid = project.uid;
        quests.done.add('project');
        renderQuests();
        gallery.setFocusMode(true, currentFrame);
        character.focusOn(project, gallery);
      } else {
        gallery.setFocusMode(false);
        currentFrame = null;
        currentUid = null;
        // hall swap when the route moved between the home hall and the long
        // /projects rail — teleport + camera snap happen under the ink.
        // Entering /projects ALWAYS repositions onto its entry point (theirs:
        // the frame you just read, its circle) — article pages move the
        // character to their stand spot, so re-sync on every entry.
        const inLong = router.path === '/projects';
        if (inLong) {
          gallery.setHall('long');
          character.railMode = true;
          character.setBounds({ xMin: gallery.railMin, xMax: gallery.exitX, zMin: 0, zMax: 0 });
          const fromUid = router.prevPath?.match(/^\/project\/(.+)$/)?.[1];
          const sx = fromUid != null ? gallery.longSpotX(fromUid) : null;
          character.teleport(sx ?? gallery.entryX, 0);
        } else {
          if (gallery.hall !== 'home') {
            gallery.setHall('home');
            character.railMode = false;
            character.setBounds({ xMin: -2.9, xMax: 2.9, zMin: -12.5, zMax: 7 });
            character.teleport(0, 5.5);
          } else {
            // article return on home (Esc from the details page, browser
            // back): put the character back onto the circle it read
            const fromUid = router.prevPath?.match(/^\/project\/(.+)$/)?.[1];
            const c = fromUid ? gallery.spotFor(fromUid, 'home') : null;
            if (c) character.teleport(c.x, c.z);
          }
        }
        renderQuests();
        character.release();
      }
    },
    contact: (p) => {
      toast(p ? `Contact about “${p.title}” — shettygourav1@gmail.com` : 'shettygourav1@gmail.com');
    },
    lock: (v) => { character.enabled = !v && mode === 'walk' && !character.isMoving; },
    onReady: (path) => {
      if (path.startsWith('/project/')) {
        character.walkIn();
      }
    },
  });

  // their walk-through doors: home deep end → /projects (their home exit
  // leads into the gallery); either end of the long hall → home. The
  // character walks through the line, ink covers the swap (their
  // simulateLinkClick + 2s anti-spam gate → ours: spent-door arming).
  character.exitCheck = () => {
    if (mode !== 'walk' || router.busy || menu.isOpen) return null;
    return exitTarget(router.path, character.root.position, character.bounds, gallery);
  };
  character.onExit = (target) => {
    history.pushState({}, '', target);
    router.render(target, false);
  };

  menu = new Menu(projects);
  router.hooks.menu = menu;

  // quests: circle stand / project open / hi — banner + X/8 circles readout
  const quests = createQuests();
  const questEl = document.getElementById('quest');
  const questTextEl = document.getElementById('questText');
  const renderQuests = () => {
    questTextEl.textContent = questText(quests);
    const showQuest = mode === 'walk' && (router.path === '/' || router.path === '/projects');
    questEl.classList.toggle('show', showQuest);
  };
  window.__menu = menu;

  let lastInput = performance.now();
  const bootT = lastInput;
  for (const ev of ['keydown', 'pointerdown', 'wheel', 'touchstart']) {
    addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true });
  }

  exp.onTick(({ delta, elapsed }) => {
    character.update(delta);
    gallery.updateDust(elapsed || 0);
    // quest: standing on any circle
    if (character.openSpot && mode === 'walk') {
      quests.done.add('circle');
      if (character.openSpot.project?.uid) quests.circles.add(character.openSpot.project.uid);
      renderQuests();
    }
    // Standing-circle zoom link — their gallery_link: pinned above the open
    // frame while the visitor stands on its circle. Click routes to project.
    const spot = character.openSpot;
    const onWalkPage = router.path === '/' || router.path === '/projects';
    frameTarget = (spot?.project && mode === 'walk' && onWalkPage) ? spot.project : null;
    for (const s of gallery.spots) {
      const active = s === spot && mode === 'walk';
      s.mat.opacity = active ? 1 : 0.55;
      const sc = active ? 1.12 : 1;
      s.ring.scale.set(sc, sc, 1);
    }
    let bx = -500, by = -500, show = false;
    if (frameTarget) {
      projV.copy(spot.artPos);
      projV.y += spot.h * 0.5 + 0.22;
      projV.project(exp.camera);
      if (projV.z < 1) {
        bx = (projV.x * 0.5 + 0.5) * innerWidth;
        by = (-projV.y * 0.5 + 0.5) * innerHeight;
        show = !router.busy && !menu.isOpen;
      } else {
        frameTarget = null;
      }
    }
    frameLink.style.left = `${bx}px`;
    frameLink.style.top = `${by}px`;
    frameLink.classList.toggle('link_open', show);
    // guest circle twin: same pin-over-the-art treatment, opens the form
    const onGuest = !!(spot?.guest && mode === 'walk' && onWalkPage);
    let gx = -500, gy = -500, gshow = false;
    if (onGuest) {
      projV.copy(spot.artPos);
      projV.y += 1.45;
      projV.project(exp.camera);
      if (projV.z < 1) {
        gx = (projV.x * 0.5 + 0.5) * innerWidth;
        gy = (-projV.y * 0.5 + 0.5) * innerHeight;
        gshow = !router.busy && !menu.isOpen;
      }
    }
    guestLink.style.left = `${gx}px`;
    guestLink.style.top = `${gy}px`;
    guestLink.classList.toggle('link_open', gshow);
    // HUD hides while zoomed or after 7 s idle — clean strolling like theirs.
    const hud = document.getElementById('hud');
    if (hud && !router.busy) {
      const idle = performance.now() - lastInput > 7000 && performance.now() - bootT > 9000;
      hud.style.opacity = (spot && mode === 'walk') || idle ? '0' : '1';
    }
  });
  exp.start();
  loader.setProgress(1, 'ready');

  // unknown paths must render the 404 page, not silently fall back to home
  const startPath = location.pathname || '/';
  await router.render(startPath, true);
  await loader.disappear();
  if (startPath.startsWith('/project/')) {
    character.walkIn({ delay: 0.1 });
  }
  gsap.to('.menu_open button', { y: '0%', duration: 0.4, ease: 'sine.out', delay: 0.2 });
  gsap.set('.menu_button button', { y: '0%' });

  // Intro dialogue — avatar introduces the owner on first visit, H replays.
  // Any route change ends it instantly so pages never overlap content.
  const dialogue = new Dialogue();
  window.__dialogue = dialogue;
  const startIntro = () => {
    if (dialogue.active || router.busy) return;
    character.enabled = false;
    character.sayHi();
    dialogue.play(INTRO, () => {
      if (mode === 'walk' && !character.isMoving) character.enabled = true;
    });
  };
  // Where the character was last walking (before entering an article) —
  // Esc-from-details returns to this page, character back on its circle.
  let articleOrigin = (router.path === '/' || router.path === '/projects') ? router.path : '/';
  const origRender = router.render.bind(router);
  router.render = async (path, isPop) => {
    if (router.path === '/' || router.path === '/projects') articleOrigin = router.path;
    dialogue.finish();
    if (guestwallOpen) setGuestwallOpen(false);
    return origRender(path, isPop);
  };
  // Hovering "Contact me" in the article view triggers the character waving (hi/coucou)
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('#projectContact') || e.target.closest('.contact_button')) {
      character.sayHi();
    }
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#projectContact');
    if (btn && currentUid) {
      const p = projects.find((x) => x.uid === currentUid);
      toast(p ? `Contact about “${p.title}” — shettygourav1@gmail.com` : 'shettygourav1@gmail.com');
    }
  });

  addEventListener('keydown', (e) => {
    if ((e.key === 'h' || e.key === 'H') && !dialogue.active && !guestwallOpen && !e.target.closest('input')) {
      quests.done.add('hi');
      renderQuests();
      character.sayHi();
      startIntro();
    }
  });
  // Enter opens the zoomed project — their HUD reads "See details [Enter]".
  // (Clicking the pinned button already worked; keys never had a handler.)
  addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.closest('input')) return;
    if (dialogue.active || guestwallOpen || router.busy || menu.isOpen) return;
    if (mode !== 'walk' || (router.path !== '/' && router.path !== '/projects')) return;
    if (!frameTarget) {
      // Enter on the guestwall circle opens the form, like See details
      if (character.openSpot?.guest && !guestwallOpen) {
        e.preventDefault();
        setGuestwallOpen(true);
      }
      return;
    }
    e.preventDefault();
    history.pushState({}, '', `/project/${frameTarget.uid}`);
    router.render(`/project/${frameTarget.uid}`, false);
  });
  // Esc on a project page walks back to the page it was entered from —
  // the character re-parks on its circle (home branch re-teleports; the
  // long-hall branch re-syncs via prevPath). Menu-open Esc stays the menu.
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (guestwallOpen || menu.isOpen || router.busy) return;
    if (!router.path.startsWith('/project/')) return;
    history.pushState({}, '', articleOrigin);
    router.render(articleOrigin, false);
  });
  // N — night shift. Flips the room's lighting mood, keeps N toggling anywhere.
  addEventListener('keydown', (e) => {
    if ((e.key === 'n' || e.key === 'N') && !guestwallOpen && !e.target.closest('input')) {
      night = !night;
      gallery.setNight(night);
      toast(night ? 'Night shift — lights down' : 'Day shift — lights up');
    }
  });
  // Guestwall — G pins a note to the home hall's left wall (localStorage).
  // Modal locks the walker; Esc / backdrop closes it.
  const guestwall = document.createElement('div');
  guestwall.className = 'guestwall';
  guestwall.setAttribute('role', 'dialog');
  guestwall.setAttribute('aria-modal', 'true');
  guestwall.setAttribute('aria-label', 'Guestwall');
  guestwall.innerHTML = `
    <form class="guestwall_card" id="guestwallForm">
      <h2>Guestwall</h2>
      <p>Pin a short note to the wall by the deep end of the home hall.</p>
      <label for="gwName">Name</label>
      <input id="gwName" name="name" maxlength="24" autocomplete="off" placeholder="Guest" />
      <label for="gwMsg">Note</label>
      <textarea id="gwMsg" name="message" maxlength="140" placeholder="Say hi to the next walker…"></textarea>
      <div class="guestwall_actions">
        <button type="button" id="gwClose">Close</button>
        <button class="primary" type="submit">Pin note</button>
      </div>
    </form>`;
  document.body.appendChild(guestwall);
  const gwForm = guestwall.querySelector('#guestwallForm');
  const gwName = guestwall.querySelector('#gwName');
  const gwMsg = guestwall.querySelector('#gwMsg');
  let guestwallOpen = false;
  let guestwallReturnFocus = null;
  const gwFocusables = () => [...gwForm.querySelectorAll('input, textarea, button')];
  function setGuestwallOpen(v) {
    guestwallOpen = v;
    guestwall.classList.toggle('open', v);
    if (v) {
      character.enabled = false;
      guestwallReturnFocus = document.activeElement;
      gwName.focus({ preventScroll: true });
    } else {
      if (mode === 'walk' && !character.isMoving) character.enabled = true;
      // hand focus back where it came from
      if (guestwallReturnFocus?.focus) guestwallReturnFocus.focus({ preventScroll: true });
      guestwallReturnFocus = null;
    }
  }
  // keep Tab inside the dialog while it is open
  guestwall.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = gwFocusables();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  window.__guestwall = { isOpen: () => guestwallOpen, open: () => setGuestwallOpen(true), close: () => setGuestwallOpen(false) };
  guestwall.addEventListener('click', (e) => { if (e.target === guestwall) setGuestwallOpen(false); });
  guestwall.querySelector('#gwClose').addEventListener('click', () => setGuestwallOpen(false));
  gwForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const note = gallery.addGuestNote({ name: gwName.value, msg: gwMsg.value });
    if (!note) { toast('Write a note first'); return; }
    toast('Pinned to the guestwall');
    gwForm.reset();
    setGuestwallOpen(false);
  });
  addEventListener('keydown', (e) => {
    if (guestwallOpen) {
      if (e.key === 'Escape') { e.preventDefault(); setGuestwallOpen(false); }
      return;
    }
    if (e.target.closest('input,textarea')) return;
    if ((e.key === 'g' || e.key === 'G') && mode === 'walk'
      && (router.path === '/' || router.path === '/projects')
      && !dialogue.active && !router.busy && !menu.isOpen) {
      e.preventDefault();
      setGuestwallOpen(true);
    }
  });
  if (startPath === '/') {
    // intro plays on every home load — no keys, no flags
    setTimeout(startIntro, 900);
  }
  window.__char = character;
  window.__gallery = gallery;
  window.__trans = transition;
  window.__dbg = { router: () => ({ busy: router.busy, path: router.path, tbusy: transition.busy, mode, enabled: character.enabled, moving: character.isMoving }) };
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('loaderNumber').textContent = 'ERR';
  toast('Failed to start — run `npm run dev` and open the Vite URL');
});
