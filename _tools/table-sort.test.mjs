import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<main id="app-main"></main>', { url: 'http://localhost/', runScripts: 'dangerously' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const UI = await import('../src/core/ui.js');
const router = await import('../src/core/router.js');
const { taskListPage, actions: taskActions } = await import('../src/pages/task-list.js');
const { resultsPage, actions: resultActions } = await import('../src/pages/results.js');
const { agentResultsPage, actions: agentResultActions } = await import('../src/pages/agent-results.js');
const { reportsPage, actions: reportActions } = await import('../src/pages/reports.js');
const { agentReportsPage, actions: agentReportActions } = await import('../src/pages/agent-reports.js');
const { agentStrategyPage, actions: agentStrategyActions } = await import('../src/pages/agent-strategy.js');
const { compareValues } = await import('../src/core/table-sort.js');
window.App = { ...taskActions, ...resultActions, ...agentResultActions, ...reportActions, ...agentReportActions, ...agentStrategyActions };
window.UI = UI;
router.register('exercise', 'tasks', () => taskListPage('model'));
router.register('agent', 'ag-tasks', () => taskListPage('agent'));
router.register('exercise', 'results', resultsPage);
router.register('agent', 'ag-results', agentResultsPage);
router.register('exercise', 'reports', reportsPage);
router.register('agent', 'ag-reports', agentReportsPage);
router.register('strategy', 'ag-strategy', agentStrategyPage);
router.setRenderer(() => {
  const route = router.state();
  document.querySelector('main').innerHTML = router.resolve(route.page, route.sub)(route);
});
UI.bindPageRerender(() => { const r = router.state(); router.nav(r.page, r.sub); });
after(() => dom.window.close());

const routes = [
  { page: 'exercise', sub: 'tasks', title: '创建时间', input: 'tl-model-q', filter: 'Qwen', numeric: false, controls: 2 },
  { page: 'exercise', sub: 'tasks', title: '结束时间', input: 'tl-model-q', filter: 'Qwen', numeric: false, controls: 2 },
  { page: 'agent', sub: 'ag-tasks', title: '创建时间', input: 'tl-agent-q', filter: 'Qwen', numeric: false, controls: 2 },
  { page: 'agent', sub: 'ag-tasks', title: '结束时间', input: 'tl-agent-q', filter: 'Qwen', numeric: false, controls: 2 },
  { page: 'exercise', sub: 'results', title: 'ASR', input: 'rs-q', filter: 'Qwen', numeric: true },
  { page: 'agent', sub: 'ag-results', title: 'ASR', input: 'agr-q', filter: 'Qwen', numeric: true },
  { page: 'exercise', sub: 'reports', title: '生成时间', input: 'rp-q', filter: 'Qwen', numeric: false },
  { page: 'agent', sub: 'ag-reports', title: '生成时间', input: 'agrp-q', filter: 'Qwen', numeric: false },
  { page: 'strategy', sub: 'ag-strategy', title: '更新时间', input: 'ags-q', filter: '客服', numeric: false },
];

for (const route of routes) test(`${route.page}/${route.sub} sorts from the matching header without losing filters`, () => {
  router.nav(route.page, route.sub);
  const input = document.getElementById(route.input);
  input.value = route.filter;
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const heading = () => [...document.querySelectorAll('th[aria-sort]')].find(th => th.textContent.trim() === route.title);
  const values = () => {
    const index = [...heading().parentElement.children].indexOf(heading());
    return [...document.querySelectorAll('tbody tr')].map(row => {
      const text = row.children[index].textContent.trim();
      if (!route.numeric) return text;
      const percentage = text.match(/(-?\d+(?:\.\d+)?)%/);
      assert.ok(percentage, `metric cell must contain a numeric percentage: ${text}`);
      return Number(percentage[1]);
    });
  };
  assert.equal(document.querySelectorAll('.table-sort').length, route.controls || 1);
  assert.equal(document.querySelector('.filters .table-sort, .sort-btn'), null);
  assert.equal(heading().textContent.trim(), route.title);
  if (heading().getAttribute('aria-sort') === 'none') {
    assert.match(heading().querySelector('button').getAttribute('aria-label'), /点击按此列降序排序/);
    heading().querySelector('button').click();
  }
  assert.equal(document.querySelectorAll('th[aria-sort]:not([aria-sort="none"])').length, 1);
  assert.equal(heading().getAttribute('aria-sort'), 'descending');
  assert.match(heading().querySelector('button').getAttribute('aria-label'), /当前降序，点击切换为升序/);
  const before = values();
  assert.ok(before.length >= 2, 'filtered fixtures must include multiple results');
  assert.ok(new Set(before).size > 1, 'fixtures must prove an actual order change');
  heading().querySelector('button').click();
  assert.equal(heading().getAttribute('aria-sort'), 'ascending');
  assert.equal(document.getElementById(route.input).value, route.filter);
  const ascending = [...before].sort((a, b) => compareValues(a, b, false));
  assert.deepEqual(values(), ascending);
  assert.notDeepEqual(values(), before);
  heading().querySelector('button').click();
  assert.deepEqual(values(), before);
});

test('date sorting keeps unfinished dates after completed dates in both directions', () => {
  const dates = [null, '2026-11-19 09:00', '', '2026-11-18 12:30', undefined];
  for (const descending of [true, false]) {
    const sorted = [...dates].sort((a, b) => compareValues(a, b, descending));
    assert.deepEqual(sorted.slice(0, 2), descending ? ['2026-11-19 09:00', '2026-11-18 12:30'] : ['2026-11-18 12:30', '2026-11-19 09:00']);
    assert.ok(sorted.slice(2).every(value => !value));
  }
});

test('model evaluation includes the configured blue-team positions', () => {
  router.nav('exercise', 'results');
  const heading = [...document.querySelectorAll('th')].find(th => th.textContent === '蓝队配置');
  const index = [...heading.parentElement.children].indexOf(heading);
  const names = [...document.querySelectorAll('tbody tr')].map(row => row.children[index].textContent);
  assert.ok(names.some(name => /（输入 \+ 输出）$/.test(name)));
  assert.ok(names.filter(name => name.includes('输入') || name.includes('输出')).every(name => (name.match(/（/g) || []).length === 1));
});

test('column sorting retains current pagination', () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({ value: i + 1 }));
  let descending = true;
  const render = () => {
    document.querySelector('main').innerHTML = UI.pagedTable('sort-page-fixture', [{
      title: '数值', key: 'value', sort: { direction: descending ? 'descending' : 'ascending', onclick: 'App.toggleSortPage()' },
    }], [...entries].sort((a, b) => descending ? b.value - a.value : a.value - b.value));
  };
  window.App.toggleSortPage = () => { descending = !descending; render(); };
  UI.bindPageRerender(render);
  UI.setPage('sort-page-fixture', 2);
  const rowValues = () => [...document.querySelectorAll('tbody td')].map(td => Number(td.textContent));
  assert.deepEqual(rowValues(), [5, 4, 3, 2, 1]);
  document.querySelector('.table-sort').click();
  assert.deepEqual(rowValues(), [16, 17, 18, 19, 20]);
  assert.match(document.querySelector('.pager').textContent, /2 \/ 2/);
});
