/* 首页演练看板的 3D 场景（Three.js，本地 vendor，按需动态加载）。
 * 两个场景共用一套底座与交互；首页与详情页均可选浅色外观。
 *   createModelScene：红队 → 蓝队闸门 → 靶标 → 裁判 的立体链路，按回放事件发射粒子。
 *   createAgentScene：智能体塔 + 工作区文件块（普通 / 机密 / 注入）+ 对外产出区，按执行步点亮。
 * 节点标签用 HTML 覆盖层，随相机投影定位。宿主节点离开文档后自动释放 GPU 资源。 */
import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';

export const C = {
  red: 0xff6e66, blue: 0x56b6ff, purple: 0xb58aff, cyan: 0x5de0d0,
  amber: 0xf2a33a, green: 0x34d399, slate: 0x3d536d, body: 0x2b435d, base: 0x16283d,
};
const LIGHT_COLORS = {
  red: 0xc96260, blue: 0x3979be, purple: 0x7a78b1, cyan: 0x4798aa,
  amber: 0xb68c47, green: 0x539b87, slate: 0xaebfd2, body: 0xdce6ef, base: 0xd7e3ef,
};
const LIGHT_THEME = {
  light: true, bg: 0xffffff, base: 0xd7e3ef, top: 0xf3f8fc, grid: 0xa5bad0, edge: 0x8caeca,
  sky: 0xffffff, ground: 0xcbd8e6, sun: 0xffffff, body: 0xdce6ef, slate: 0xaebfd2, foot: 0xc5d5e5, line: 0x7f9bb5,
};
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 两套场景配色对比拉开：模型演练「青蓝机房」，Agent 演练「品红紫」。
 * 两者色相相隔约 180°，底色与网格饱和度抬高，一眼能分。 */
export const THEMES = {
  model: {
    bg: 0x071a2e, base: 0x0f3350, top: 0x124060, grid: 0x2f7fb8, edge: 0x45b6e8, hill: 0x123a52,
    sky: 0xc8ecff, ground: 0x08182a, sun: 0xd6efff, body: 0x1b4668, slate: 0x2a5c7e, foot: 0x0a2740, line: 0x62b4df,
  },
  agent: {
    bg: 0x1a0722, base: 0x3c1346, top: 0x471852, grid: 0x8a3f92, edge: 0xab57ad, hill: 0x2c0f36,
    sky: 0xe8c8ef, ground: 0x140620, sun: 0xeccaf0, body: 0x421650, slate: 0x5c2466, foot: 0x280c30, line: 0xa868ab,
  },
};

