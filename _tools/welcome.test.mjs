import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { INITIAL_METRICS, initialResources, welcomeSequences } from '../src/domain/welcome.js';
import { welcomePage, mountWelcome } from '../src/pages/welcome.js';
import { actions as postureActions } from '../src/pages/posture.js';
import * as store from '../src/domain/store.js';
import * as router from '../src/core/router.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const mountDocument = (html = welcomePage()) => {
  const dom = new JSDOM(`<main>${html}</main>`);
  globalThis.document = dom.window.document;
  return dom;
};

function sceneStub(created, disposed, effects) {
  return Object.fromEntries(['Model', 'Agent'].map(kind => [`create${kind}Scene`, (host, options) => {
    const canvas = document.createElement('canvas'); host.append(canvas);
    created.push({ kind, options });
    return {
      reset(value) { assert.equal(value.target, '待选择模型'); },
      load(value) { assert.deepEqual(value.steps, []); assert.equal(value.verdict, undefined); },
      focus() { effects.push('focus'); }, attack() { effects.push('attack'); }, reply() { effects.push('reply'); },
      judge() { effects.push('judge'); }, inject() { effects.push('inject'); }, outputs() { effects.push('outputs'); },
      verdict() { effects.push('verdict'); },
      dispose() { disposed.push(kind); canvas.remove(); },
    };
  }]));
}

test('initial homepage distinguishes unknown metrics and unevaluated assets from measured zero or safety', () => {
  const dom = mountDocument();
  try {
    const metrics = [...document.querySelectorAll('.ps-metric')];
    assert.equal(metrics.length, INITIAL_METRICS.length);
    assert.deepEqual(metrics.map(metric => metric.querySelector('.ps-metric-v').textContent), Array(INITIAL_METRICS.length).fill('—'));
    assert.ok(metrics.every(metric => metric.querySelector('.ps-metric-v').getAttribute('aria-label') === '尚无演练数据'));
    const risk = document.querySelector('.wh-risk');
    assert.match(risk.textContent, /尚未评估/);
    assert.match(risk.textContent, /尚未演练时，不判断资产是否安全/);
    assert.equal(risk.querySelector('.ps-risk, .ps-count, .ps-verdict'), null);
    const assets = document.querySelector('.wh-user-assets');
    assert.match(assets.textContent, /等待接入/);
    assert.match(assets.textContent, /接入模型/);
    assert.match(assets.textContent, /接入智能体/);
    assert.doesNotMatch(assets.textContent, /0%|0 个|已接入|已演练资产/);
    const allKnownTasks = [...store.listTasks(), ...store.listAgentTasks()];
    for (const task of allKnownTasks) assert.equal(document.body.textContent.includes(task.name), false, 'history does not leak into the initial view');
    for (const asset of [...store.models, ...store.agents]) assert.equal(assets.textContent.includes(asset.name), false);
  } finally { dom.window.close(); }
});

test('initial resources include populated system catalogs and keep user content out of platform resources', () => {
  const catalogs = {
    banks: [{ name: 'Built-in model bank', source: 'system', items: [1] }, { name: 'Private model bank', source: 'user', items: [1, 2] }],
    sceneBanks: [{ name: 'Built-in Agent bank', source: 'system', items: [1, 2, 3] }, { name: 'Empty Agent bank', source: 'system', items: [] }, { name: 'Private Agent bank', source: 'user', items: [1] }],
  };
  const original = structuredClone(catalogs);
  assert.deepEqual(initialResources(catalogs), [
    { name: 'Built-in model bank', kind: '模型攻击题库', page: 'strategy', sub: 'banks' },
    { name: 'Built-in Agent bank', kind: 'Agent 场景题库 · 3 题', page: 'strategy', sub: 'scenebanks' },
  ]);
  assert.deepEqual(catalogs, original, 'the view model must not rewrite catalogs');
  assert.deepEqual(initialResources(), []);
  const dom = mountDocument();
  try {
    const system = document.querySelector('.wh-resources');
    const expected = initialResources(store);
    assert.match(system.textContent, /系统内置资源/);
    assert.equal(system.querySelectorAll('.wh-resource').length, expected.length);
    expected.forEach(resource => assert.ok(system.textContent.includes(resource.name)));
  } finally { dom.window.close(); }
});

