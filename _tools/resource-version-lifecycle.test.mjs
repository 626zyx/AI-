import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<main></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const store = await import('../src/domain/store.js');
const resources = await import('../src/domain/resource-authoring.js');
const authoring = await import('../src/pages/resource-authoring.js');
const editor = await import('../src/pages/strategy-editor.js');
const router = await import('../src/core/router.js');
router.setRenderer(() => { if (router.state().sub === 'strategy-create') document.querySelector('main').innerHTML = editor.strategyEditorPage(router.state()); });
const UI = await import('../src/core/ui.js');
const modelMethods = await import('../src/pages/library.js');
const agentMethods = await import('../src/pages/agent-methods.js');
const { releaseLabel } = await import('../src/domain/strategy-service.js');
after(() => dom.window.close());

test('model question examples are removed while Agent and method seeds remain available', () => {
  assert.deepEqual(resources.listAuthoredResources('model'), []);
  for (const kind of ['agent', 'model-method', 'agent-method']) {
    const rows = resources.listAuthoredResources(kind);
    assert.ok(rows.some(row => row.status === 'published'), `${kind}: published resource`);
    if (!resources.isMethodResource(kind)) assert.ok(rows.some(row => row.status === 'draft'), `${kind}: editable draft`);
  }
});

test('model and Agent method revisions preserve the old template and select the new release', () => {
  for (const kind of ['model-method', 'agent-method']) {
    const original = resources.listAuthoredResources(kind).find(row => row.status === 'published');
    const first = original.versions[0];
    const draft = resources.newAuthoredVersion(original.id);
    resources.saveAuthoredDraft({ ...draft, template: `${draft.template}\n修订上下文` });
    const second = resources.publishAuthoredResource(original.id, '修订模板');
    assert.equal(releaseLabel(second.version), 'V2');
    assert.equal(resources.getPublishedResource(first.catalogId).template, first.template);
    assert.equal(resources.selectableMethods(kind).filter(method => method.authoringId === original.id).length, 1);
    assert.match(resources.selectableMethods(kind).find(method => method.authoringId === original.id).template, /修订上下文/);
    assert.throws(() => resources.saveAuthoredDraft({ ...second, template: '覆盖已发布内容' }), /已发布/);
  }
});

test('Agent strategy families reuse pending revisions and preserve previous published configurations', () => {
  for (const [rows, createVersion, save] of [
    [store.agentStrategies, store.newAgentStrategyVersion, store.saveAgentStrategy],
  ]) {
    const original = rows.find(row => row.source === 'custom' && row.status === 'published');
    const before = structuredClone(original);
    const id = createVersion(original.id);
    assert.equal(createVersion(original.id), id);
    const draft = rows.find(row => row.id === id);
    assert.equal(draft.familyId, original.familyId);
    assert.equal(releaseLabel(draft.version), 'V2');
    save({ ...draft, desc: '独立发布的新版本', status: 'published' });
    assert.deepEqual(original, before);
  }
});

test('presets use fixed parameters and the full method list opens only after customization', () => {
  editor.openEditor();
  editor.actions.seField('name', 'fixed parameters strategy');
  assert.equal(document.querySelectorAll('[onchange*="seMethod"]').length, 0);
  editor.actions.sePreset('in-depth');
  assert.equal(document.querySelectorAll('[id^="se-p-"]').length, 0);
  editor.actions.seSet('mOpen', true);
  assert.ok(document.querySelectorAll('[onchange*="seMethod"]').length > 0);
  editor.actions.seDraft();
});

test('method catalogs and direct UI actions expose read-only methods', () => {
  assert.doesNotMatch(modelMethods.methodsPage(), /新建攻击方法|raCreate\('model-method'\)/);
  assert.doesNotMatch(agentMethods.agentMethodsPage(), /新建攻击方法|raCreate\('agent-method'\)/);
  for (const kind of ['model-method', 'agent-method']) {
    UI.closeModal(); UI.closeDrawer();
    const before = resources.listAuthoredResources(kind);
    const published = before.find(row => row.status === 'published');
    authoring.actions.raCreate(kind);
    authoring.actions.raGenerate(kind);
    authoring.actions.raImportNew(kind);
    authoring.actions.raMethodEdit(published.id);
    authoring.actions.raMethodSave(true);
    authoring.actions.raNewVersion(published.id);
    authoring.actions.raPublish(published.id);
    assert.equal(document.getElementById('modal').classList.contains('open'), false);
    assert.deepEqual(resources.listAuthoredResources(kind), before);
    authoring.actions.raOpen(published.id);
    assert.doesNotMatch(document.getElementById('drawer').textContent, /编辑模板|创建新版本|导入覆盖草稿/);
  }
});