/* ---------------------------------------------------------------- 底座 */
function stage(host, { size = [22, 14], camPos = [11, 15, 19], theme = 'model', lift = 0, compact = false, autoRotate = true, appearance = 'default', frameFromCSS = false, transparentBackground = false } = {}) {
  const light = appearance === 'light';
  const T = light ? LIGHT_THEME : THEMES[theme];
  const colors = light ? LIGHT_COLORS : C;
  host.classList.toggle('s3-light', light);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparentBackground });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(T.bg, transparentBackground ? 0 : 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = light;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Keep CSS pixels aligned with the host and HTML labels at every device pixel ratio.
  // setSize(..., false) below only changes the higher-resolution drawing buffer.
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.userData.lightAppearance = light;
  if (!light) scene.fog = new THREE.Fog(T.bg, 30, 62);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
  // Detail canvases start front-on; the homepage retains its orbiting view.
  camera.position.set(...(light && compact ? [0, 8.5, 24] : camPos));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 14;
  controls.maxDistance = 42;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = Math.PI / 2.3;
  controls.target.set(0, light || compact ? 1.35 : -0.6, 0);
  controls.autoRotate = autoRotate && !reduced();
  controls.autoRotateSpeed = 0.45;
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end', () => { setTimeout(() => { if (!disposed) controls.autoRotate = autoRotate && !reduced(); }, 4000); });

  scene.add(new THREE.HemisphereLight(T.sky, T.ground, light ? 1.8 : 2.2));
  const sun = new THREE.DirectionalLight(T.sun, light ? 2.2 : 2.6);
  sun.position.set(-10, 18, 10);
  if (light) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 });
    sun.shadow.normalBias = 0.04;
    sun.shadow.bias = -0.0002;
  }
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);
  const [W, D] = size;
  if (light) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.08 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.94;
    floor.receiveShadow = true;
    world.add(floor);
  }
  box(world, W, 0.8, D, T.base, 0, -0.5, 0);
  box(world, W - 0.2, 0.06, D - 0.2, T.top, 0, -0.08, 0);
  const grid = new THREE.Group();
  for (let x = -W / 2 + 1; x < W / 2; x += 1) line(grid, [[x, -0.03, -D / 2 + 0.2], [x, -0.03, D / 2 - 0.2]], T.grid, 0.28);
  for (let z = -D / 2 + 1; z < D / 2; z += 1) line(grid, [[-W / 2 + 0.2, -0.03, z], [W / 2 - 0.2, -0.03, z]], T.grid, 0.28);
  world.add(grid);
  for (const z of [-D / 2 - 0.15, D / 2 + 0.15]) line(world, [[-W / 2 - 0.2, -0.38, z], [W / 2 + 0.2, -0.38, z]], T.edge, light ? 0.45 : 0.8);

  const dyn = new THREE.Group();
  scene.add(dyn);
  const tickers = new Set();
  const labelEls = [];
  let disposed = false, frame = 0, last = 0;

  // Fit real geometry instead of an empty high box above the entire platform.
  // The latter makes short detail canvases needlessly zoom out.
  function detailFitPoints() {
    const points = [];
    for (const x of [-W / 2 - 0.2, W / 2 + 0.2]) {
      for (const y of [-0.9, 0]) {
        for (const z of [-D / 2 - 0.2, D / 2 + 0.2]) points.push({ point: new THREE.Vector3(x, y, z) });
      }
    }
    dyn.updateMatrixWorld(true);
    dyn.traverse((object) => {
      const geometry = object.geometry;
      if (!geometry) return;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;
      for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
          for (const z of [bounds.min.z, bounds.max.z]) {
            points.push({ point: new THREE.Vector3(x, y, z).applyMatrix4(object.matrixWorld) });
          }
        }
      }
    });
    for (const label of labelEls) {
      if (!label.clamp) points.push({ point: label.anchor.clone(), width: label.el.offsetWidth, height: label.el.offsetHeight });
    }
    return points;
  }
  function fitCamera(w, h) {
    camera.fov = 38;
    camera.clearViewOffset();
    const direction = camera.position.clone().sub(controls.target).normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right);
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let distance = 0;
    if (light && compact) {
      const points = detailFitPoints();
      // Align the visual bounds to the canvas center, including the labels.
      // Refit after the small perspective correction so margins remain safe.
      controls.target.set(0, 1.35, 0);
      for (let pass = 0; pass < 4; pass += 1) {
        distance = 0;
        for (const sample of points) {
          const point = sample.point.clone().sub(controls.target);
          const x = point.dot(right), y = point.dot(up), depth = point.dot(direction);
          const padX = Math.max(0.45, 1 - ((sample.width || 0) + 20) / w);
          const padY = Math.max(0.4, 1 - 2 * (y >= 0 ? (sample.height || 0) + 10 : 10) / h);
          distance = Math.max(distance,
            depth + Math.abs(x) / (tanY * camera.aspect * padX),
            depth + Math.abs(y) / (tanY * padY));
        }
        if (pass === 3) break;
        const projected = points.map(sample => {
          const point = sample.point.clone().sub(controls.target), depth = distance - point.dot(direction);
          return { x: point.dot(right) / (depth * tanY * camera.aspect), y: point.dot(up) / (depth * tanY),
            halfWidth: (sample.width || 0) / w, labelHeight: 2 * (sample.height || 0) / h };
        });
        const centerX = (Math.min(...projected.map(p => p.x - p.halfWidth)) + Math.max(...projected.map(p => p.x + p.halfWidth))) / 2;
        const centerY = (Math.min(...projected.map(p => p.y)) + Math.max(...projected.map(p => p.y + p.labelHeight))) / 2;
        controls.target.addScaledVector(right, centerX * distance * tanY * camera.aspect).addScaledVector(up, centerY * distance * tanY);
      }
    } else {
      const padX = Math.max(0.7, 1 - 36 / w), padY = Math.max(0.72, 1 - 42 / h);
      for (const x of [-W / 2 - 0.5, W / 2 + 0.5]) {
        for (const y of [-1, 6.3]) {
          for (const z of [-D / 2 - 0.5, D / 2 + 0.5]) {
            const point = new THREE.Vector3(x, y, z).sub(controls.target);
            const depth = point.dot(direction);
            distance = Math.max(distance,
              depth + Math.abs(point.dot(right)) / (tanY * camera.aspect * padX),
              depth + Math.abs(point.dot(up)) / (tanY * padY));
          }
        }
      }
    }
    controls.minDistance = distance * 0.6;
    controls.maxDistance = distance * 1.8;
    camera.far = Math.max(120, distance * 3);
    camera.position.copy(controls.target).addScaledVector(direction, distance);
    controls.update();
  }

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (light || compact) {
      // Fit into a reserved composition area while retaining a full-size
      // renderer. Camera view offsets shift the initial composition without
      // clipping geometry at the edge of that area when the user zooms in.
      const style = frameFromCSS ? window.getComputedStyle(host) : null;
      const frameValue = (name, fallback) => {
        const value = Number.parseFloat(style?.getPropertyValue(`--s3-frame-${name}`));
        return Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0.1, 1) : fallback;
      };
      const frameW = w * frameValue('width', 1), frameH = h * frameValue('height', 1);
      camera.aspect = frameW / frameH;
      fitCamera(frameW, frameH);
      camera.aspect = w / h;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(38 / 2)) * h / frameH));
      const centerX = frameValue('x', .5), centerY = frameValue('y', .5);
      if (centerX !== .5 || centerY !== .5) camera.setViewOffset(w, h, (.5 - centerX) * w, (.5 - centerY) * h, w, h);
    }
    else {
      camera.fov = w / h < 1.25 ? 50 : w / h < 1.7 ? 42 : 36;
      const k = lift * Math.min(1, Math.max(0.45, (h - 260) / 260));
      if (k) camera.setViewOffset(w, h, 0, h * k, w, h); else camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const v = new THREE.Vector3();
  /* 标签与气泡跟随相机投影；气泡夹在画布内，不被裁掉 */
  function placeLabels() {
    const w = host.clientWidth, h = host.clientHeight;
    for (const l of labelEls) {
      v.copy(l.anchor).project(camera);
      const ok = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
      l.el.style.visibility = ok ? 'visible' : 'hidden';
      let x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      if (l.clamp) {
        const ew = l.el.offsetWidth, eh = l.el.offsetHeight;
        x = Math.min(Math.max(x, ew / 2 + 8), w - ew / 2 - 8);
        y = Math.max(y, eh + 8);
      }
      l.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
  }
  function loop(t) {
    if (disposed) return;
    if (!host.isConnected) { dispose(); return; }
    const dt = last ? Math.min(t - last, 100) / 1000 : 0;
    last = t;
    tickers.forEach((fn) => fn(dt, t / 1000));
    controls.update();
    renderer.render(scene, camera);
    placeLabels();
    frame = requestAnimationFrame(loop);
  }
  frame = requestAnimationFrame(loop);

  function label(text, anchor, cls = '') {
    const el = document.createElement('div');
    el.className = `s3-label ${cls}`;
    el.textContent = text;
    host.appendChild(el);
    const rec = { el, anchor: anchor.clone() };
    labelEls.push(rec);
    return rec;
  }
  /* 气泡：锚在某个 3D 元素上方，显示该元素此刻的输出，ms 后淡出 */
  function callout(anchor, html, cls = '', ms = 2600) {
    const el = document.createElement('div');
    el.className = `s3-callout ${cls}`;
    el.innerHTML = html;
    host.appendChild(el);
    const rec = { el, anchor: anchor.clone(), clamp: true };
    labelEls.push(rec);
    placeLabels();
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.remove(); const i = labelEls.indexOf(rec); if (i >= 0) labelEls.splice(i, 1); }, 300);
    }, ms);
    return rec;
  }
  function flash(rec) {
    if (!rec) return;
    rec.el.classList.remove('on');
    void rec.el.offsetWidth;
    rec.el.classList.add('on');
  }
  function clearDyn() {
    disposeGroup(dyn);
    for (const l of labelEls.splice(0)) l.el.remove();
    tickers.clear();
  }
  function dispose() {
    disposed = true;
    cancelAnimationFrame(frame);
    ro.disconnect();
    controls.dispose();
    clearDyn();
    disposeGroup(scene);
    renderer.dispose();
    renderer.domElement.remove();
    host.classList.remove('s3-light');
  }
  return { T, colors, light, scene, camera, controls, dyn, tickers, label, callout, flash, clearDyn, dispose,
    refit: () => { if (light && compact) resize(); } };
}