test('welcome sequences explain both workflows without real target names, task content or judgments', () => {
  const realTasks = [...store.listTasks(), ...store.listAgentTasks()];
  for (const type of ['model', 'agent']) {
    const sequences = welcomeSequences(type);
    assert.ok(sequences.length > 0);
    const serialized = JSON.stringify(sequences);
    assert.doesNotMatch(serialized, /已攻破|未攻破|已守住|\d+(?:\.\d+)?%|task-agt-|task-tgt-|openart-mid-/);
    for (const task of realTasks) {
      assert.equal(serialized.includes(task.name), false);
      assert.equal(serialized.includes(task.targetName), false);
    }
    for (const sequence of sequences) {
      assert.equal(sequence.verdict, undefined);
      assert.equal(sequence.scene?.verdict, undefined);
      assert.ok(sequence.events.length > 0);
      assert.ok(sequence.events.every(event => event.verdict === undefined && event.phase !== 'assessment'));
      assert.ok(sequence.events.every(event => (event.content || []).every(item => item.verdict === undefined)));
      if (type === 'agent') assert.deepEqual(sequence.scene.steps, []);
    }
  }
  assert.match(JSON.stringify(welcomeSequences('model')), /输入侧防护（可选）.*输出侧防护（可选）/);
  assert.match(JSON.stringify(welcomeSequences('agent')), /没有实际演练时不生成结果/);
});

test('reduced-motion welcome switches one scene at a time and displays explanatory content without verdict effects', async () => {
  const dom = mountDocument();
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.WebGLRenderingContext = function() {};
  const created = [], disposed = [], effects = [];
  const sceneLoader = async () => sceneStub(created, disposed, effects);
  let cleanup;
  try {
    cleanup = mountWelcome(document, { sceneLoader });
    await settle();
    assert.equal(document.querySelectorAll('canvas').length, 1);
    assert.equal(document.querySelector('#ps-arena').dataset.view, 'model');
    assert.match(document.querySelector('#ps-process-lines').textContent, /裁判评估/);
    assert.equal(document.querySelector('.ps-verdict'), null);
    assert.deepEqual(effects, []);
    postureActions.psToggle(); await settle();
    assert.equal(document.querySelector('#ps-arena').dataset.view, 'agent');
    assert.equal(document.querySelectorAll('canvas').length, 1);
    assert.deepEqual(disposed, ['Model']);
    assert.match(document.querySelector('#ps-process-lines').textContent, /没有实际演练时不生成结果/);
    assert.equal(document.querySelector('.ps-agent-assessment, .ps-verdict'), null);
    assert.equal(document.querySelector('#ps-process-lines').dataset.phase, 'guide');
    assert.match(document.querySelector('.wh-onboarding').textContent, /接入智能体/);
    assert.deepEqual(effects, []);
    assert.ok(created.every(({ options }) => options.appearance === 'light' && options.transparentBackground && options.frameFromCSS));
    cleanup(); cleanup();
    assert.deepEqual(disposed, ['Model', 'Agent'], 'cleanup must be idempotent');
    assert.equal(document.querySelectorAll('canvas').length, 0);
    postureActions.psToggle(); await settle();
    assert.equal(created.length, 2, 'a disposed welcome cannot create another scene');
  } finally { cleanup?.(); dom.window.close(); }
});

