import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ------------------------------------------------------------------
 * Character controller — genuine ink-scribble 3D model & mechanics
 * Loaded from /models/personnage_opti.glb (Three r158):
 *   velocity       = isTouch ? 1.5 : 1          (× WORLD_SCALE, see below)
 *   material       = MeshBasicMaterial({color:0x000000}) — pure ink silhouette
 *   scale          = 0.22 (calibrated for our gallery dimensions)
 *   anims          = coucou (hi wave), wait (idle stay), walk
 *   walk clip      = 1.375 s, timeScale = 5     → cycle = 0.275 s
 *   footprints     = cycle % ≥ 9.4 (left) / 56 (right), wrap resets flags
 *   footprint fade = u_progress 0→1, 3 s, power4.inout, then dispose
 *   turn           = quaternion.rotateTowards(target, .15 / frame)
 *   move           = camera-relative, pos -= camDir(rotated by offset) * v * dt
 *   blend          = crossfade .2 s
 *   moveTo         = gsap power1.inOut, controls locked meanwhile
 * ------------------------------------------------------------------ */

const WORLD_SCALE = 2.57;
const WALK_DUR = 1.375;      // s, their walk clip
const WALK_RATE = 5;         // their walkAction.timeScale
const PRINT_L = 9.4;         // % — their footprintFrames
const PRINT_R = 56;          // %
const FADE = 0.2;            // their fadeDuration