/* ---------------------------------------------------------------- 几何工具 */
function mesh(parent, geometry, color, pos, opts = {}) {
  let root = parent;
  while (root.parent) root = root.parent;
  const light = root.userData.lightAppearance;
  const material = { color, roughness: light ? 0.72 : 0.62, metalness: light ? 0.16 : 0.3, ...opts };
  if (light && material.emissiveIntensity) material.emissiveIntensity *= 0.16;
  const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial(material));
  m.castShadow = light && !material.transparent;
  m.receiveShadow = light;
  m.position.set(...pos);
  parent.add(m);
  return m;
}
function box(parent, w, h, d, color, x, y, z, opts) { return mesh(parent, new THREE.BoxGeometry(w, h, d), color, [x, y, z], opts); }
function line(parent, pts, color, opacity = 1) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p))),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  parent.add(l);
  return l;
}
function disposeGroup(g) {
  g.traverse((o) => { o.geometry?.dispose(); if (o.material) [o.material].flat().forEach((m) => m.dispose()); });
  g.clear();
}
const glow = (color, k = 0.7) => ({ emissive: color, emissiveIntensity: k });
const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* 一座带发光层线的楼：底座 + 主体 + 顶檐 + 楼层灯带，返回可改色的发光材质 */
function tower(parent, { x, z, w = 1.2, h = 2.4, d = 1, color, T = THEMES.model }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  parent.add(g);
  box(g, w + 1, 0.14, d + 1, T.foot, 0, 0.07, 0);
  box(g, w + 0.6, 0.12, d + 0.6, T.slate, 0, 0.2, 0);
  const ring = mesh(g, new THREE.TorusGeometry((w + 1.1) / 1.6, 0.03, 6, 56), color, [0, 0.3, 0], glow(color, 0.8));
  ring.rotation.x = Math.PI / 2;
  const body = box(g, w, h, d, T.body, 0, 0.3 + h / 2, 0);
  body.add(new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: T.line })));
  const accents = [];
  accents.push(box(g, w + 0.1, 0.09, d + 0.12, color, 0, 0.3 + h, 0, glow(color)));
  for (let f = 0.6; f < h + 0.1; f += 0.32) {
    accents.push(box(g, w * 0.66, 0.05, 0.02, color, 0, f, d / 2 + 0.005, glow(color, 0.55)));
    accents.push(box(g, 0.02, 0.05, d * 0.66, color, w / 2 + 0.005, f, 0, glow(color, 0.55)));
  }
  const beacon = mesh(g, new THREE.OctahedronGeometry(0.17), color, [0, h + 0.85, 0], glow(color, 1.2));
  box(g, 0.05, 0.5, 0.05, color, 0, h + 0.5, 0, glow(color));
  const top = new THREE.Vector3(x, h + 1.45, z);
  const mid = new THREE.Vector3(x, 0.3 + h * 0.6, z);
  function tint(c, k = 0.9) {
    for (const m of [ring, beacon, ...accents]) { m.material.color.setHex(c); m.material.emissive.setHex(c); m.material.emissiveIntensity = k * (T.light ? 0.16 : 1); }
  }
  return { group: g, ring, beacon, top, mid, tint };
}

/* 机架服务器：内嵌设备槽、双侧立柱、抽拉把手与散热孔共用同一结构。 */
function server(parent, { x, z, w = 1.6, h = 2.6, d = 1.3, color, T = THEMES.model }) {
  const g = new THREE.Group();
  g.name = 'rack-server';
  g.position.set(x, 0, z);
  parent.add(g);
  box(g, w + 0.9, 0.16, d + 0.9, T.foot, 0, 0.08, 0);
  const ring = mesh(g, new THREE.TorusGeometry((w + 0.95) / 1.5, 0.035, 8, 56), color, [0, 0.32, 0], glow(color, 0.8));
  ring.rotation.x = Math.PI / 2;
  const cab = box(g, w, h, d, T.body, 0, 0.32 + h / 2, 0, { roughness: 0.5, metalness: 0.55 });
  cab.add(new THREE.LineSegments(new THREE.EdgesGeometry(cab.geometry), new THREE.LineBasicMaterial({ color: T.line })));
  const accents = [];
  const front = d / 2 + 0.025;
  const recess = T.light ? 0x526579 : T.foot;
  const trayColor = T.light ? 0x91a6b9 : T.slate;
  box(g, w * 0.86, h - 0.18, 0.035, recess, 0, 0.32 + h / 2, front, { roughness: 0.65 });
  for (const sign of [-1, 1]) {
    box(g, w * 0.08, h, 0.13, T.slate, sign * w * 0.46, 0.32 + h / 2, front + 0.025, { metalness: 0.75, roughness: 0.35 });
    for (let j = 0; j < 5; j += 1) box(g, 0.018, h * 0.06, d * 0.5, recess, sign * (w / 2 + 0.012), 0.65 + j * h * 0.15, 0);
  }
  const n = Math.max(3, Math.round(h / 0.52));
  const u = (h - 0.32) / n;
  for (let i = 0; i < n; i += 1) {
    const y = 0.48 + u * (i + 0.5);
    box(g, w * 0.78, u * 0.82, 0.075, trayColor, 0, y, front + 0.04, { roughness: 0.45, metalness: 0.65 });
    for (let k = 0; k < 6; k += 1) box(g, w * 0.025, u * 0.46, 0.018, recess, -w * 0.22 + k * w * 0.065, y, front + 0.085);
    for (const sign of [-1, 1]) box(g, w * 0.035, u * 0.58, 0.09, T.top, sign * w * 0.33, y, front + 0.09, { metalness: 0.75, roughness: 0.3 });
    const led = box(g, 0.045, 0.045, 0.025, color, w * 0.235, y + u * 0.15, front + 0.09, glow(color, 1));
    box(g, 0.045, 0.045, 0.025, T.line, w * 0.235, y - u * 0.15, front + 0.09);
    accents.push(led);
  }
  accents.push(box(g, w * 0.78, 0.04, 0.025, color, 0, 0.32 + h - 0.045, front + 0.08, glow(color)));
  // Flat status beacon avoids a roof/spire silhouette and leaves room for role symbols.
  const beacon = mesh(g, new THREE.CylinderGeometry(0.1, 0.1, 0.045, 16), color, [w * 0.32, 0.32 + h + 0.025, 0], glow(color, 1.3));
  const rackTop = 0.32 + h;
  const top = new THREE.Vector3(x, rackTop + 1.9, z);
  const mid = new THREE.Vector3(x, 0.32 + h * 0.55, z);
  function tint(c, k = 0.9) {
    for (const m of [ring, beacon, ...accents]) { m.material.color.setHex(c); m.material.emissive.setHex(c); m.material.emissiveIntensity = k * (T.light ? 0.16 : 1); }
  }
  return { group: g, ring, beacon, top, mid, rackTop, w, tint };
}

