import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import * as Three from '../src/vendor/three/three.module.min.js';

// Exercise the real scene builders, projection math and OrbitControls; only the GPU
// renderer is replaced so sizing and camera regressions run without a WebGL context.
const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.matchMedia = () => ({ matches: false });
const frames = new Map();
let frameId = 0;
globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
globalThis.ResizeObserver = class {
  constructor(callback) { this.callback = callback; }
  observe(host) { host.resizeScene = this.callback; }
  disconnect() {}
};
Object.defineProperties(dom.window.HTMLElement.prototype, {
  offsetWidth: { get() { return this.style.display === 'none' ? 0 : [...this.textContent].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 12 : 7), 16); } },
  offsetHeight: { get() { return this.style.display === 'none' ? 0 : 24; } },
});
const renderers = [];
class Renderer {
  constructor(options) { this.options = options; this.domElement = document.createElement('canvas'); this.shadowMap = {}; renderers.push(this); }
  setPixelRatio(value) { this.pixelRatio = value; }
  setClearColor(color, alpha) { this.clearColor = color; this.clearAlpha = alpha; }
  setSize(width, height, updateStyle = true) {
    this.domElement.width = Math.floor(width * this.pixelRatio);
    this.domElement.height = Math.floor(height * this.pixelRatio);
    if (updateStyle) { this.domElement.style.width = `${width}px`; this.domElement.style.height = `${height}px`; }
  }
  render(scene, camera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); this.scene = scene; this.camera = camera; }
  dispose() {}
}
globalThis.sceneTestThree = { ...Three, WebGLRenderer: Renderer };
const source = fs.readFileSync(new URL('../src/core/scene3d.js', import.meta.url), 'utf8')
  .replace("import * as THREE from '../vendor/three/three.module.min.js';", 'const THREE = globalThis.sceneTestThree;')
  .replace("'../vendor/three/OrbitControls.js'", JSON.stringify(new URL('../src/vendor/three/OrbitControls.js', import.meta.url).href));
const { createModelScene, createAgentScene } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
delete globalThis.sceneTestThree;
const sizes = [[500, 190], [800, 350], [1180, 850]];
const agentUnit = { steps: [{ files: ['workspace/notes.md'] }], injected: ['QWEN.md'], outputs: ['output/answer.md'] };
function draw(time = 0) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); }
function hostAt(size) {
  const host = document.createElement('div');
  host.size = size;
  Object.defineProperties(host, { clientWidth: { get: () => host.size[0] }, clientHeight: { get: () => host.size[1] } });
  document.body.append(host);
  return host;
}
function cameraState(renderer) { return [...renderer.camera.position.toArray(), ...renderer.camera.quaternion.toArray()]; }
function assertSameCamera(actual, expected) { actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-7, `camera component ${i} drifted`)); }
function sceneBounds(renderer, host) {
  const points = [];
  renderer.scene.traverseVisible(object => {
    const geometry = object.geometry;
    if (!geometry || (geometry.type === 'PlaneGeometry' && geometry.parameters.width === 120)) return;
    geometry.computeBoundingBox();
    const b = geometry.boundingBox;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      points.push(new Three.Vector3(x, y, z).applyMatrix4(object.matrixWorld).project(renderer.camera));
    }
  });
  for (const label of host.querySelectorAll('.s3-label')) {
    if (label.style.display === 'none') continue;
    const [, x, y] = label.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
    const nx = Number(x) / host.clientWidth * 2 - 1;
    const ny = 1 - Number(y) / host.clientHeight * 2;
    points.push({ x: nx - label.offsetWidth / host.clientWidth, y: ny });
    points.push({ x: nx + label.offsetWidth / host.clientWidth, y: ny + label.offsetHeight / host.clientHeight * 2 });
  }
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  return { minX, maxX, minY, maxY };
}
function assertVisibleAndCentered(renderer, host) {
  const { minX, maxX, minY, maxY } = sceneBounds(renderer, host);
  assert.ok(minX >= -1 && maxX <= 1 && minY >= -1 && maxY <= 1, `clipped bounds ${[minX, maxX, minY, maxY]}`);
  assert.ok(Math.abs((minX + maxX) / 2) < 0.04, `horizontal center shifted: ${[minX, maxX]}`);
  assert.ok(Math.abs((minY + maxY) / 2) < 0.08, `vertical center shifted: ${[minY, maxY]}`);
}

test('scene CSS dimensions stay aligned with host at common display scaling ratios', () => {
  for (const dpr of [1, 1.25, 1.75, 2]) {
    Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
    for (const size of sizes) {
      const host = hostAt(size);
      const scene = createModelScene(host, { compact: true, appearance: 'light', autoRotate: false });
      draw();
      const renderer = renderers.at(-1), canvas = renderer.domElement;
      assert.equal(renderer.clearAlpha, 1, 'Detail scenes retain an opaque background');
      assert.equal(canvas.style.width, '100%');
      assert.equal(canvas.style.height, '100%');
      assert.equal(canvas.width, Math.floor(size[0] * Math.min(dpr, 1.75)));
      assert.equal(canvas.height, Math.floor(size[1] * Math.min(dpr, 1.75)));
      assertVisibleAndCentered(renderer, host);
      assert.ok([...host.querySelectorAll('.s3-label')].some(el => el.textContent === '红队'));
      scene.dispose(); host.remove();
    }
  }
});