function soleTexture() {
  // black ink blots on transparency (footprint ink stamp)
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = '#000';
  for (let i = 0; i < 30; i++) {
    const x = 32 + (Math.random() - 0.5) * 30;
    const y = 32 + (Math.random() - 0.5) * 30;
    g.beginPath();
    g.ellipse(x, y, 3 + Math.random() * 6, 2 + Math.random() * 5, Math.random() * 3, 0, 7);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class Character {
  constructor(scene, camera, opts = {}) {
    this.scene = scene;
    this.camera = camera;
    this.onSelect = opts.onSelect || (() => {});
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    // their turn rate: rotateTowards(.15 desktop / .8 phone) per frame
    this.turnRate = (this.isTouch ? 0.8 : 0.15) * 60;
    this.velocity = (this.isTouch ? 1.5 : 1) * WORLD_SCALE;
    this.bounds = { xMin: -2.9, xMax: 2.9, zMin: -12.5, zMax: 7 };

    this.enabled = true;          // controls enabled
    this.isMoving = false;        // scripted moveTo
    this.focusMode = false;       // artwork focus
    this.directionPressed = false;
    this.keyPressed = {};
    this.currentAction = 'stay';  // stay | walk | hi
    this.walkDuration = WALK_DUR;
    this.printsDone = { left: false, right: false };
    this.lastProgress = 0;
    this.openSpot = null;         // standing circle in range
    this.activeSpot = null;       // spot whose twin ring is currently lifted
    this.onExit = null;           // walk-through door callback
    this.exitPending = false;
    this.exitCheck = null;        // door zones per route
    this.railMode = false;        // /projects gallery rail camera
    this.lead = 0;                // camera lead in walk direction
    this.walkSign = 1;
    this.snapCam = false;         // snap camera under ink
    this.railT = 1;

    this.walkDir = new THREE.Vector3();
    this.rotateAngle = new THREE.Vector3(0, 1, 0);
    this.rotateQuaternion = new THREE.Quaternion();
    this.directions = ['keyw', 'keya', 'keys', 'keyd', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'];

    document.addEventListener('keydown', (e) => { this.keyPressed[e.code.toLowerCase()] = true; }, false);
    document.addEventListener('keyup', (e) => { this.keyPressed[e.code.toLowerCase()] = false; }, false);
    addEventListener('pointerdown', (e) => this.handleClick(e));

    this.baseScale = 0.22;
    this.root = new THREE.Group();
    this.root.scale.setScalar(this.baseScale);
    this.root.position.set(0, 0, 5.5);
    scene.add(this.root);

    this.blob = this.buildBlob();
    scene.add(this.blob);

    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.prints = [];
    this.soleL = soleTexture();
    this.soleR = soleTexture();

    this.target = new THREE.Vector3(0, 1.2, 4);
    this.camPos = new THREE.Vector3(0, 2.0, 9.5);
    this.joy = { active: false, dx: 0, dz: 0, angle: 0, distance: 0 };
    this.buildJoystick();

    this.actions = {};
    this.mixer = null;
    this.loadPromise = this.loadModel('/models/personnage_opti.glb');
  }

  async init() {
    await this.loadPromise;
    return this;
  }

  loadModel(url) {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          this.setupModel(gltf);
          resolve();
        },
        undefined,
        (err) => {
          console.warn('Could not load personnage GLB:', err);
          resolve();
        }
      );
    });
  }

  setupModel(gltf) {
    this.personnage = gltf.scene;
    this.personnageAnimations = gltf.animations;
    this.personnageMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    this.personnage.traverse((child) => {
      if (child.isMesh) {
        child.material = this.personnageMaterial;
        child.castShadow = true;
      }
    });

    this.footL = this.personnage.getObjectByName('footL') || this.personnage.getObjectByName('pied_L');
    this.footR = this.personnage.getObjectByName('footR') || this.personnage.getObjectByName('pied_R');

    this.mixer = new THREE.AnimationMixer(this.personnage);
    this.actions = {};

    for (const clip of this.personnageAnimations) {
      const action = this.mixer.clipAction(clip);
      if (clip.name === 'walk') {
        action.timeScale = WALK_RATE * (this.isTouch ? 1.5 : 1);
        this.walkDuration = clip.duration;
      } else if (clip.name === 'coucou') {
        action.timeScale = 5;
        action.loop = THREE.LoopOnce;
        action.clampWhenFinished = false;
      } else if (clip.name === 'wait') {
        action.timeScale = 1;
      }
      this.actions[clip.name] = action;
    }

    // Aliases
    this.actions.stay = this.actions.wait;
    this.actions.hi = this.actions.coucou;

    if (this.actions.stay) {
      this.actions.stay.play();
      this.currentAction = 'stay';
    }

    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.actions.coucou) {
        this.playAnimation('stay');
      }
    });

    this.root.add(this.personnage);
  }

  playAnimation(name) {
    if (!this.mixer) return;
    const clipKey = name === 'stay' ? 'wait' : name === 'hi' ? 'coucou' : name;
    if (this.currentAction === clipKey) return;

    const prevAction = this.actions[this.currentAction];
    const nextAction = this.actions[clipKey];

    if (nextAction) {
      if (prevAction) prevAction.fadeOut(FADE);
      nextAction.reset().fadeIn(FADE).play();
    }
    this.currentAction = clipKey;
  }

  sayHi() {
    this.playAnimation('hi');
  }

  buildBlob() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0,0,0,0.38)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    return m;
  }

  buildJoystick() {
    const wrap = document.getElementById('joystick');
    if (!wrap) return;
    wrap.innerHTML = `<div class="joy-base" id="joyBase"><div class="joy-knob" id="joyKnob"></div></div>`;
    const base = document.getElementById('joyBase');
    const knob = document.getElementById('joyKnob');
    let id = null;
    base.addEventListener('pointerdown', (e) => { id = e.pointerId; base.setPointerCapture(id); });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const r = base.getBoundingClientRect();
      let dx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      let dz = ((e.clientY - r.top) / r.height - 0.5) * 2;
      const d = Math.hypot(dx, dz);
      if (d > 1) { dx /= d; dz /= d; }
      this.joy = { active: true, dx, dz, angle: Math.atan2(dz, dx), distance: Math.min(1, d) };
      knob.style.transform = `translate(${dx * 30}px,${dz * 30}px)`;
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.joy = { active: false, dx: 0, dz: 0, angle: 0, distance: 0 };
      knob.style.transform = 'translate(0,0)';
    };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
  }

  // Verbatim direction table from their directionOffset()
  directionOffset(k) {
    if (this.isTouch && this.joy.distance > 0) return -this.joy.angle + Math.PI * 0.5;
    if (k.keys || k.arrowdown) {
      if (k.keyd || k.arrowright) return Math.PI / 4;
      if (k.keya || k.arrowleft) return -Math.PI / 4;
    } else if (k.keyw || k.arrowup) {
      if (k.keyd || k.arrowright) return Math.PI / 4 + Math.PI / 2;
      if (k.keya || k.arrowleft) return -Math.PI / 4 - Math.PI / 2;
      return Math.PI;
    } else if (k.keyd || k.arrowright) return Math.PI / 2;
    else if (k.keya || k.arrowleft) return -Math.PI / 2;
    return 0;
  }

  handleClick(e) {
    if (!this.enabled) return;
    if (e.target.closest('button,a,input,.menu_text,.article_container')) return;
    this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const arts = [];
    this.scene.traverse((o) => { if (o.isMesh && o.userData.project) arts.push(o); });
    const hit = this.ray.intersectObjects(arts, false)[0];
    if (hit) this.onSelect(hit.object.userData.project);
  }

  setBounds(b) {
    this.bounds = { ...b };
  }

  teleport(x, z) {
    this.root.position.set(x, 0, z);
    this.camera.fov = 35;
    this.camera.updateProjectionMatrix();
    this.lead = 0;
    this.walkSign = 1;
    this.snapCam = true;
  }

  moveTo(pos, dur = 1, done = null) {
    this.enabled = false;
    this.isMoving = true;
    this.playAnimation('walk');
    const dir = new THREE.Vector3().subVectors(pos, this.root.position).normalize();
    this.rotateQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dir.x, dir.z));
    this.root.quaternion.rotateTowards(this.rotateQuaternion, 1);
    gsap.to(this.root.position, {
      x: pos.x, z: pos.z, duration: dur, ease: 'power1.inOut',
      onUpdate: () => {
        const o = new THREE.Vector3().subVectors(pos, this.root.position).normalize();
        this.rotateQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(o.x, o.z));
        this.root.quaternion.rotateTowards(this.rotateQuaternion, 0.2);
      },
      onComplete: () => {
        this.playAnimation('stay');
        this.isMoving = false;
        this.directionPressed = false;
        if (done) done();
      },
    });
  }

  spawnFootprint(side) {
    const foot = side === 'left' ? this.footL : this.footR;
    const wp = new THREE.Vector3();
    if (foot) foot.getWorldPosition(wp);
    else wp.copy(this.root.position);

    const group = new THREE.Group();
    group.position.copy(this.root.position);
    group.rotation.copy(this.root.rotation);
    const mat = new THREE.MeshBasicMaterial({
      map: side === 'left' ? this.soleL : this.soleR,
      transparent: true, depthWrite: false, opacity: 0.9,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), mat);
    mesh.rotation.x = -Math.PI * 0.5;
    mesh.renderOrder = 2;
    mesh.position.set(side === 'left' ? 0.08 : -0.08, 0, 0.03);
    mesh.position.x += wp.x - this.root.position.x;
    mesh.position.z += wp.z - this.root.position.z;
    group.add(mesh);
    group.position.y = 0.03;
    this.scene.add(group);
    const rec = { group, mesh, mat };
    this.prints.push(rec);
    gsap.to(mat, {
      opacity: 0, duration: 3, ease: 'power4.inOut',
      onComplete: () => this.destroyPrint(rec),
    });
  }

  destroyPrint(rec) {
    const i = this.prints.indexOf(rec);
    if (i >= 0) this.prints.splice(i, 1);
    this.scene.remove(rec.group);
    rec.mesh.geometry.dispose();
    rec.mat.dispose();
    gsap.killTweensOf(rec.mat);
  }

  update(dt) {
    if (this.enabled) this.directionPressed = this.directions.some((s) => this.keyPressed[s]);
    if (this.isMoving || this.isFocusWalking) this.directionPressed = true;

    let next = 'stay';
    if (this.directionPressed || (this.joy && this.joy.distance > 0)) {
      next = 'walk';
    } else if (this.currentAction === 'coucou' || this.currentAction === 'hi') {
      next = 'hi';
    }

    if (this.currentAction !== next && next !== 'hi') {
      this.playAnimation(next);
    }

    if (this.currentAction === 'walk' && this.enabled) {
      const s = Math.atan2(
        this.camera.position.x - this.root.position.x,
        this.camera.position.z - this.root.position.z
      );
      const o = this.directionOffset(this.keyPressed);
      this.rotateQuaternion.setFromAxisAngle(this.rotateAngle, s + o);
      this.root.quaternion.rotateTowards(this.rotateQuaternion, Math.min(1, this.turnRate * dt));

      this.camera.getWorldDirection(this.walkDir);
      this.walkDir.y = 0;
      this.walkDir.normalize();
      this.walkDir.applyAxisAngle(this.rotateAngle, o);

      if (this.railMode) {
        this.walkDir.set(
          (this.keyPressed.keyw || this.keyPressed.arrowup) ? -1 :
          (this.keyPressed.keys || this.keyPressed.arrowdown) ? 1 : 0, 0, 0
        );
      }

      this.root.position.x -= this.walkDir.x * this.velocity * dt;
      this.root.position.z -= this.walkDir.z * this.velocity * dt;

      if (Math.abs(this.walkDir.x) > 0.1) this.walkSign = -Math.sign(this.walkDir.x);
      this.root.position.x = THREE.MathUtils.clamp(this.root.position.x, this.bounds.xMin, this.bounds.xMax);
      this.root.position.z = THREE.MathUtils.clamp(this.root.position.z, this.bounds.zMin, this.bounds.zMax);

      // Walk-through doors
      if (this.exitCheck && !this.exitPending) {
        const door = this.exitCheck();
        if (door) {
          this.exitPending = true;
          const over = new THREE.Vector3(
            this.root.position.x + this.walkDir.x * 1.6, 0,
            this.root.position.z + this.walkDir.z * 1.6
          );
          this.moveTo(over, 1.1, () => this.onExit?.(door));
        }
      }

      // Footprints driven by walk animation cycle
      if (this.actions.walk) {
        const progress = (this.actions.walk.time / this.walkDuration) * 100;
        if (progress >= PRINT_L && !this.printsDone.left) {
          this.spawnFootprint('left');
          this.printsDone.left = true;
        }
        if (progress >= PRINT_R && !this.printsDone.right) {
          this.spawnFootprint('right');
          this.printsDone.right = true;
        }
        if (progress < (this.lastProgress || 0)) {
          this.printsDone = { left: false, right: false };
        }
        this.lastProgress = progress;
      }
    }

    if (this.mixer) {
      this.mixer.update(dt);
    }

    const p = this.root.position;
    this.blob.position.set(p.x, this.focusMode ? p.y : 0.02, p.z);
    this.blob.visible = !this.focusMode;
    const bs = this.root.scale.x / this.baseScale;
    this.blob.scale.set(bs, bs, 1);

    // Standing-circle detection
    this.openSpot = null;
    if (this.enabled && !this.focusMode && this.gallery) {
      let best = null, bestD = Infinity;
      for (const sp of this.gallery.spots) {
        const d = Math.hypot(p.x - sp.center.x, p.z - sp.center.z);
        if (d < (sp.r ?? 1.0) && d < bestD) { best = sp; bestD = d; }
      }
      this.openSpot = best;
    }

    const activeSpot = this.openSpot && !this.focusMode ? this.openSpot : null;
    if (activeSpot !== this.activeSpot) {
      if (this.activeSpot) this.gallery?.setSpotOpen(this.activeSpot, false);
      this.activeSpot = activeSpot;
      if (activeSpot) this.gallery?.setSpotOpen(activeSpot, true);
    }

    // Rails fade out while zoomed on artwork
    const railT = (this.openSpot && !this.focusMode) || (this.focusMode && this.focusPos) ? 0 : 1;
    if (this.railT !== railT) {
      this.railT = railT;
      if (this.gallery?.railMats) gsap.to(this.gallery.railMats, { opacity: railT, duration: 0.35, overwrite: true });
    }

    if (this.focusMode && this.focusPos && this.focusN) {
      this.camPos.copy(this.focusPos).addScaledVector(this.focusN, this.isTouch ? 3.7 : 4.05);
      this.camPos.y = this.focusPos.y;
      this.target.copy(this.focusPos);
      this.target.y = this.focusPos.y;
      this.updateFocusPosition();
    } else if (this.openSpot) {
      this.camPos.copy(this.openSpot.artPos).addScaledVector(this.openSpot.normal, this.isTouch ? 4.8 : 5.25);
      this.camPos.y = 2.05;
      this.target.copy(this.openSpot.artPos);
      this.target.y = 2.05;
    } else if (this.railMode) {
      this.lead += (this.walkSign * 3.9 - this.lead) * Math.min(1, dt * 2.5);
      const px = p.x + this.lead;
      this.camPos.set(px, 1.5, 10);
      this.target.set(px, 1.5, -1.2);
    } else {
      this.camPos.set(-p.x * 0.3, p.y + 1.9, p.z + 5.2);
      this.target.set(p.x, p.y + 1.1, p.z - 1.2);
    }

    if (this.snapCam) {
      this.camera.position.copy(this.camPos);
      this._look = this._look || new THREE.Vector3();
      this._look.copy(this.target);
      this.snapCam = false;
    } else {
      this.camera.position.lerp(this.camPos, this.isTouch ? 0.1 : 0.03);
      this._look = this._look || new THREE.Vector3().copy(this.target);
      this._look.lerp(this.target, this.isTouch ? 0.1 : 0.03);
    }
    this.camera.lookAt(this._look);

    const fovT = this.focusMode && this.isTouch ? 50 : 35;
    if (Math.abs(this.camera.fov - fovT) > 0.05) {
      this.camera.fov += (fovT - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }

    if (this.prints.length > 40) this.destroyPrint(this.prints[0]);
  }

  updateFocusPosition() {
    if (!this.focusMode || !this.focusPos || !this.focusN) return;
    const camDist = this.isTouch ? 3.7 : 4.05;
    const D = 3.65;
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const H_half = D * Math.tan(fovRad / 2);
    const W_half = H_half * this.camera.aspect;

    const targetHeight = 0.165 * (2 * H_half);
    const targetScale = targetHeight / 6.6;
    this.root.scale.setScalar(targetScale);

    const camRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), this.focusN).normalize();

    const relY = -H_half * 0.90 + 0.45 * targetScale;
    const targetXRatio = this.camera.aspect < 1 ? 0.80 : 0.87;
    const xRatio = this.focusXRatio ?? targetXRatio;
    const relX = W_half * xRatio;

    const camPos = this.focusPos.clone().addScaledVector(this.focusN, camDist);
    camPos.y = this.focusPos.y;

    const pos = camPos.clone()
      .addScaledVector(this.focusN, -D)
      .addScaledVector(camRight, relX);
    pos.y = camPos.y + relY;

    this.root.position.copy(pos);

    if (!this.isFocusWalking && !this.isFocusTurning) {
      const toCam = camPos.clone().sub(pos).setY(0).normalize();
      this.root.rotation.y = Math.atan2(toCam.x, toCam.z);
    }
  }

  walkIn(options = {}) {
    if (!this.focusMode || !this.focusPos || !this.focusN) return;

    gsap.killTweensOf(this);
    gsap.killTweensOf(this.root.rotation);

    const targetXRatio = this.camera.aspect < 1 ? 0.80 : 0.87;
    const startXRatio = this.camera.aspect < 1 ? 1.45 : 1.35;

    this.focusXRatio = startXRatio;
    this.isFocusWalking = true;
    this.isFocusTurning = false;

    // Face camera-left (the direction of motion: -camRight)
    const camRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), this.focusN).normalize();
    const walkDir = camRight.clone().negate().setY(0).normalize();
    const walkAngle = Math.atan2(walkDir.x, walkDir.z);
    this.root.rotation.y = walkAngle;

    this.playAnimation('walk');
    const walkAction = this.actions.walk;
    if (walkAction) {
      walkAction.enabled = true;
      walkAction.setEffectiveWeight(1);
      walkAction.setEffectiveTimeScale(WALK_RATE * (this.isTouch ? 1.5 : 1));
      walkAction.play();
    }
    this.updateFocusPosition();

    // Compute target camera-facing angle
    const toCam = this.focusN.clone().setY(0).normalize();
    const camAngle = Math.atan2(toCam.x, toCam.z);
    const diff = ((camAngle - walkAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
    const finalAngle = walkAngle + diff;

    const dur = options.duration ?? 1.35;
    const delay = options.delay ?? 0.05;

    gsap.to(this, {
      focusXRatio: targetXRatio,
      duration: dur,
      delay,
      ease: 'power1.out',
      onComplete: () => {
        this.isFocusWalking = false;
        this.isFocusTurning = true;
        this.focusXRatio = targetXRatio;

        // Turn to face the viewer, then idle
        gsap.to(this.root.rotation, {
          y: finalAngle,
          duration: 0.35,
          ease: 'sine.out',
          onComplete: () => {
            this.isFocusTurning = false;
            this.playAnimation('stay');
          },
        });
      },
    });
  }

  focusOn(project, gallery) {
    const f = gallery.frameFor(project.uid)
      || gallery.frames.find((x) => x.project.uid === project.uid);
    if (!f) return;
    this.focusMode = true;
    this.enabled = false;
    this.isMoving = false;
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.root.rotation);
    gsap.killTweensOf(this.root.position);
    gsap.killTweensOf(this.root.scale);

    this.focusPos = new THREE.Vector3();
    f.art.getWorldPosition(this.focusPos);
    this.focusN = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(f.art.getWorldQuaternion(new THREE.Quaternion()))
      .setY(0).normalize();

    this.camera.fov = this.isTouch ? 50 : 35;
    this.camera.updateProjectionMatrix();
    this.snapCam = true;

    // Start off-screen to the right, ready for walkIn
    const startXRatio = this.camera.aspect < 1 ? 1.45 : 1.35;
    this.focusXRatio = startXRatio;
    this.isFocusWalking = false;
    this.isFocusTurning = false;

    const camRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), this.focusN).normalize();
    const walkDir = camRight.clone().negate().setY(0).normalize();
    this.root.rotation.y = Math.atan2(walkDir.x, walkDir.z);

    this.updateFocusPosition();
  }

  release() {
    this.focusMode = false;
    this.focusPos = null;
    this.focusN = null;
    this.isFocusWalking = false;
    this.isFocusTurning = false;
    this.focusXRatio = null;
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.root.rotation);
    gsap.killTweensOf(this.root.position);
    this.blob.visible = true;
    this.root.position.y = 0;
    this.exitPending = !!(this.exitCheck && this.exitCheck());
    if (this.bounds.zMin !== this.bounds.zMax) {
      this.root.position.z = THREE.MathUtils.clamp(this.root.position.z, this.bounds.zMin + 0.5, this.bounds.zMax - 0.5);
    }
    gsap.to(this.root.scale, {
      x: this.baseScale,
      y: this.baseScale,
      z: this.baseScale,
      duration: 0.6,
      ease: 'sine.inOut',
      overwrite: 'auto',
    });
    if (!this.isMoving) this.enabled = true;
    else {
      gsap.killTweensOf(this.root.position);
      this.isMoving = false;
      this.enabled = true;
      this.playAnimation('stay');
    }
  }
}
