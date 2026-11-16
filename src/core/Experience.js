import * as THREE from 'three';

let instance = null;

export class Experience {
  constructor(canvas) {
    if (instance) return instance;
    instance = this;
    this.canvas = canvas;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (this.isTouch) document.body.classList.add('touch');

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 12, 34);

    this.camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100); // their flat 35
    this.camera.position.set(0, 1.6, 8);

    // their renderer: ACESFilmic + exposure 1.75, high-performance, AA, shadows
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.75;
    this.renderer.setClearColor(0x000000);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  start() {
    this.renderer.setAnimationLoop(() => {
      const d = this.clock.getDelta();
      this.time.delta = Math.min(d, 0.05);
      this.time.elapsed += this.time.delta;
      for (const fn of this.listeners) fn(this.time);
      this.renderer.render(this.scene, this.camera);
    });
    requestAnimationFrame(() => this.canvas.classList.add('ready'));
  }
}
