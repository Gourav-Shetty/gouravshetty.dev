import * as THREE from 'three';
import gsap from 'gsap';
import { makeCoverTexture, makePlaque } from './coverTexture.js';
import { isPhone } from '../core/device.js';

export const dissolveVert = `varying vec2 vUv; void main(){ vec4 m=modelMatrix*vec4(position,1.0); gl_Position=projectionMatrix*viewMatrix*m; vUv=uv; }`;
export const dissolveFrag = `
varying vec2 vUv; uniform sampler2D u_tex,u_next,u_noise; uniform float u_progress;
void main(){
  float noise = texture2D(u_noise, vUv).r;
  float remapedProgress = 1.0 - abs(u_progress * 2.0 - 1.0);
  noise *= remapedProgress;
  vec2 dir = (vUv - 0.5) * 1.0;
  vec2 displacedUv = vUv - (dir * noise);
  vec3 tex = texture2D(u_tex, displacedUv).rgb;
  vec3 next = texture2D(u_next, displacedUv).rgb;
  float finalProg = smoothstep(0.2, 0.8, u_progress);
  vec3 finalRes = mix(tex, next, finalProg);
  gl_FragColor = vec4(finalRes, 1.0);
}`;

function noiseCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 255;
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// soft plaster/floor grain — enough tonal variation to read against the
// page background (the wall uses plaster PBR textures for the same job)
function grainTexture(base, repeat = [10, 10]) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const d = (Math.random() - 0.5) * 16;
    img.data[i] = Math.min(255, Math.max(0, img.data[i] + d));
    img.data[i + 1] = Math.min(255, Math.max(0, img.data[i + 1] + d));
    img.data[i + 2] = Math.min(255, Math.max(0, img.data[i + 2] + d));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = ANISO;
  return t;
}

const ANISO = 8; // renderer clamps to the GPU max; helps angled wall textures

