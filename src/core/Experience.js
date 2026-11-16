import * as THREE from 'three';
import { isPhone } from './device.js';

let instance = null;

export class Experience {
  constructor(canvas) {
    if (instance) return instance;
    instance = this;
    this.canvas = canvas;
    this.isTouch = isPhone;
    if (this.isTouch) document.body.classList.add('touch');

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 12, 34);

    this.camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100); // the flat 35
    this.camera.position.set(0, 1.6, 8);

    // the renderer: ACESFilmic + exposure 1.75, high-performance, AA, shadows
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.75;
    this.renderer.setClearColor(0x000000);
    this.renderer.setSize(innerWidth, innerHeight);
    // phones: cap DPR to 1.5 (~44% fewer fragments than DPR2) — the single
    // biggest GPU saving on a DPR3 screen with ACES + 6 lights + soft shadows
    this.maxDpr = this.isTouch ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.maxDpr));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.clock = new THREE.Clock();
    this.time = { delta: 0, elapsed: 0 };
    this.listeners = [];

    addEventListener('resize', () => this.resize());
  }

  static get() {
    return instance;
  }

  onTick(fn) {
    this.listeners.push(fn);
  }

  resize() {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.maxDpr));
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  start() {
    this._running = true;
    this._loop = () => {
      const d = this.clock.getDelta();
      this.time.delta = Math.min(d, 0.05);
      this.time.elapsed += this.time.delta;
      for (const fn of this.listeners) fn(this.time);
      this.renderer.render(this.scene, this.camera);
    };
    this.renderer.setAnimationLoop(this._loop);
    requestAnimationFrame(() => this.canvas.classList.add('ready'));
  }

  // pause the GL loop when the menu covers the canvas or the tab is hidden
  pause() {
    if (!this._running) return;
    this._running = false;
    this.renderer.setAnimationLoop(null);
    this.clock.stop();
  }

  resume() {
    if (this._running) return;
    this._running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(this._loop);
  }
}