/* Upright role symbols remain legible from the initial camera angle. */
function roleIcon(st, host, kind, color, cx, cy, cz) {
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  host.add(g);
  const opt = glow(color, 1.1);
  if (kind === 'attacker') {
    // A visible target reticle with a diagonal attack arrow.
    mesh(g, new THREE.TorusGeometry(0.46, 0.055, 8, 48), color, [0, 0, 0], opt);
    for (const sign of [-1, 1]) {
      box(g, 0.2, 0.055, 0.08, color, sign * 0.5, 0, 0, opt);
      box(g, 0.055, 0.2, 0.08, color, 0, sign * 0.5, 0, opt);
    }
    const shaft = box(g, 0.085, 0.75, 0.1, color, -0.17, -0.17, 0.11, opt); shaft.rotation.z = -Math.PI / 4;
    const arrow = mesh(g, new THREE.ConeGeometry(0.16, 0.32, 4), color, [0.14, 0.14, 0.11], opt); arrow.rotation.z = -Math.PI / 4;
  } else if (kind === 'target') {
    // 同心靶环竖立在 XY 平面，正对详情页的初始视角。
    for (const r of [0.4, 0.26, 0.12]) mesh(g, new THREE.TorusGeometry(r, 0.035, 8, 40), color, [0, 0, 0], opt);
    mesh(g, new THREE.SphereGeometry(0.06, 10, 8), color, [0, 0, 0], opt);
  } else {
    // Balanced scales make the judge role recognizable without reading its label.
    box(g, 0.09, 1.02, 0.1, color, 0, 0.03, 0, opt);
    box(g, 1.16, 0.075, 0.09, color, 0, 0.39, 0, opt);
    box(g, 0.48, 0.09, 0.3, color, 0, -0.5, 0, opt);
    mesh(g, new THREE.SphereGeometry(0.1, 12, 8), color, [0, 0.57, 0], opt);
    for (const sign of [-1, 1]) {
      const panX = sign * 0.48;
      for (const dx of [-0.17, 0.17]) line(g, [[panX, 0.34, 0], [panX + dx, -0.13, 0]], color, 0.9);
      mesh(g, new THREE.CylinderGeometry(0.23, 0.12, 0.12, 24), color, [panX, -0.18, 0], opt);
    }
  }
  let time = 0;
  st.tickers.add((dt) => { time += dt; g.rotation.y = Math.sin(time * 0.7) * 0.16; g.position.y = cy + Math.sin(time * 1.3) * 0.045; });
  return g;
}

/* 显示器工作站：屏幕 + 支架 + 底座，放在工作区角，点明"工作环境" */
function workstation(parent, { x, z, color, T }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  parent.add(g);
  box(g, 1.7, 1.05, 0.1, T.foot, 0, 0.9, 0, { metalness: 0.5, roughness: 0.4 });
  mesh(g, new THREE.PlaneGeometry(1.5, 0.86), color, [0, 0.9, 0.06], { ...glow(color, 0.5), transparent: true, opacity: 0.6 });
  box(g, 0.14, 0.5, 0.14, T.slate, 0, 0.35, 0);
  box(g, 0.9, 0.08, 0.5, T.slate, 0, 0.1, 0);
  return g;
}

/* 工作区整体：大显示器 + 命令行窗口 + 一排工具图标，合成一个工作站 */
function workbench(st, parent, { x, z, color, T }) {
  const C = st.colors;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  parent.add(g);
  // 主显示器
  box(g, 2.8, 1.8, 0.12, T.foot, 0, 1.6, 0, { metalness: 0.5, roughness: 0.4 });
  const screen = mesh(g, new THREE.PlaneGeometry(2.6, 1.6), color, [0, 1.6, 0.08], { ...glow(color, 0.45), transparent: true, opacity: 0.5 });
  box(g, 0.24, 0.7, 0.24, T.slate, 0, 0.35, 0);
  box(g, 1.5, 0.1, 0.8, T.slate, 0, 0.08, 0);
  // 命令行行（发光短横，模拟终端输出），循环滚动
  const lines = [];
  for (let i = 0; i < 6; i += 1) {
    const w = 0.5 + ((i * 7) % 5) * 0.32;
    lines.push(box(g, w, 0.07, 0.01, color, -1.1 + w / 2, 2.15 - i * 0.2, 0.1, { ...glow(color, 0.7), transparent: true, opacity: 0.75 }));
  }
  let t = 0;
  st.tickers.add((dt) => {
    t += dt;
    if (t > 0.6) { t = 0; const l = lines.shift(); lines.push(l); lines.forEach((ln, i) => { ln.position.y = 2.15 - i * 0.2; ln.material.opacity = 0.35 + (i < 2 ? 0.4 : 0.1); }); }
  });
  // 工具图标：一排悬浮小几何体（齿轮/方括号/终端），象征可用工具
  const toolColors = [C.green, C.amber, color, C.blue];
  [new THREE.TorusGeometry(0.16, 0.05, 6, 12), new THREE.BoxGeometry(0.26, 0.26, 0.08), new THREE.ConeGeometry(0.16, 0.3, 4), new THREE.OctahedronGeometry(0.17)]
    .forEach((geo, i) => { const m = mesh(g, geo, toolColors[i], [-1.1 + i * 0.74, 0.5, 0.75], glow(toolColors[i], 0.9)); st.tickers.add((dt) => { m.rotation.y += dt * 1.1; }); });
  return g;
}

/* 文件卡：竖立的档案卡片（带折角），比方块更像文件 */
function fileCard(parent, { x, z, h = 1.0, color, T }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  parent.add(g);
  const body = box(g, 0.82, h, 0.1, color || T.slate, 0, h / 2, 0, { roughness: 0.7, metalness: 0.2 });
  body.add(new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: T.line, transparent: true, opacity: 0.85 })));
  const fold = mesh(g, new THREE.BufferGeometry(), T.top, [0, 0, 0]); // 折角
  fold.geometry.setAttribute('position', new THREE.Float32BufferAttribute([0.24, h - 0.01, 0.06, 0.41, h - 0.01, 0.06, 0.41, h - 0.18, 0.06], 3));
  fold.material = new THREE.MeshBasicMaterial({ color: T.line, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i += 1) box(g, 0.5, 0.035, 0.02, T.line, -0.08, h * 0.62 - i * 0.18, 0.055, { transparent: true, opacity: 0.6 }); // 文字行
  const cap = box(g, 0.86, 0.06, 0.14, color || T.line, 0, h + 0.02, 0, glow(color || T.line, 0.3));
  return { group: g, body, cap, top: new THREE.Vector3(x, h + 0.1, z), pos: new THREE.Vector3(x, h, z) };
}

/* 文件夹：半开的文件夹，用于机密 / 注入等成组资料 */
function folder(parent, { x, z, color, T }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  parent.add(g);
  const back = box(g, 1.0, 0.72, 0.06, color, 0, 0.42, -0.14, { ...glow(color, 0.45), transparent: true, opacity: 0.92 });
  const front = box(g, 1.0, 0.6, 0.06, color, 0, 0.36, 0.16, { ...glow(color, 0.3), transparent: true, opacity: 0.85 });
  front.rotation.x = 0.26;
  box(g, 0.4, 0.1, 0.06, color, -0.26, 0.78, -0.14, glow(color, 0.5)); // 标签页
  return { group: g, body: back, cap: front, top: new THREE.Vector3(x, 0.95, z), pos: new THREE.Vector3(x, 0.7, z) };
}