function textCanvas(lines, { w = 1536, h = 768, title = '', sub = 'projects', titlePx = 84, subPx = 42, noBg = false, bodyFont = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const k = w / 1024;
  if (!noBg) {
    g.fillStyle = '#f4f4f4';
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = '#111';
  let y = noBg ? h * 0.42 : 120;
  const x0 = noBg ? w * 0.16 : 90;
  if (title) {
    g.font = `700 ${titlePx}px "Josefin Sans", sans-serif`;
    g.fillText(title, x0, y); y += titlePx * 0.85;
    g.font = `400 ${subPx}px "Josefin Sans", sans-serif`;
    if (sub) g.fillText(sub, x0 + 3, y); y += 70 * k;
  }
  const bodyPx = Math.round((bodyFont ? 34 : 32) * k);
  g.font = bodyFont
    ? `400 ${bodyPx}px "Times New Roman", Times, serif`
    : `400 ${bodyPx}px "Josefin Sans", sans-serif`;
  const step = Math.round(46 * k);
  const maxChars = Math.max(40, Math.floor((w - 180) / (bodyPx * 0.52)));
  for (const line of lines) {
    const words = line.split(' ');
    let row = '';
    for (const word of words) {
      if ((row + ' ' + word).length > maxChars) { g.fillText(row, x0, y); y += step; row = word; }
      else row = row ? row + ' ' + word : word;
    }
    if (row) { g.fillText(row, x0, y); y += step; }
    y += 14 * k;
    if (y > h - 40) break;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  return t;
}

export class Gallery {
  constructor(scene, projects) {
    this.scene = scene;
    this.scene.background = new THREE.Color(0xf2f2f2);
    this.scene.fog = new THREE.Fog(0xe4e4e4, 18, 44);
    this.projects = projects.slice(0, 8);
    this.frames = [];
    this.spots = []; // guest spot lands in buildRoom, frame spots in buildFrames
    this.noise = noiseCanvas();
    this.buildLights();
    this.buildRoom();
    this.buildFrames();
    this.buildRailings();
    this.buildFloorMarkers();
    this.buildLongHall();
    this.setHall('home');
  }

  buildLights() {
    const touch = isPhone;
    const dim = touch ? 0.72 : 1;
    this.dim = dim;
    // phone GPU budget: 2 spots (not 4), 1024² shadow map (not 2048²),
    // tighter frustum; the contact blob fakes the avatar's ground shadow
    this.baseHemi = (touch ? 1.28 : 1.15) * dim;
    this.baseKey = 2.0 * dim;
    this.baseSpot = 30;
    const hemi = new THREE.HemisphereLight(0xffffff, 0xd8d8d8, this.baseHemi);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, this.baseKey);
    key.position.set(2, 7, 5);
    key.castShadow = true;
    const shadowRes = touch ? 1024 : 2048;
    key.shadow.mapSize.set(shadowRes, shadowRes);
    key.shadow.camera.left = -8; key.shadow.camera.right = 8;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
    key.shadow.camera.near = 1; key.shadow.camera.far = 24;
    key.shadow.camera.updateProjectionMatrix();
    this.scene.add(key);
    const spots = [];
    const spotsToBuild = touch
      ? [[-2.6, 4.4, 2], [2.6, 4.4, 2]]
      : [[-2.6, 4.4, 2], [2.6, 4.4, 2], [-2.6, 4.4, -6], [2.6, 4.4, -6]];
    for (const [x, y, z] of spotsToBuild) {
      const s = new THREE.SpotLight(0xffffff, this.baseSpot, 14, 0.55, 0.7);
      s.position.set(x, y, z);
      s.target.position.set(x > 0 ? 4.5 : -4.5, 2.15, z);
      this.scene.add(s, s.target);
      spots.push(s);
    }
    this.lights = { hemi, key, spots };
  }

  buildRoom() {
    const room = this.homeGroup = new THREE.Group();
    this.hallName = 'home';
    this.hallGroup = room;
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xf6f6f6, roughness: 0.95 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfbfbfb, roughness: 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 32), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    room.add(floor);

    const mkWall = (w, h, x, y, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      m.position.set(x, y, z); m.rotation.y = ry;
      m.receiveShadow = true;
      room.add(m);
    };
    mkWall(9.5, 7, 0, 3.5, -15, 0);          // end wall (description)
    mkWall(32, 7, -4.75, 3.5, 0, Math.PI / 2); // left
    mkWall(32, 7, 4.75, 3.5, 0, -Math.PI / 2); // right

    // Flat gallery ceiling + flush skylight strips. One plane, no tilts,
    // no gaps: tilted slabs read as glitch geometry from below.
    this.ceilMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 32), this.ceilMat);
    ceil.position.set(0, 6.42, 0);
    ceil.rotation.x = Math.PI / 2;
    room.add(ceil);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    // touch screens look straight up into the borders — glow panels only.
    // ?touch=1 forces the touch path on desktop for testing.
    const touch = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) {
        const z = 6 - i * 7;
        const cx = side * 2.0;
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0), skyMat);
        glow.position.set(cx, 6.28, z);
        glow.rotation.x = Math.PI / 2;
        if (touch) { room.add(glow); continue; }
        // border as 4 edge strips (no coplanar overlap → no shimmer)
        const mkStrip = (w, h, ox, oz) => {
          const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), frameMat);
          s.position.set(cx + ox, 6.29, z + oz);
          s.rotation.x = Math.PI / 2;
          room.add(s);
        };
        mkStrip(1.2, 0.09, 0, 1.045);
        mkStrip(1.2, 0.09, 0, -1.045);
        mkStrip(0.09, 2.0, 0.645, 0);
        mkStrip(0.09, 2.0, -0.645, 0);
        room.add(glow);
      }
    }

    // NOTE: no entrance geometry here. The chase camera always sits 5.2
    // units BEHIND the visitor and looks forward, so anything placed at the
    // entrance (the "vitre" + barriere) ends up inside the lens — a black
    // bar across the whole frame; walking backwards there shows a rail
    // there shows the rail, never a door. The entrance stays out of frame.

    // End-wall description panel
    const desc = textCanvas([
      'A walkable portfolio. Eight selected projects hang like drawings — simple frames, quiet light.',
      'Walk with WASD or arrows. Click a frame to read the project like a wall label.',
      'Everything is procedural: no model downloads, just light, rails and paper.',
    ], { title: 'Portfolio', bodyFont: true });
    const descMesh = this.descMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 3.2),
      new THREE.MeshBasicMaterial({ map: desc })
    );
    descMesh.position.set(0, 2.7, -14.9);
    room.add(descMesh);

    // Wayfinding — thes hangs "Gallery" sheets near the walk start, ON the
    // side walls (the glTF anchors galleryL/R: x=±25, z=2 of the .08-scaled
    // room → x=±2, z≈0.16, y 1.04, ry ±90° face-into-room; 2×1 plane .3 with
    // mirrored elbow-arrow strokes, black). Nothing on the end wall but the
    // description. Ours: same treatment, word "Projects", our scale.
    this.wayfinding = [];
    const sheet = (left) => {
      const c = document.createElement('canvas');
      const k = 1.5;
      c.width = 1024 * k; c.height = 512 * k;
      const g = c.getContext('2d');
      g.scale(k, k);
      g.strokeStyle = '#111';
      g.fillStyle = '#111';
      // elbow path, mirrored for the right sheet (the panneau_galerieL/R)
      const pts = left
        ? [[60, 330], [253, 432], [253, 318], [630, 318]]
        : [[964, 330], [771, 432], [771, 318], [394, 318]];
      g.lineWidth = 17;
      g.lineJoin = 'miter';
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
      // the word hugs the far edge of the elbow, like thes
      g.font = '700 215px "Josefin Sans", sans-serif';
      const w = g.measureText('Projects').width;
      g.fillText('Projects', left ? 968 - w : 56, 296);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = ANISO;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1.35, 0.675),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      );
      m.position.set(left ? -4.63 : 4.63, 1.05, 2.3);
      m.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
      room.add(m);
      this.wayfinding.push(m);
    };
    sheet(true);
    sheet(false);

    // Guestwall — visitor notes pinned on the left wall past the last frame,
    // the big clear stretch near the deep end. Local-only (localStorage).
    this.buildGuestWall(room);

    this.scene.add(room);
  }

  guestKey() { return 'portfolio3d.guestwall.v1'; }

  loadGuestNotes() {
    try {
      const raw = localStorage.getItem(this.guestKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((n) => n && typeof n.msg === 'string');
      }
    } catch { /* private mode / file:// — fall through to seeds */ }
    return [
      { name: 'Gourav', msg: 'first note on the wall. hi and welcome.', date: '2026-11-09' },
      { name: 'visitor', msg: 'the scribble avatar is perfect. 10/10.', date: '2026-11-09' },
      { name: 'anon', msg: 'try the /projects rail. W goes deeper.', date: '2026-11-09' },
    ];
  }

  saveGuestNotes() {
    try { localStorage.setItem(this.guestKey(), JSON.stringify(this.guestNotes.slice(-24))); } catch { /* ignore */ }
  }

  buildGuestWall(room) {
    this.guestNotes = this.loadGuestNotes();
    const g = this.guestGroup = new THREE.Group();
    // board + circle sit just short of the deep-end door line (z <-12.35)
    // so standing on the ring never fires the /projects exit
    g.position.set(-4.63, 2.6, -11.8);
    g.rotation.y = Math.PI / 2; // flat on the left wall, facing the room
    // board: light card with dark frame + title (transparent edges)
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 832;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(0, 0, 1024, 832);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 1004, 812);
    ctx.fillStyle = '#111';
    ctx.font = '700 96px "Josefin Sans", sans-serif';
    ctx.fillText('Guestwall', 66, 128);
    ctx.font = '400 38px "Josefin Sans", sans-serif';
    ctx.fillText('leave a note — press G', 68, 178);
    ctx.font = '400 30px "Josefin Sans", sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText(`${this.guestNotes.length} note${this.guestNotes.length === 1 ? '' : 's'} pinned`, 68, 770);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ANISO;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.6),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    board.castShadow = true;
    g.add(board);
    this.guestNotesGroup = new THREE.Group();
    this.guestNotesGroup.position.z = 0.02;
    g.add(this.guestNotesGroup);
    this.guestGroup = g;
    room.add(g);
    this.renderGuestNotes();
    // standing circle for the board — behaves like a project spot: ring
    // lifts, camera frames the board. project:null marks it as the guest
    // circle (main.js shows "Sign the wall" instead of "See details").
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.55 });
    const ringGeo = new THREE.RingGeometry(0.42, 0.46, 40); // same as frame rings
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(-2.8, 0.015, -11.8);
    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.set(-2.8, 0.025, -11.8);
    room.add(ring, ring2);
    // spots is initialized in buildFrames (after buildRoom) — lazy-init here
    (this.spots ??= []).push({
      ring, ring2, mat: ringMat,
      center: new THREE.Vector3(-2.8, 0, -11.8),
      normal: new THREE.Vector3(1, 0, 0),
      artPos: new THREE.Vector3(-4.63, 2.6, -11.8),
      project: null, guest: true, h: 2.6, r: 1.0,
    });
  }

  noteTexture(note) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 196;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 196);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 252, 192);
    ctx.fillStyle = '#111';
    ctx.font = '700 26px "Josefin Sans", sans-serif';
    ctx.fillText(String(note.name || 'Guest').slice(0, 18), 14, 36);
    ctx.font = '400 21px "Josefin Sans", sans-serif';
    // wrap the message into rows of ~22 chars
    const words = String(note.msg || '').split(/\s+/).filter(Boolean);
    let row = '', y = 66;
    for (const w of words) {
      if ((row + ' ' + w).length > 22 && row) { ctx.fillText(row, 14, y); y += 26; row = w; }
      else row = row ? row + ' ' + w : w;
      if (y > 128) break;
    }
    if (row && y <= 128) ctx.fillText(row, 14, y);
    ctx.font = '400 17px "Josefin Sans", sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText(String(note.date || '').slice(0, 10), 14, 178);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ANISO;
    return tex;
  }

  renderGuestNotes() {
    if (!this.guestNotesGroup) return;
    for (const child of [...this.guestNotesGroup.children]) {
      this.guestNotesGroup.remove(child);
      child.material.map?.dispose();
      child.material.dispose();
      child.geometry.dispose();
    }
    const shown = this.guestNotes.slice(-6); // latest six pinned
    shown.forEach((note, i) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.69),
        new THREE.MeshBasicMaterial({ map: this.noteTexture(note) })
      );
      const col = i % 3, row = Math.floor(i / 3);
      mesh.position.set(-1.02 + col * 1.02, 0.52 - row * 0.82, 0);
      mesh.rotation.z = (Math.random() - 0.5) * 0.08; // hand-pinned wobble
      this.guestNotesGroup.add(mesh);
    });
    // refresh the board's count line
    const boardTex = this.guestGroup.children[0].material.map;
    if (boardTex) {
      const cv = boardTex.image, bctx = cv.getContext('2d');
      bctx.fillStyle = '#f7f7f7';
      bctx.fillRect(40, 724, 700, 64);
      bctx.fillStyle = '#555';
      bctx.font = '400 30px "Josefin Sans", sans-serif';
      bctx.fillText(`${this.guestNotes.length} note${this.guestNotes.length === 1 ? '' : 's'} pinned`, 68, 770);
      boardTex.needsUpdate = true;
    }
  }

  addGuestNote(note) {
    const clean = {
      name: String(note?.name || 'Guest').trim().slice(0, 24) || 'Guest',
      msg: String(note?.msg || '').trim().slice(0, 140),
      date: new Date().toISOString().slice(0, 10),
    };
    if (!clean.msg) return null;
    this.guestNotes.push(clean);
    this.saveGuestNotes();
    this.renderGuestNotes();
    return clean;
  }

  buildFrames() {
    this.ringGeo = new THREE.RingGeometry(0.42, 0.46, 40);
    const size = 2.2;
    const height = 2.15;
    for (let i = 0; i < 4; i++) {
      this.addFrame(this.projects[i * 2], -4.57, height, 4.5 - i * 4.4, Math.PI / 2, size);
      this.addFrame(this.projects[i * 2 + 1], 4.57, height, 4.5 - i * 4.4, -Math.PI / 2, size);
    }
  }

  addFrame(p, x, y, z, ry, h, opts = {}) {
    if (!p) return;
    const w = h * 0.74;
    const matMarginV = 0.22;
    const artH = h - matMarginV * 2;
    const artW = artH * 0.74;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = ry;
    const frameRim = 0.05;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w + frameRim * 2, h + frameRim * 2, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.45 })
    );
    frame.castShadow = true;
    const mat = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    mat.position.z = 0.041;
    const cover = new THREE.CanvasTexture(isPhone ? makeCoverTexture(p, 640, 875) : makeCoverTexture(p));
    cover.colorSpace = THREE.SRGBColorSpace;
    cover.anisotropy = ANISO;
    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(artW, artH),
      new THREE.ShaderMaterial({
        vertexShader: dissolveVert, fragmentShader: dissolveFrag,
        uniforms: {
          u_tex: { value: cover }, u_next: { value: cover }, u_noise: { value: this.noise },
          u_progress: { value: 1 },
        },
      })
    );
    art.position.z = 0.045;
    art.userData.project = p;
    group.add(frame, mat, art);
    // museum plaque: title + year on a small dark plate below the frame
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.24),
      new THREE.MeshBasicMaterial({ map: makePlaque(p), transparent: false })
    );
    plaque.position.set(0, -h / 2 - 0.25, 0.045);
    group.add(plaque);
    this.hallGroup.add(group);
    this.frames.push({ group, art, plaque, project: p, h, hall: this.hallName });
    // Standing circle for this frame — the viewing spots: one ring per
    // artwork, camera dollies in while the visitor stands on it. Home spots
    // sit 1.8 off the wall; the /gallery circles sit right on the rail.
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion).setY(0).normalize();
    const centerLocal = group.position.clone().addScaledVector(normal, opts.circleDist ?? 1.8);
    centerLocal.y = 0;
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.55 });
    const ring = new THREE.Mesh(this.ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(centerLocal.x, 0.015, centerLocal.z);
    this.hallGroup.add(ring);
    // second ring — thes lifts it 0.1 when you stand on the spot
    const ring2 = new THREE.Mesh(this.ringGeo, ringMat);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.set(centerLocal.x, 0.025, centerLocal.z);
    this.hallGroup.add(ring2);
    const artPos = new THREE.Vector3();
    art.getWorldPosition(artPos);
    // detection/door math runs in world space — the long hall sits at x+200
    const center = centerLocal.clone();
    center.x += this.hallGroup.position.x;
    this.spots.push({ ring, ring2, mat: ringMat, center, normal, artPos, project: p, h, hall: this.hallName, r: opts.radius });
  }

  setFocusMode(active, currentFrame) {
    this.isFocus = active;
    for (const f of this.frames) {
      const isCurrent = f === currentFrame || (currentFrame && f.project?.uid === currentFrame.project?.uid);
      f.group.visible = !active || isCurrent;
      if (f.plaque) f.plaque.visible = !active;
    }
    for (const w of this.wayfinding ?? []) w.visible = !active;
    if (this.descMesh) this.descMesh.visible = !active;
    if (this.guestGroup) this.guestGroup.visible = !active;
    if (this.railGroup) this.railGroup.visible = !active;
    if (this.railMats) this.railMats.forEach((m) => { m.opacity = active ? 0 : 1; });
  }

  buildRailings() {
    this.railGroup = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, transparent: true });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, transparent: true });
    this.railMats = [postMat, railMat];
    for (const side of [-1, 1]) {
      const x = side * 3.4;
      for (let z = 8; z >= -13; z -= 1.6) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.85, 10), postMat);
        post.position.set(x, 0.42, z);
        post.castShadow = true;
        this.railGroup.add(post);
      }
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 21.5, 8), railMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, 0.86, -2.5);
      this.railGroup.add(rail);
    }
    this.hallGroup.add(this.railGroup);
  }

  buildFloorMarkers() {
    // Spots are created per-frame in addFrame; nothing scattered.
    this.buildDust();
  }

  buildDust() {
    // dust motes drifting in the light — one Points cloud, animated on tick
    const N = isPhone ? 120 : 260;
    const pos = new Float32Array(N * 3);
    this.dustSeed = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = Math.random() * 5;
      pos[i * 3 + 2] = 8 - Math.random() * 21;
      this.dustSeed[i * 2] = Math.random() * 7;
      this.dustSeed[i * 2 + 1] = 0.3 + Math.random() * 0.9;
    }
    this.dustGeo = new THREE.BufferGeometry();
    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.dustBase = pos.slice();
    this.dust = new THREE.Points(this.dustGeo, new THREE.PointsMaterial({
      color: 0x777777, size: 0.022, transparent: true, opacity: 0.55, depthWrite: false,
    }));
    this.hallGroup.add(this.dust);
  }

  updateDust(t) {
    if (!this.dust) return;
    const pos = this.dustGeo.attributes.position.array;
    const base = this.dustBase, seed = this.dustSeed;
    const n = seed.length / 2;
    for (let i = 0; i < n; i++) {
      const ph = seed[i * 2], sp = seed[i * 2 + 1];
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.24 * sp + ph) * 0.35;
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.16 * sp + ph * 1.7) * 0.45;
    }
    this.dustGeo.attributes.position.needsUpdate = true;
  }

  buildLongHall() {
    // The /gallery page, at our world scale: one long wall, all frames in
    // a single row on it (x = start + i*spacing, heights staggered two-row),
    // character locked to the rail z=0, wayfinding panels at both ends,
    // exits at either end of the walk bound. size = n*spacing + 12 (thes:
    // articles*1.2 + 12). Lives at x+200 — fog hides it from the home hall.
    this.hallName = 'long';
    this.offset = 200;
    const n = this.projects.length;
    const spacing = 2.9;
    this.longSize = n * spacing + 12;
    // walk bound in WORLD x (the character walks scene coordinates)
    this.exitX = this.offset + (this.longSize - 10.6 + 1.5);
    this.railMin = this.offset - 1.5;
    this.entryX = this.offset;
    const g = this.longGroup = new THREE.Group();
    g.position.x = this.offset;
    this.hallGroup = g;
    const len = 4 + this.longSize + 8;
    const cx = this.longSize * 0.5 - 2; // the roomGroup centering
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(len, 11),
      new THREE.MeshStandardMaterial({ map: grainTexture('#e9e9e9', [10, 3]), roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, 0);
    floor.receiveShadow = true;
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(len, 8),
      new THREE.MeshStandardMaterial({ map: grainTexture('#f6f6f6', [13, 2.4]), roughness: 1 })
    );
    wall.position.set(cx, 3.5, -1.2);
    wall.receiveShadow = true;
    g.add(floor, wall);
    const size = 2.2;
    for (let i = 0; i < n; i++) {
      const y = 2.15;
      this.addFrame(this.projects[i], 1.5 + i * spacing, y, -1.2, 0, size, {
        circleDist: 1.2,  // circle lands on the rail itself (thes z+=0.5)
        radius: 0.62,     // the 0.25 trigger, scaled to our world
      });
    }
    // wayfinding panels: thes are panneau_homeL/galerieR at the start,
    // panneau_homeR/galerieL at the far end — text + elbow arrows drawn
    // straight onto the wall (transparent canvas, no card)
    const panel = (title, sub, x) => {
      const tex = textCanvas([], { w: 640, h: 640, title, sub, titlePx: 120, subPx: 90, noBg: true });
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1.05, 1.05),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: 0x666666 })
      );
      m.position.set(x, 2.0, -1.14);
      g.add(m);
    };
    panel('Home', '←', -1.55);
    panel('Projects', '→', -0.25);
    panel('Home', '←', this.longSize - 10.6 + 0.35);
    this.scene.add(g);
  }

  setHall(name) {
    this.hall = name;
    if (this.homeGroup) this.homeGroup.visible = name === 'home';
    if (this.longGroup) this.longGroup.visible = name === 'long';
  }

  frameFor(uid, hall = this.hall || 'home') {
    return this.frames.find((f) => f.project.uid === uid && f.hall === hall) || null;
  }

  spotFor(uid, hall) {
    // circle center (world) for a frame — longSpotX generalized
    const s = this.spots.find((s) => s.project?.uid === uid && s.hall === hall);
    return s ? s.center : null;
  }

  longSpotX(uid) {
    // world x so the character teleports straight onto its circle
    return this.spotFor(uid, 'long')?.x ?? null;
  }

  setSpotOpen(spot, open) {
    // the dc: standing on a ring lifts its twin ring 0.1 up over .5s
    if (!spot || !spot.ring2) return;
    gsap.to(spot.ring2.position, {
      y: open ? 0.115 : 0.025, duration: 0.5, ease: 'sine.inOut', overwrite: true,
    });
  }

  setNight(on) {
    // N key — moonlit museum: art panels stay bright, walls fall to dark.
    // Everything cross-fades so the switch reads as late-evening light, not a swap.
    this.nightTweens?.forEach((t) => t.kill());
    this.nightTweens = [];
    const tw = (obj, to) => this.nightTweens.push(gsap.to(obj, { ...to, duration: 1.2, ease: 'power2.inOut', overwrite: true }));
    const col = (c, hex) => { const v = new THREE.Color(hex); tw(c, { r: v.r, g: v.g, b: v.b }); };
    col(this.scene.background, on ? 0x0d0d0d : 0xf2f2f2);
    col(this.scene.fog.color, on ? 0x050505 : 0xe4e4e4);
    tw(this.scene.fog, { near: on ? 26 : 18, far: on ? 62 : 44 });
    tw(this.lights.hemi, { intensity: on ? 0.06 * this.dim : this.baseHemi });
    tw(this.lights.key, { intensity: on ? 0.22 * this.dim : this.baseKey });
    for (const s of this.lights.spots) tw(s, { intensity: on ? 3.2 : this.baseSpot });
    col(this.ceilMat.color, on ? 0x161616 : 0xf2f2f2);
    if (this.dust) {
      tw(this.dust.material, { opacity: on ? 0.95 : 0.55, size: on ? 0.03 : 0.022 });
      col(this.dust.material.color, on ? 0xdddddd : 0x777777);
    }
    for (const sp of this.spots) col(sp.mat.color, on ? 0x999999 : 0x222222);
  }

  setTexture(art, canvas) {
    const u = art.material.uniforms;
    const prevTex = u.u_tex.value;
    const prevNext = u.u_next.value;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ANISO;
    u.u_next.value = tex;
    // the paging wipe: 0→1 over 2s, texture promotes to u_tex on complete.
    // dispose the superseded textures — repeated paging used to leak GPU
    // memory on every page turn (brutal on a phone).
    gsap.fromTo(u.u_progress, { value: 0 }, {
      value: 1, duration: 2,
      onComplete: () => {
        u.u_tex.value = tex;
        if (prevTex && prevTex !== prevNext) prevTex.dispose();
        if (prevNext && prevNext !== tex) prevNext.dispose();
      },
    });
  }
}
