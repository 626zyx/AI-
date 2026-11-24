import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as store from '../src/domain/store.js';
import * as resources from '../src/domain/resource-authoring.js';
const dom = new JSDOM('<main></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', { url: 'http://localhost/' });
globalThis.window = dom.window; globalThis.document = dom.window.document;
const page = await import('../src/pages/strategy.js');
const editor = await import('../src/pages/strategy-editor.js');
const router = await import('../src/core/router.js');
router.setRenderer(() => { document.querySelector('main').innerHTML = router.state().sub === 'strategy-create' ? editor.strategyEditorPage(router.state()) : page.attackStrategyPage(); });
after(() => dom.window.close());
const config = { banks: [{ bankId: 'bank-advbench', count: 5 }], methods: [{ name: 'Direct', order: 1, params: [] }] };

test('model combination strategy progresses from editable draft to immutable publication without a version', () => {
  const id = store.saveStrategy({ name: 'simple lifecycle model policy', status: 'draft' });
  assert.equal(store.strategies.find(row => row.id === id).status, 'draft');
  store.saveStrategy({ id, ...config, name: 'simple lifecycle model policy', status: 'published', version: '9.0', familyId: 'forged-family' });
  const published = structuredClone(store.strategies.find(row => row.id === id));
  assert.equal('version' in published, false);
  assert.equal('familyId' in published, false);
  assert.throws(() => store.saveStrategy({ id, name: 'overwritten', status: 'draft' }), /已发布.*不可修改/);
  const copiedId = store.copyStrategy(id);
  const copied = store.strategies.find(row => row.id === copiedId);
  assert.equal(copied.status, 'draft');
  assert.equal('version' in copied, false);
  assert.equal('familyId' in copied, false);
  assert.deepEqual(copied.methods, published.methods);
  assert.throws(() => store.copyStrategy(copiedId), /仅已发布/);
  store.saveStrategy({ ...copied, desc: 'independent changes', methods: [] });
  assert.deepEqual(store.strategies.find(row => row.id === id), published);
  store.deleteStrategy(copiedId);
  assert.throws(() => store.newStrategyVersion(id), /不维护版本/);
  assert.deepEqual(store.strategies.find(row => row.id === id), published);
  store.deleteStrategy(id);
});

test('model list and details allow published copying without versions and disable used deletion', () => {
  const id = store.saveStrategy({ ...config, name: 'unused published UI model strategy', status: 'published' });
  document.querySelector('main').innerHTML = page.attackStrategyPage();
  assert.doesNotMatch(document.querySelector('main').textContent, /版本|待发布/);
  const rows = [...document.querySelectorAll('tbody tr')];
  const own = rows.find(row => row.textContent.includes('unused published UI model strategy'));
  assert.deepEqual([...own.querySelectorAll('.row-actions button')].map(button => button.textContent), ['详情', '复制配置', '删除']);
  assert.equal(own.querySelectorAll('.row-actions button')[2].disabled, false);
  const used = rows.find(row => row.textContent.includes('AdvBench 基线四方法'));
  assert.equal(used.querySelectorAll('.row-actions button')[2].disabled, true);
  page.actions.openStrategy(id);
  assert.doesNotMatch(document.getElementById('drawer').textContent, /版本/);
  assert.match(document.getElementById('drawer').textContent, /复制配置/);
  assert.equal(page.actions.sgVersions, undefined);
  assert.equal(page.actions.sgNewVersion, undefined);
  assert.equal(typeof page.actions.copyStrategy, 'function');
  store.deleteStrategy(id);
});

test('published combination strategy keeps its bank release when a new bank version is published', () => {
  resources.connectResourceCatalog(store);
  const draft = resources.saveAuthoredDraft({ kind: 'model', name: 'bank releases for model strategy', business: '通用', items: [{ prompt: 'first release question', scene: '业务安全', group: 'attack' }] });
  const published = resources.publishAuthoredResource(draft.id);
  const firstId = published.versions[0].catalogId;
  const id = store.saveStrategy({ ...config, name: 'bank pinned combination', banks: [{ bankId: firstId, count: 1 }], status: 'published' });
  const strategy = structuredClone(store.strategies.find(row => row.id === id));
  const next = resources.newAuthoredVersion(draft.id);
  resources.saveAuthoredDraft({ ...next, items: [{ prompt: 'new release question', scene: '业务安全', group: 'attack' }] });
  resources.publishAuthoredResource(draft.id);
  assert.deepEqual(store.strategies.find(row => row.id === id), strategy);
  assert.equal(store.getBank(firstId).items[0].prompt, 'first release question');
  const taskId = store.saveTask({ objectType: 'model', targetId: 'mdl-qwen-flash', judgeId: 'mdl-deepseek-flash', strategyId: id, name: 'pinned bank task' });
  assert.equal(store.getTask(taskId).configSnapshot.banks[0].bankId, firstId);
});

test('model editor starts fresh, saves an incomplete draft and surfaces publication validation', () => {
  editor.openEditor();
  editor.actions.seField('name', 'model editor fresh draft');
  editor.actions.sePublish();
  assert.equal(store.strategies.some(row => row.name === 'model editor fresh draft'), false);
  editor.actions.seDraft();
  const draft = store.strategies.find(row => row.name === 'model editor fresh draft');
  assert.equal(draft.status, 'draft');
  assert.equal('version' in draft, false);
  editor.openEditor(draft.id);
  assert.equal(document.getElementById('se-name').value, draft.name);
  assert.doesNotMatch(document.getElementById('modal').textContent, /创建新版本|首次发布|V1/);
  store.deleteStrategy(draft.id);
});