/* 双半球轮廓与神经回路：保持大脑形态，避免球形网络的视觉歧义。 */
function brain(st, parent, { x, y, z, color }) {
  const g = new THREE.Group();
  g.name = 'neural-brain';
  g.position.set(x, y, z);
  parent.add(g);
  const emissive = [];
  const nodes = [];
  for (const sign of [-1, 1]) {
    const hemisphere = new THREE.Shape();
    hemisphere.moveTo(0.08, -0.51);
    hemisphere.bezierCurveTo(0.24, -0.71, 0.62, -0.48, 0.62, -0.27);
    hemisphere.bezierCurveTo(0.91, -0.25, 0.92, 0.13, 0.75, 0.25);
    hemisphere.bezierCurveTo(0.85, 0.56, 0.57, 0.74, 0.36, 0.64);
    hemisphere.bezierCurveTo(0.2, 0.82, 0.06, 0.63, 0.08, 0.45);
    hemisphere.lineTo(0.08, -0.51);
    const shell = mesh(g, new THREE.ExtrudeGeometry(hemisphere, { depth: 0.3, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.045, bevelThickness: 0.06, curveSegments: 14 }), color, [0, 0, -0.18], { ...glow(color, 0.45), transparent: true, opacity: st.light ? 0.24 : 0.3, metalness: 0.35 });
    shell.scale.x = sign;
    emissive.push(shell);
    const outlinePoints = hemisphere.getPoints(50).map(p => new THREE.Vector3(p.x * sign, p.y, 0.2));
    const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outlinePoints), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    g.add(outline); emissive.push(outline);
    const pathways = [
      [[0.14,0.43],[0.38,0.46],[0.49,0.28],[0.69,0.26]],
      [[0.14,0.1],[0.34,0.2],[0.47,0.04],[0.7,0.05]],
      [[0.16,-0.29],[0.4,-0.21],[0.42,-0.02]],
      [[0.3,0.52],[0.3,0.21],[0.22,0.08],[0.28,-0.08]],
      [[0.5,-0.35],[0.54,-0.18],[0.7,-0.16]],
    ];
    for (const path of pathways) {
      const points = path.map(([px, py]) => new THREE.Vector3(sign * px, py, 0.22));
      const curve = new THREE.CatmullRomCurve3(points);
      emissive.push(mesh(g, new THREE.TubeGeometry(curve, 18, 0.027, 6, false), color, [0, 0, 0], glow(color, 0.85)));
      for (const p of [points[0], points.at(-1)]) nodes.push(mesh(g, new THREE.SphereGeometry(0.052, 10, 8), color, p.toArray(), glow(color, 1.2)));
    }
  }
  emissive.push(box(g, 0.1, 0.24, 0.14, color, 0, -0.68, 0, glow(color, 0.6)), ...nodes);
  let t = 0;
  st.tickers.add((dt) => {
    t += dt;
    g.rotation.y = Math.sin(t * 0.65) * 0.16;
    g.position.y = y + Math.sin(t * 1.6) * 0.045;
    nodes.forEach((node, i) => { node.material.emissiveIntensity = (0.8 + Math.max(0, Math.sin(t * 2.5 - i * 0.55)) * 0.7) * (st.light ? 0.16 : 1); });
  });
  return { group: g, emissive };
}

/* Agent 本体：服务器机柜 + 顶部神经网络大脑，象征"在服务器上运行的智能体" */
function agentBot(st, { x, z, color, T }) {
  const rack = server(st.dyn, { x, z, w: 1.8, h: 2.4, d: 1.5, color, T });
  rack.beacon.parent.remove(rack.beacon);
  const br = brain(st, st.dyn, { x, y: rack.rackTop + 0.95, z, color });
  return {
    ...rack,
    bot: br.group,
    top: new THREE.Vector3(x, rack.rackTop + 2, z),
    tint: (c, k) => { rack.tint(c, k); for (const m of br.emissive) { m.material.color.setHex(c); if (m.material.emissive) m.material.emissive.setHex(c); } },
  };
}

/* 产出文件：按格式上浮。format -> 颜色与小标记 */
const FMT_COLOR = { md: 0x60a5fa, json: 0xf2a33a, csv: 0x34d399, pdf: 0xff6e66, html: 0xb58aff, txt: 0x9fb3c9, yaml: 0x34d399, eml: 0x60a5fa };
const LIGHT_FMT_COLOR = {
  md: LIGHT_COLORS.blue, json: LIGHT_COLORS.amber, csv: LIGHT_COLORS.green,
  pdf: LIGHT_COLORS.red, html: LIGHT_COLORS.purple, txt: LIGHT_COLORS.slate,
  yaml: LIGHT_COLORS.green, eml: LIGHT_COLORS.blue,
};
const fmtOf = (p) => (p.split('.').pop() || '').toLowerCase();

/* 抛物线链路 + 沿线粒子。fire() 发射一颗，onArrive 到达回调 */
function arc(st, from, to, color, { lift = 3.4, opacity = 0.35 } = {}) {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  mid.y = Math.max(from.y, to.y) + lift;
  const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
  const track = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.03, 6, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity }));
  st.dyn.add(track);
  const flights = [];
  st.tickers.add((dt) => {
    for (let i = flights.length - 1; i >= 0; i -= 1) {
      const f = flights[i];
      f.t += dt / f.dur;
      const p = Math.min(f.t, f.stop);
      f.head.position.copy(curve.getPoint(p));
      f.trail.forEach((s, k) => s.position.copy(curve.getPoint(Math.max(0, p - (k + 1) * 0.035))));
      if (f.t >= f.stop) {
        f.parts.forEach((m) => { st.dyn.remove(m); m.geometry.dispose(); m.material.dispose(); });
        flights.splice(i, 1);
        f.onArrive?.();
      }
    }
    track.material.opacity += ((flights.length ? (st.light ? 0.7 : 0.95) : opacity) - track.material.opacity) * 0.12;
  });
  function fire({ dur = 0.9, stop = 1, onArrive, tint = color } = {}) {
    if (reduced()) { onArrive?.(); return; }
    const head = mesh(st.dyn, new THREE.SphereGeometry(0.13, 12, 10), tint, [0, 0, 0], glow(tint, 2.4));
    const trail = [0.1, 0.075, 0.055, 0.04].map((r) => mesh(st.dyn, new THREE.SphereGeometry(r, 8, 6), tint, [0, 0, 0], { ...glow(tint, 1.6), transparent: true, opacity: 0.6 }));
    flights.push({ t: 0, dur, stop, onArrive, head, trail, parts: [head, ...trail] });
  }
  return { fire, track, curve };
}

