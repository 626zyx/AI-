import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<main></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', { url: 'http://localhost/', runScripts: 'dangerously' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const UI = await import('../src/core/ui.js');
const router = await import('../src/core/router.js');
const store = await import('../src/domain/store.js');
const model = await import('../src/pages/strategy.js');
const agent = await import('../src/pages/agent-strategy.js');
const editor = await import('../src/pages/strategy-editor.js');
window.UI = UI;
window.App = { ...model.actions, ...agent.actions, ...editor.actions };
router.setRenderer(() => { document.querySelector('main').innerHTML = router.state().sub === 'attack' ? model.attackStrategyPage() : agent.agentStrategyPage(); });
after(() => dom.window.close());

const cases = [
  { type: 'model', rows: store.strategies, page: model.attackStrategyPage, copy: store.copyStrategy, copyAction: model.actions.copyStrategy, open: model.actions.openStrategy, deleteAction: model.actions.delStrategyOk, route: 'attack', editorName: '#se-name' },
  { type: 'agent', rows: store.agentStrategies, page: agent.agentStrategyPage, copy: store.copyAgentStrategy, copyAction: agent.actions.copyAgStrategy, open: agent.actions.openAgStrategy, deleteAction: agent.actions.delAgStrategyOk, route: 'ag-strategy', editorName: '#ags-name' },
];

for (const c of cases) {
  test(`${c.type} strategy copy preserves independent configuration and creates unique drafts`, () => {
    const source = c.rows.find(s => s.status === 'published');
    const original = structuredClone(source);
    const firstId = c.copy(source.id), secondId = c.copy(source.id);
    const first = c.rows.find(s => s.id === firstId), second = c.rows.find(s => s.id === secondId);
    assert.notEqual(firstId, secondId);
    assert.equal(first.name, `${source.name} · 副本`);
    assert.equal(second.name, `${source.name} · 副本 2`);
    assert.equal(first.status, 'draft');
    assert.equal(first.taskCount, 0);
    assert.deepEqual(first.banks, source.banks);
    if (c.type === 'model') assert.deepEqual(first.methods, source.methods);
    else { assert.equal(first.methodId, source.methodId); assert.equal(first.attackerModelId, source.attackerModelId); }
    first.banks[0].count = 1;
    assert.deepEqual(source, original);
    assert.throws(() => c.copy(firstId), /已发布/);
  });

  test(`${c.type} published operations contain copy and drafts only expose edit and delete`, () => {
    const source = c.rows.find(s => s.status === 'published');
    router.nav('strategy', c.route);
    const id = c.copyAction(source.id), copied = c.rows.find(s => s.id === id);
    assert.equal(copied.status, 'draft', 'copy is saved even if the editor is cancelled');
    assert.equal(document.querySelector(c.editorName).value, copied.name);
    UI.closeModal();
    document.querySelector('main').innerHTML = c.page();
    const rowFor = name => [...document.querySelectorAll('main tbody tr')].find(row => row.querySelector('td button')?.textContent === name);
    const labels = row => [...row.querySelectorAll('.row-actions button')].map(b => b.textContent.trim());
    const published = rowFor(source.name), draft = rowFor(copied.name);
    assert.deepEqual(labels(published), ['详情', '复制', '删除']);
    assert.ok([...published.querySelectorAll('.row-actions button')].every(button => !button.disabled));
    assert.deepEqual(labels(draft), ['编辑', '删除']);
    assert.match(draft.querySelector('td button').getAttribute('onclick'), /edit/);
    c.open(source.id); assert.ok(document.querySelector('#drawer').classList.contains('open'));
    assert.ok([...document.querySelectorAll('#drawer button')].every(button => button.textContent.trim() !== '编辑'));
    c.open(id);
    assert.equal(document.querySelector('#drawer').classList.contains('open'), false);
    assert.ok(document.querySelector('#modal').classList.contains('open'));
    assert.equal(document.querySelector(c.editorName).value, copied.name);
    c.deleteAction(id);
    assert.equal(c.rows.some(s => s.id === id), false);
    assert.ok(c.rows.some(s => s.id === source.id));
  });
}

test('Agent draft box and legacy detail route open the editor without publishing', async () => {
  const draft = store.agentStrategies.find(s => s.status === 'draft');
  document.querySelector('main').innerHTML = agent.agentStrategyDraftsPage();
  for (const row of document.querySelectorAll('main tbody tr')) {
    assert.deepEqual([...row.querySelectorAll('.row-actions button')].map(b => b.textContent.trim()), ['编辑', '删除']);
  }
  UI.closeModal(); UI.closeDrawer();
  agent.agentStrategyDetailPage({ param: draft.id });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(document.querySelector('#drawer').classList.contains('open'), false);
  assert.equal(document.querySelector('#ags-name').value, draft.name);
  assert.equal(draft.status, 'draft');
});

test('Agent strategy may save incomplete configuration as a draft but cannot publish it', () => {
  agent.actions.newAgStrategy();
  agent.actions.agsSet('name', 'Incomplete strategy draft');
  agent.actions.agsSave(true);
  assert.equal(store.agentStrategies.some(s => s.name === 'Incomplete strategy draft'), false);
  agent.actions.agsSave(false);
  const draft = store.agentStrategies.find(s => s.name === 'Incomplete strategy draft');
  assert.equal(draft.status, 'draft');
  assert.deepEqual(draft.banks, []);
  agent.actions.editAgStrategy(draft.id);
  assert.equal(document.querySelector('#ags-name').value, draft.name);
  assert.equal(document.querySelector('#ags-method').value, '');
});

test('published strategy deletion is available from both UI types and retains the edit lock', () => {
  for (const c of cases) {
    const source = c.rows.find(strategy => strategy.status === 'published');
    const {id: ignored, ...definition} = structuredClone(source);
    const save = c.type === 'model' ? store.saveStrategy : store.saveAgentStrategy;
    const request = c.type === 'model' ? model.actions.delStrategy : agent.actions.delAgStrategy;
    const id = save({...definition, name:`Published deletion ${c.type}`});
    router.nav('strategy', c.route);
    const row = [...document.querySelectorAll('main tbody tr')].find(row => row.querySelector('td button')?.textContent === `Published deletion ${c.type}`);
    const buttons = [...row.querySelectorAll('.row-actions button')];
    assert.equal(buttons.some(button => button.textContent === '编辑'), false);
    assert.equal(save({id, name: 'Attempt to edit published strategy'}), null);
    assert.equal(c.rows.find(strategy => strategy.id === id).name, `Published deletion ${c.type}`);
    assert.ok(buttons.find(button => button.textContent === '删除').classList.contains('danger'));
    request(id);
    assert.ok(document.querySelector('#modal').classList.contains('open'));
    assert.match(document.querySelector('#modal').textContent, /待开始任务需重新选择策略/);
    c.deleteAction(id);
    assert.equal(c.rows.some(strategy => strategy.id === id), false);
    assert.equal(document.querySelector('#modal').classList.contains('open'), false);
  }
});