test('welcome cancels prior animation timers on switching and removes the final timer on unmount', async () => {
  const dom = mountDocument();
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.WebGLRenderingContext = function() {};
  const nativeSet = globalThis.setTimeout, nativeClear = globalThis.clearTimeout;
  const timers = new Map(), created = [], disposed = [], effects = [];
  let serial = 0, cleanup;
  globalThis.setTimeout = (fn, delay) => { timers.set(++serial, { fn, delay }); return serial; };
  globalThis.clearTimeout = id => timers.delete(id);
  try {
    cleanup = mountWelcome(document, { sceneLoader: async () => sceneStub(created, disposed, effects) });
    await settle();
    assert.equal(timers.size, 1);
    const firstTimer = [...timers.keys()][0];
    postureActions.psToggle(); await settle();
    assert.equal(timers.size, 1);
    assert.equal(timers.has(firstTimer), false);
    assert.deepEqual(disposed, ['Model']);
    const events = welcomeSequences('agent')[0].events;
    for (let index = 0; index < events.length; index += 1) {
      const flow = document.querySelector('#ps-process-lines');
      assert.equal(flow.dataset.phase, 'guide');
      assert.equal(flow.querySelector('.ps-verdict, .ps-agent-assessment'), null);
      assert.ok(flow.textContent.includes(events[index].text));
      const [id, timer] = timers.entries().next().value;
      timers.delete(id); timer.fn();
      assert.equal(timers.size, 1);
    }
    assert.equal(effects.includes('verdict'), false);
    assert.equal(effects.includes('judge'), false);
    cleanup();
    assert.equal(timers.size, 0);
    assert.deepEqual(disposed, ['Model', 'Agent']);
  } finally {
    cleanup?.(); globalThis.setTimeout = nativeSet; globalThis.clearTimeout = nativeClear; dom.window.close();
  }
});

test('leaving welcome during its pending loader prevents late scene creation', async () => {
  const dom = mountDocument();
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.WebGLRenderingContext = function() {};
  const releases = [], created = [], disposed = [], effects = [];
  const cleanup = mountWelcome(document, { sceneLoader: () => new Promise(resolve => releases.push(resolve)) });
  postureActions.psToggle();
  assert.equal(releases.length, 2);
  cleanup();
  releases.forEach(resolve => resolve(sceneStub(created, disposed, effects)));
  await settle();
  assert.equal(created.length, 0);
  assert.equal(document.querySelector('canvas'), null);
  assert.equal(document.querySelector('#ps-process-lines').textContent, '');
  dom.window.close();
});

test('empty URL and Home open initial homepage while brand opens populated posture and reciprocal links work', async () => {
  const dom = new JSDOM(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), {
    url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'dangerously',
  });
  globalThis.window = dom.window;
  for (const key of ['document', 'location', 'history', 'HTMLElement', 'Node', 'Event', 'CustomEvent', 'getComputedStyle', 'localStorage']) globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
  globalThis.matchMedia = () => ({ matches: true });
  delete globalThis.WebGLRenderingContext;
  try {
    assert.deepEqual(router.parseHash(), { page: 'home', sub: 'home', param: null });
    await import('../src/main.js');
    assert.deepEqual(router.state(), { page: 'home', sub: 'home', param: null });
    assert.ok(document.querySelector('#welcome-root'));
    document.querySelector('.wh-posture-link').click();
    assert.equal(router.state().page, 'posture');
    assert.ok(document.querySelector('#ps-root'));
    assert.equal(document.querySelector('#welcome-root'), null);
    document.querySelector('.ps-home-link').click();
    assert.equal(router.state().page, 'home');
    window.App.go('exercise', 'tasks'); document.querySelector('.brand').click();
    assert.equal(router.state().page, 'posture');
    assert.ok(document.querySelector('#ps-root'));
    const homeTab = [...document.querySelectorAll('.top-nav button')].find(button => button.textContent === '首页');
    assert.ok(homeTab);
    assert.equal(homeTab.classList.contains('active'), false, 'brand posture does not select the distinct Home tab');
    homeTab.click();
    assert.equal(router.state().page, 'home');
    assert.ok(document.querySelector('#welcome-root'));
    assert.ok(document.querySelector('.top-nav button.active').textContent === '首页');
    location.hash = '#/posture/home';
    window.dispatchEvent(new Event('hashchange'));
    assert.equal(router.state().page, 'posture');
    assert.ok(document.querySelector('#ps-root'));
    assert.equal(document.querySelector('.ps-home-link').textContent, '初始首页');
  } finally {
    window.dispatchEvent(new Event('pagehide'));
    dom.window.close();
  }
});