/* 落点冲击波：一圈扩散的环 */
function burst(st, pos, color) {
  if (reduced()) return;
  const m = mesh(st.dyn, new THREE.RingGeometry(0.3, 0.4, 40), color, [pos.x, 0.32, pos.z], { ...glow(color, 1.8), transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  m.rotation.x = -Math.PI / 2;
  let t = 0;
  const fn = (dt) => {
    t += dt;
    m.scale.setScalar(1 + t * 5);
    m.material.opacity = Math.max(0, 0.9 - t * 1.2);
    if (t > 0.8) { st.tickers.delete(fn); st.dyn.remove(m); m.geometry.dispose(); m.material.dispose(); }
  };
  st.tickers.add(fn);
}

/* 平滑闪烁某个发光材质 */
function pulseOn(st, obj, k = 2.4) {
  if (reduced()) return;
  if (st.light) k *= 0.16;
  let t = 0;
  const base = obj.material.emissiveIntensity;
  const fn = (dt) => {
    t += dt;
    obj.material.emissiveIntensity = base + (k - base) * Math.max(0, 1 - t / 0.7);
    if (t > 0.7) { obj.material.emissiveIntensity = base; st.tickers.delete(fn); }
  };
  st.tickers.add(fn);
}

/* ================================================================ 模型演练场景 */
export function createModelScene(host, options = {}) {
  const st = stage(host, { size: [24, 14], camPos: [6, 13, 20], theme: 'model', lift: 0.04, ...options });
  const T = st.T;
  const C = st.colors;
  const atk = server(st.dyn, { x: -9.5, z: 1.6, w: 1.8, h: 3, d: 1.4, color: C.red, T });
  const tgt = [
    server(st.dyn, { x: -1.4, z: 2.2, w: 1.4, h: 2, d: 1.2, color: C.cyan, T }),
    server(st.dyn, { x: 0.4, z: 1.2, w: 1.9, h: 3.2, d: 1.5, color: C.cyan, T }),
    server(st.dyn, { x: 2.3, z: 2.4, w: 1.3, h: 1.9, d: 1.2, color: C.cyan, T }),
  ];
  const tMain = tgt[1];
  const jdg = server(st.dyn, { x: 9, z: 0.6, w: 1.5, h: 2.8, d: 1.3, color: C.purple, T });
  roleIcon(st, st.dyn, 'attacker', C.red, atk.top.x, atk.rackTop + 1.1, atk.top.z);
  roleIcon(st, st.dyn, 'target', C.cyan, tMain.top.x, tMain.rackTop + 1.1, tMain.top.z);
  roleIcon(st, st.dyn, 'judge', C.purple, jdg.top.x, jdg.rackTop + 1.1, jdg.top.z);

  /* Independent input/output gates sit behind the main row. Presence is config;
   * each gate lights only when the corresponding recorded check is reached. */
  function blueGate(key, x, z, title) {
    const group = new THREE.Group();
    group.name = `blue-team-${key}`;
    group.position.set(x, 0, z);
    st.dyn.add(group);
    box(group, 2.6, 0.14, 1.8, T.foot, 0, 0.07, 0);
    for (const side of [-1, 1]) box(group, 0.11, 2.9, 0.11, C.blue, side * 1.03, 1.5, 0, glow(C.blue, 0.6));
    box(group, 2.17, 0.11, 0.11, C.blue, 0, 2.9, 0, glow(C.blue, 0.6));
    const rack = server(group, { x: 0, z: 0, w: 1.15, h: 1.65, d: 0.9, color: C.blue, T });
    const outline = new THREE.Shape();
    outline.moveTo(-0.6, 0.4); outline.lineTo(0, 0.62); outline.lineTo(0.6, 0.4);
    outline.lineTo(0.53, -0.17); outline.quadraticCurveTo(0.4, -0.52, 0, -0.76);
    outline.quadraticCurveTo(-0.4, -0.52, -0.53, -0.17); outline.closePath();
    const shield = mesh(group, new THREE.ExtrudeGeometry(outline, { depth: 0.08, bevelEnabled: false }), C.blue, [0, 2.4, 0.57], { ...glow(C.blue, 0.6), transparent: true, opacity: 0.26 });
    const border = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline.getPoints(24).map(p => new THREE.Vector3(p.x, p.y + 2.4, 0.68))), new THREE.LineBasicMaterial({ color: C.blue, transparent: true, opacity: 0.8 }));
    group.add(border);
    line(group, [[-0.23, 2.39, 0.7], [-0.05, 2.19, 0.7], [0.3, 2.62, 0.7]], C.blue);
    return { group, shield, beacon: rack.beacon, point: new THREE.Vector3(x, 1.9, z), label: st.label(title, new THREE.Vector3(x, 3.8, z), 'blue'), anchor: new THREE.Vector3(x, 5, z) };
  }
  const inputGate = blueGate('input', -5.1, -2.7, '蓝队 · 输入');
  const outputGate = blueGate('output', 5.1, -2.7, '蓝队 · 输出');
  const aToG = arc(st, atk.mid, inputGate.point, C.red, { lift: 1.4 });
  const gToT = arc(st, inputGate.point, tMain.mid, C.red, { lift: 1.4 });
  const aToT = arc(st, atk.mid, tMain.mid, C.red, { lift: 3.6 });
  const tToA = arc(st, tMain.mid, atk.mid, C.cyan, { lift: 5, opacity: 0.2 });
  const tToG = arc(st, tMain.mid, outputGate.point, C.cyan, { lift: 1.4 });
  const gToA = arc(st, outputGate.point, atk.mid, C.cyan, { lift: 4.1, opacity: 0.2 });
  const tToJ = arc(st, tMain.mid, jdg.mid, C.purple, { lift: 3 });
  const gToJ = arc(st, outputGate.point, jdg.mid, C.purple, { lift: 1.4 });
  for (const [name, route] of Object.entries({ 'input-attack': aToG, 'input-pass': gToT, 'direct-attack': aToT, 'direct-response': tToA, 'output-response': tToG, 'output-pass': gToA, 'direct-judge': tToJ, 'output-judge': gToJ })) route.track.name = name;

  const lbA = st.label('红队', atk.top, 'red');
  const tLabel = st.label('靶标', tMain.top, 'cyan');
  const lbJ = st.label('裁判', jdg.top, 'purple');
  const up = (p) => p.clone().add(new THREE.Vector3(0, 1.6, 0));
  const NODES = {
    src: { anchor: up(atk.top), label: lbA, beacon: atk.beacon, cls: 'red' },
    input_guard: { ...inputGate, cls: 'blue' },
    output_guard: { ...outputGate, cls: 'blue' },
    tgt: { anchor: up(tMain.top), label: tLabel, beacon: tMain.beacon, cls: 'cyan' },
    judge: { anchor: up(jdg.top), label: lbJ, beacon: jdg.beacon, cls: 'purple' },
  };
  NODES.gate = NODES.input_guard;

  let inputGuarded = false, outputGuarded = false, responseSeen = false;
  const promise = (fn) => new Promise((res) => fn(res));
  const setGuard = (positions) => {
    const configured = Array.isArray(positions) ? positions : positions ? ['输入', '输出'] : [];
    inputGuarded = configured.includes('输入');
    outputGuarded = configured.includes('输出');
    for (const [gate, on] of [[inputGate, inputGuarded], [outputGate, outputGuarded]]) {
      gate.group.visible = on;
      gate.label.el.style.display = on ? '' : 'none';
    }
    aToT.track.visible = !inputGuarded;
    aToG.track.visible = gToT.track.visible = inputGuarded;
    tToA.track.visible = tToJ.track.visible = !outputGuarded;
    tToG.track.visible = gToA.track.visible = gToJ.track.visible = outputGuarded;
  };
  const blockAt = gate => {
    pulseOn(st, gate.beacon, 3);
    pulseOn(st, gate.shield, 2.8);
    burst(st, gate.point, C.blue);
  };
  setGuard(false);
  st.refit();

  return {
    /* 在元素上方弹出它此刻的输出；focus 只高亮，用于右侧悬停反向定位 */
    say(key, title, text, ms = 2800) {
      const n = NODES[key];
      if (!n || (n.group && !n.group.visible)) return;
      st.flash(n.label);
      if (n.beacon) pulseOn(st, n.beacon, 2.8);
      st.callout(n.anchor, `<b>${escHtml(title)}</b>${text ? `<span>${escHtml(text)}</span>` : ''}`, n.cls, ms);
    },
    focus(key) {
      const n = NODES[key];
      if (!n || (n.group && !n.group.visible)) return;
      st.flash(n.label);
      if (n.beacon) pulseOn(st, n.beacon, 2.8);
    },
    reset({ target, guard }) {
      setGuard(guard);
      responseSeen = false;
      tLabel.el.textContent = target ? `靶标：${target}` : '靶标';
      tgt.forEach((t) => t.tint(C.cyan, 0.7));
    },
    attack(blocked) {
      responseSeen = false;
      pulseOn(st, atk.beacon);
      if (!inputGuarded) return promise((res) => aToT.fire({ dur: 1.1, onArrive: () => { burst(st, tMain.mid, C.red); res(); } }));
      return promise((res) => aToG.fire({
        dur: 0.8,
        onArrive: () => {
          if (blocked) {
            blockAt(inputGate);
            res();
          } else {
            gToT.fire({ dur: 0.7, onArrive: () => { burst(st, tMain.mid, C.red); res(); } });
          }
        },
      }));
    },
    reply(blocked = false) {
      responseSeen = true;
      if (!outputGuarded) return promise((res) => tToA.fire({ dur: 1.2, onArrive: res }));
      return promise((res) => tToG.fire({ dur: 0.7, onArrive: () => {
        pulseOn(st, outputGate.beacon);
        if (blocked) { blockAt(outputGate); res(); }
        else gToA.fire({ dur: 1.1, onArrive: res });
      } }));
    },
    judge(verdict) {
      return promise((res) => (outputGuarded && responseSeen ? gToJ : tToJ).fire({
        dur: 0.9,
        onArrive: () => {
          pulseOn(st, jdg.beacon, 3);
          const c = verdict === 'breach' ? C.red : C.green;
          tgt.forEach((t) => t.tint(c, 1.1));
          burst(st, tMain.mid, c);
          res();
        },
      }));
    },
    dispose: st.dispose,
  };
}

