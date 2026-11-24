/* 渲染检查：jsdom 提供 DOM，Node 原生 ESM 载入真实模块，遍历所有路由。
 * 跑法：node _tools/check.mjs
 */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  runScripts: 'dangerously',
});

const errors = [];
const g = globalThis;
const def = (k, v) => Object.defineProperty(g, k, { value: v, configurable: true, writable: true });
def('window', dom.window);
for (const k of ['document', 'location', 'history', 'HTMLElement', 'Node', 'Event', 'CustomEvent', 'getComputedStyle', 'localStorage']) {
  def(k, dom.window[k]);
}
def('navigator', dom.window.navigator);
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

const origErr = console.error;
console.error = (...a) => errors.push(a.map(String).join(' '));

await import(pathToFileURL(path.join(ROOT, 'src/main.js')).href);

const routes = [
  ['home', 'home'],
  ['posture', 'home'],
  ['exercise', 'tasks'],
  ['exercise', 'task-detail', 'task-tgt-deepseek-chat'],
  ['exercise', 'task-create'],
  ['agent', 'ag-tasks'], ['agent', 'ag-task-create'],
  ['agent', 'ag-task-detail', 'task-agt-cs5-universal'],
  ['agent', 'ag-results'], ['agent', 'ag-reports'],
  ['agent', 'ag-report-detail', 'task-agt-cs5-universal'],
  ['exercise', 'results'],
  ['exercise', 'reports'],
  ['exercise', 'report-detail', 'task-tgt-qwen-flash'],
  ['strategy', 'attack'],
  ['strategy', 'methods'],
  ['strategy', 'banks'],
  ['strategy', 'bank-authoring'],
  ['strategy', 'strategy-create'],
  ['strategy', 'guard'],
  ['strategy', 'evaluators'],
  ['strategy', 'ag-strategy'], ['strategy', 'ag-methods'], ['strategy', 'scenebanks'],
  ['assets', 'agents'], ['assets', 'intake'],
  ['strategy', 'authoring'],
  ['exercise', 'compare', 'task-tgt-qwen-flash~task-tgt-deepseek-chat'],
  ['assets', 'models'],
  ['risk', 'events'], ['platform', 'roles'], ['platform', 'riskrule'], ['platform','datarule'],
];

const rows = [];
for (const [page, sub, param] of routes) {
  try {
    dom.window.App.go(page, sub, param);
    const main = document.getElementById('app-main');
    const h1 = main.querySelector('.page-heading h1');
    rows.push({
      route: `${page}/${sub}`,
      title: (h1?.textContent || '(无标题)').trim().slice(0, 26),
      chars: (main.textContent || '').length,
      cards: main.querySelectorAll('.card').length,
      tables: main.querySelectorAll('table').length,
      buttons: main.querySelectorAll('button').length,
      empty: main.querySelectorAll('.empty').length,
      side: document.querySelectorAll('.side-nav button').length,
    });
  } catch (e) {
    rows.push({ route: `${page}/${sub}`, title: 'ERROR: ' + e.message });
  }
}

console.log = origErr;
origErr('');
origErr('route'.padEnd(30), 'title'.padEnd(28), 'chars', 'cards', 'tables', 'btns', 'empty', 'side');
for (const r of rows) {
  origErr(
    String(r.route).padEnd(30),
    String(r.title ?? '').padEnd(28),
    String(r.chars ?? '').padStart(5),
    String(r.cards ?? '').padStart(5),
    String(r.tables ?? '').padStart(6),
    String(r.buttons ?? '').padStart(4),
    String(r.empty ?? '').padStart(5),
    String(r.side ?? '').padStart(4),
  );
}
origErr(errors.length ? '\n--- 错误 ---\n' + [...new Set(errors)].slice(0, 15).join('\n') : '\n无错误');


// Lifecycle interaction tests live in task-ui.test.mjs.
dom.window.App.go('exercise','tasks');
dom.window.close();
if(errors.length || rows.some(r=>r.title.startsWith('ERROR'))) process.exitCode=1;