test('homepage framing enlarges and shifts the composition right across the arena while retaining the full viewport', () => {
  for (const builder of [createModelScene, createAgentScene]) {
    for (const size of [[712, 378], [1463, 1034]]) {
      const host = hostAt(size);
      for (const [name, value] of Object.entries({ width: '.80', height: '1', x: '.42', y: '.53' })) host.style.setProperty(`--s3-frame-${name}`, value);
      const scene = builder(host, { compact: true, appearance: 'light', autoRotate: false, frameFromCSS: true, transparentBackground: true });
      if (builder === createAgentScene) scene.load(agentUnit);
      draw();
      const renderer = renderers.at(-1), initial = sceneBounds(renderer, host);
      assert.equal(renderer.options.alpha, true, 'Homepage canvas blends with the shared arena background');
      assert.equal(renderer.clearAlpha, 0);
      assert.equal(renderer.camera.aspect, size[0] / size[1], 'Projection uses the entire arena');
      assert.equal(renderer.domElement.style.width, '100%');
      assert.ok(Math.abs((initial.minX + initial.maxX) / 2 - (-.16)) < .05, 'The enlarged composition moves toward the middle of the whole arena');
      assert.ok(initial.minX >= -1 && initial.maxX <= 1 && initial.minY >= -1 && initial.maxY <= 1, 'The initial scene remains fully visible');
      assert.ok(initial.maxX > .35, 'The initial scene extends behind the content overlay');
      assert.ok(initial.maxX - initial.minX > 1.25, 'The composition occupies at least 62.5% of the whole arena width');
      const canvas = renderer.domElement;
      for (let i = 0; i < 10; i += 1) canvas.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: -100, cancelable: true }));
      draw();
      const enlarged = sceneBounds(renderer, host);
      assert.ok(enlarged.maxX > .2, 'Zoomed geometry extends past the original left area, underneath the bubbles');
      assert.ok(enlarged.maxX - enlarged.minX > initial.maxX - initial.minX);
      scene.dispose(); host.remove();
    }
  }
});

test('model reset, agent reload and repeated resizes keep the initial centered view', () => {
  for (const builder of [createModelScene, createAgentScene]) {
    for (const size of sizes) {
      const host = hostAt(size);
      const scene = builder(host, { compact: true, appearance: 'light', autoRotate: false });
      const reset = () => builder === createModelScene ? scene.reset({ target: '靶标', guard: true }) : scene.load(agentUnit);
      reset(); draw();
      const renderer = renderers.at(-1), initial = cameraState(renderer);
      assertVisibleAndCentered(renderer, host);
      assert.ok([...host.querySelectorAll('.s3-label')].some(el => el.textContent === '红队'));
      for (let i = 0; i < 3; i += 1) { reset(); draw(); assertSameCamera(cameraState(renderer), initial); }
      if (builder === createAgentScene) {
        for (let i = 0; i < 3; i += 1) scene.focus('agent', { callout: false });
        assert.equal(host.querySelectorAll('.s3-callout').length, 0, 'Automatic stage focus must not repeat the Agent role label');
        assert.equal([...host.querySelectorAll('.s3-label')].filter(el => el.textContent === '智能体').length, 1);
      }
      for (const nextSize of [...sizes, size]) { host.size = nextSize; host.resizeScene(); draw(); assertVisibleAndCentered(renderer, host); }
      assertSameCamera(cameraState(renderer), initial);
      scene.dispose(); host.remove();
    }
  }
});

test('configured blue-team positions stay distinct and blocked output never flows back to the red team', async () => {
  const host = hostAt([1180, 850]);
  const scene = createModelScene(host, { compact: true, appearance: 'light', autoRotate: false });
  draw(100);
  const renderer = renderers.at(-1);
  const get = name => renderer.scene.getObjectByName(name);
  const visibleLabels = () => [...host.querySelectorAll('.s3-label')].filter(el => el.style.display !== 'none').map(el => el.textContent);
  try {
    for (const positions of [[], ['输入'], ['输出'], ['输入', '输出']]) {
      scene.reset({ target: 'Qwen-Flash', guard: positions });
      assert.equal(get('blue-team-input').visible, positions.includes('输入'));
      assert.equal(get('blue-team-output').visible, positions.includes('输出'));
      assert.equal(get('input-attack').visible, positions.includes('输入'));
      assert.equal(get('output-response').visible, positions.includes('输出'));
      assert.equal(get('direct-attack').visible, !positions.includes('输入'));
      assert.equal(get('direct-response').visible, !positions.includes('输出'));
      assert.equal(visibleLabels().includes('蓝队 · 输入'), positions.includes('输入'));
      assert.equal(visibleLabels().includes('蓝队 · 输出'), positions.includes('输出'));
      assert.ok(get('blue-team-input').position.z < 0 && get('blue-team-output').position.z < 0, 'The two guard roles are offset behind the main row');
    }
    const particleHeads = () => {
      const found = [];
      renderer.scene.traverseVisible(node => { if (node.geometry?.type === 'SphereGeometry' && node.geometry.parameters.radius === .13) found.push(node); });
      return found;
    };
    let time = 100;
    const advance = milliseconds => { for (let i = 0; i < milliseconds / 100; i += 1) { time += 100; draw(time); } };
    const blocked = scene.reply(true);
    advance(800);
    await blocked;
    assert.equal(particleHeads().length, 0, 'A blocked output stops at the output guard');
    const allowed = scene.reply(false);
    advance(800);
    assert.equal(particleHeads().length, 1, 'An allowed output continues from the output guard toward the red team');
    advance(1400);
    await allowed;
    assert.equal(particleHeads().length, 0);
    const inputBlocked = scene.attack(true);
    advance(900);
    await inputBlocked;
    assert.equal(particleHeads().length, 0, 'A blocked input stops before reaching the target');
  } finally { scene.dispose(); host.remove(); }
});