/* ================================================================ Agent 演练场景 */
const PUB = /^(output|deliverables|service_queue|remote_uploads|gitlab_repo|gitlab_snapshots|owncloud\/Documents|email_drafts|upload_queue|owncloud_uploads)/;
const CONTROL = /(^|\/)(QWEN\.md|AGENTS\.md|SKILL\.md)$/;

export function createAgentScene(host, options = {}) {
  const st = stage(host, { size: [24, 15], camPos: [1, 13.5, 19], theme: 'agent', lift: 0.08, ...options });
  const T = st.T;
  const C = st.colors;
  const formatColors = st.light ? LIGHT_FMT_COLOR : FMT_COLOR;
  const SLOTS = [];
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < 4; c += 1) SLOTS.push([-7.6 + c * 1.7, -4.6 + r * 1.8]);
  const OUT_SLOTS = [];
  for (let r = 0; r < 2; r += 1) for (let c = 0; c < 4; c += 1) OUT_SLOTS.push([4.4 + c * 1.5, 2.4 + r * 1.9]);
  const CTRL_SLOTS = [[-10.2, 4.4], [-8.6, 5], [-10.4, 5.8], [-8.8, 6], [-11.4, 5.4]];

  let unit = null;
  function build(u) {
    st.clearDyn();
    const agent = agentBot(st, { x: 0, z: 1.5, color: C.cyan, T });
    st.label('智能体', agent.top, 'cyan');
    workbench(st, st.dyn, { x: -9.4, z: -3.4, color: C.cyan, T });
    st.label('工作区', new THREE.Vector3(-9.4, 3.8, -3.4), 'zone');
    const wsPt = new THREE.Vector3(-9.4, 1.8, -3.4);
    // 裁判大模型：路径末端，对最终产物判读
    const judge = server(st.dyn, { x: 8.3, z: 1.2, w: 1.5, h: 2.6, d: 1.3, color: C.purple, T });
    roleIcon(st, st.dyn, 'judge', C.purple, judge.top.x, judge.rackTop + 1.1, judge.top.z);
    const jLabel = st.label('裁判', judge.top, 'purple');
    const jArc = arc(st, agent.mid, judge.mid, C.purple, { lift: 3, opacity: 0.16 });
    st.label('对外产出', new THREE.Vector3(7, 0.3, 5.2), 'zone');
    const files = new Map();
    const reads = [];
    const sensitive = new Set();
    for (const s of u.steps) for (const f of s.files) {
      if (PUB.test(f) || CONTROL.test(f)) continue;
      if (!reads.includes(f)) reads.push(f);
      if (s.flag === 'warn' || s.flag === 'risk') sensitive.add(f);
    }
    reads.slice(0, SLOTS.length).forEach((f, i) => {
      const [x, z] = SLOTS[i];
      // 机密资料做成文件夹，普通文件做成档案卡
      const fc = sensitive.has(f)
        ? folder(st.dyn, { x, z, color: C.amber, T })
        : fileCard(st.dyn, { x, z, h: 0.9 + ((i * 37) % 4) * 0.12, color: T.slate, T });
      files.set(f, { b: fc.body, cap: fc.cap, pos: fc.pos, arc: arc(st, agent.mid, fc.pos, C.cyan, { lift: 2.2, opacity: 0.06 }) });
    });
    // 注入文件 + 攻击者：仅在有攻击者时出现在路径最前
    const ctrl = (u.injected || []).slice(0, CTRL_SLOTS.length).map((p, i) => {
      const [x, z] = CTRL_SLOTS[i];
      const fd = folder(st.dyn, { x, z, color: C.red, T });
      return { path: p, b: fd.body, cap: fd.cap, pos: fd.pos, arc: arc(st, fd.pos, agent.mid, C.red, { lift: 1.8, opacity: 0.22 }) };
    });
    let attacker = null;
    let aArc = null;
    let wArc = null;
    if (ctrl.length) {
      attacker = server(st.dyn, { x: -8.6, z: 4.2, w: 1.5, h: 2.4, d: 1.3, color: C.red, T });
      roleIcon(st, st.dyn, 'attacker', C.red, attacker.top.x, attacker.rackTop + 1.1, attacker.top.z);
      st.label('红队', attacker.top, 'red');
      aArc = arc(st, attacker.mid, agent.mid, C.red, { lift: 3, opacity: 0.2 });
      // 攻击者→工作区：多根弧线扇向工作区四周，呼应攻击者→智能体的那束
      const wsFan = [wsPt,
        new THREE.Vector3(-8.3, 1.4, -2.5),
        new THREE.Vector3(-10.4, 1.5, -4.2),
        new THREE.Vector3(-9.0, 2.5, -4.6),
        new THREE.Vector3(-10.2, 1.3, -2.7)];
      const wArcs = wsFan.map((p, i) => arc(st, attacker.mid, p, C.red, { lift: 2.2 + i * 0.45, opacity: 0.16 }));
      wArc = { fire: (o = {}) => wArcs.forEach((a, i) => a.fire({ ...o, dur: (o.dur || 1.1) + i * 0.09 })) };
      st.label('注入文件', new THREE.Vector3(-9.6, 1.3, 5.6), 'red');
    }
    const outs = u.outputs.slice(0, OUT_SLOTS.length).map((p, i) => {
      const [x, z] = OUT_SLOTS[i];
      const col = formatColors[fmtOf(p)] || C.blue;
      const fc = fileCard(st.dyn, { x, z: z + 0.001, h: 1 + ((i * 53) % 3) * 0.3, color: col, T });
      fc.group.visible = false;
      return { path: p, group: fc.group, cap: fc.cap, pos: fc.pos, arc: arc(st, agent.mid, fc.top, col, { lift: 2.6, opacity: 0 }) };
    });
    unit = { agent, judge, jLabel, jArc, attacker, aArc, wArc, files, ctrl, outs };
    st.refit();
  }

  /* 产出按格式上浮：从台面下升起并淡入 */
  const floatIn = (g) => {
    g.visible = true;
    if (reduced()) { g.position.y = 0; return; }
    g.position.y = -1.4;
    let t = 0;
    const fn = (dt) => { t += dt * 1.8; g.position.y = -1.4 * Math.max(0, 1 - t); if (t >= 1) { g.position.y = 0; st.tickers.delete(fn); } };
    st.tickers.add(fn);
  };

  const fileName = (p) => (p.endsWith('/') ? `${p.replace(/\/+$/, '').split('/').pop()}/` : p.split('/').pop());
  const above = (pos, k = 0.9) => pos.clone().add(new THREE.Vector3(0, k, 0));
  const paint = (m, c, k = 1) => { m.material.color.setHex(c); m.material.emissive.setHex(c); m.material.emissiveIntensity = k * (st.light ? 0.16 : 1); };
  /* 每个元素一个 key：agent / 文件路径 / 注入文件路径 / 产出路径，右侧输出按 key 联动 */
  function nodeOf(key) {
    if (!unit) return null;
    if (key === 'agent') return { anchor: above(unit.agent.top, 1.1), glow: unit.agent.beacon, cls: 'cyan' };
    const f = unit.files.get(key);
    if (f) return { anchor: above(f.pos), glow: f.cap, cls: 'cyan' };
    const c = unit.ctrl.find((x) => x.path === key);
    if (c) return { anchor: above(c.pos, 1.2), glow: c.b, cls: 'red' };
    const o = unit.outs.find((x) => x.path === key);
    if (o) return { anchor: above(o.pos, 0.8), glow: o.cap, cls: 'blue' };
    return null;
  }
  function say(key, title, text, cls, ms = 2200) {
    const n = nodeOf(key);
    if (!n) return;
    if (n.glow) pulseOn(st, n.glow, 2.6);
    st.callout(n.anchor, `<b>${escHtml(title)}</b>${text ? `<span>${escHtml(text)}</span>` : ''}`, cls || n.cls, ms);
  }

  return {
    load(u) { build(u); },
    say,
    focus(key, { callout = true } = {}) {
      const n = nodeOf(key);
      if (!n) return;
      if (n.glow) pulseOn(st, n.glow, 2.8);
      if (callout) st.callout(n.anchor, `<b>${escHtml(key === 'agent' ? '智能体' : fileName(key))}</b>`, n.cls, 1200);
    },
    /* 注入文件逐个写入控制面：攻击者先发一束到智能体，再每个文件夹落地，到达时回调 onEach(path) */
    inject(onEach) {
      if (!unit?.ctrl.length) return Promise.resolve();
      if (unit.attacker) { pulseOn(st, unit.attacker.beacon, 2.6); unit.aArc?.fire({ dur: 1 }); unit.wArc?.fire({ dur: 1.1 }); }
      return Promise.all(unit.ctrl.map((c, i) => new Promise((res) => setTimeout(() => {
        pulseOn(st, c.b, 2.4);
        c.arc.fire({ dur: 0.9, onArrive: () => { onEach?.(c.path); res(); } });
      }, i * 420))));
    },
    /* 一个执行步：智能体弹出步骤名，光束逐个打到涉及的文件，到达时回调 onHit(path)；全部到达后 resolve */
    step(s, onHit) {
      if (!unit) return Promise.resolve();
      const tone = s.flag === 'risk' ? 'red' : s.flag === 'warn' ? 'amber' : s.flag === 'ok' ? 'green' : 'cyan';
      say('agent', s.title, '', tone, 1800);
      const jobs = s.files.map((f, i) => new Promise((res) => {
        const hit = unit.files.get(f);
        const c = s.flag === 'warn' || s.flag === 'risk' ? C.amber : C.cyan;
        setTimeout(() => {
          if (!hit) { onHit?.(f); res(); return; }
          hit.arc.fire({ dur: 0.7, tint: c, onArrive: () => {
            paint(hit.cap, c);
            burst(st, hit.pos, c);
            if (i < 2) st.callout(above(hit.pos), `<b>${escHtml(fileName(f))}</b>`, c === C.amber ? 'amber' : 'cyan', 1500);
            onHit?.(f);
            res();
          } });
        }, 300 + i * 260);
      }));
      if (s.flag === 'ok') burst(st, unit.agent.mid, C.green);
      return Promise.all(jobs);
    },
    /* 产出按格式逐个浮现（真到产出阶段才出现），每个落成时回调 onEach(path) */
    outputs(onEach) {
      if (!unit) return Promise.resolve();
      return Promise.all(unit.outs.map((o, i) => new Promise((res) => setTimeout(() => {
        floatIn(o.group);
        o.arc.fire({ dur: 0.8, tint: o.cap.material.color.getHex(), onArrive: () => {
          if (i < 3) st.callout(above(o.pos, 0.8), `<b>${escHtml(fileName(o.path))}</b>`, 'blue', 1500);
          onEach?.(o.path);
          res();
        } });
      }, i * 300))));
    },
    verdict(v) {
      if (!unit) return;
      const c = v === 'breach' ? C.red : C.green;
      // 先把结果送到裁判判读，再给出结论
      unit.jArc?.fire({ dur: 0.9, tint: C.purple, onArrive: () => {
        if (unit.judge) pulseOn(st, unit.judge.beacon, 3);
        st.flash(unit.jLabel);
        unit.agent.tint(c, 1.1);
        burst(st, unit.agent.mid, c);
        st.callout(above(unit.agent.top, 1.1), `<b>${v === 'breach' ? '已攻破' : '已守住'}</b>`, v === 'breach' ? 'red' : 'green', 2400);
      } });
    },
    dispose: st.dispose,
  };
}
