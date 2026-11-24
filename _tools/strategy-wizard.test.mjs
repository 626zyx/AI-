import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<main id="app-main"></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document });
const store = await import('../src/domain/store.js');
const resources = await import('../src/domain/resource-authoring.js');
const { initializeAssetBridge } = await import('../src/domain/asset-bridge.js');
const { listPickerResources } = await import('../src/core/resource-picker.js');
const editor = await import('../src/pages/strategy-editor.js');
const page = await import('../src/pages/strategy.js');
const router = await import('../src/core/router.js');
resources.connectResourceCatalog(store);
initializeAssetBridge();
router.setRenderer(() => { document.querySelector('main').innerHTML = router.state().sub === 'strategy-create' ? editor.strategyEditorPage(router.state()) : page.attackStrategyPage(); });
after(() => dom.window.close());
const se = editor.actions;
const activeStep = () => [...document.querySelectorAll('.sa-steps li')].findIndex(li => li.classList.contains('active'));

test('recommendations preserve methods and question counts while requiring explicit auxiliary models', () => {
  const plans = [
    ['baseline', ['Direct'], 120],
    ['variants', ['Jailbroken', 'CipherChat', 'CodeAttack', 'DeepInception'], 50],
    ['in-depth', ['DeepInception', 'ReNeLLM', 'PAIR', 'Crescendo'], 100],
  ];
  for (const [id, methods, count] of plans) {
    editor.openEditor();
    assert.equal(activeStep(), 0);
    assert.equal(document.querySelectorAll('.sa-preset').length, 3);
    assert.equal(document.querySelector('.pk'), null);
    assert.equal(document.querySelector('[id^="se-p-"]'), null);
    assert.match(document.querySelector('main').textContent, /需要更灵活的测试？自定义方法组合 →/);
    se.seField('name', `wizard preset ${id}`);
    se.sePreset(id); se.seNext();
    assert.equal(activeStep(), 3);
    assert.match(document.querySelector('main').textContent, new RegExp(`前 ${count} 题`));
    for (const name of methods) assert.match(document.querySelector('main').textContent, new RegExp(name));
    const roles = methods.flatMap((name, index) => ['generator', 'process'].filter(key => store.methods.find(row => row.name === name)[key]).map(key => ({ index, key })));
    for (const { index, key } of roles) {
      const control = document.getElementById(`se-${index}-${key}`);
      assert.equal(control.value, '');
      assert.equal(control.textContent, '+ 配置模型');
    }
    if (roles.length) {
      se.sePublish();
      assert.equal(store.strategies.some(row => row.name === `wizard preset ${id}`), false);
      assert.match(document.querySelector('.sa-error').textContent, /选择可用的/);
      const selected = listPickerResources('model').find(row => row.status === 'connected');
      for (const { index, key } of roles) se.seAux(index, key, selected.id);
    }
    se.sePublish();
    const saved = store.strategies.find(row => row.name === `wizard preset ${id}`);
    assert.equal(saved.status, 'published');
    assert.deepEqual(saved.methods.map(method => method.name), methods);
    assert.equal(saved.banks[0].count, count);
    for (const method of saved.methods) {
      const def = store.methods.find(row => row.name === method.name);
      for (const param of def.params) assert.equal(method.params.find(([label]) => label === param.label)?.[1], param.value);
      for (const key of ['generator', 'process']) if (def[key]) assert.ok(listPickerResources('model').some(row => row.id === method.aux[key] && row.status === 'connected'));
    }
  }
});

test('custom methods start with empty model roles and draft save never fills them implicitly', () => {
  editor.openEditor(); se.seField('name', 'explicit model choice draft'); se.seCustom();
  se.seMethod('GPTFuzzer', true);
  for (const key of ['generator', 'process']) {
    const control = document.getElementById(`se-0-${key}`);
    assert.equal(control.value, '');
    assert.match(control.textContent, /\+ 配置模型/);
  }
  se.seDraft();
  const draft = store.strategies.find(row => row.name === 'explicit model choice draft');
  assert.deepEqual(draft.methods[0].aux, { generator: '', process: '' });
  assert.throws(() => store.saveStrategy({ ...draft, status: 'published', banks: [{ bankId: 'bank-advbench', count: 5 }] }), /选择可用的攻击生成模型/);
  const selected = listPickerResources('model').find(row => row.status === 'connected');
  assert.throws(() => store.saveStrategy({ ...draft, status: 'published', banks: [{ bankId: 'bank-advbench', count: 5 }], methods: [{ ...draft.methods[0], aux: { generator: selected.id, process: 'missing-model' } }] }), /选择可用的过程裁判/);
  editor.openEditor(draft.id);
  se.seToggle('methods', 0);
  assert.equal(document.getElementById('se-0-generator').value, '');
  assert.equal(document.getElementById('se-0-process').value, '');
  se.seCancel();
});

test('custom selection follows all four steps and a draft resumes at its saved step', () => {
  editor.openEditor(); se.seField('name', 'wizard custom resume'); se.seField('desc', 'persist all custom inputs');
  se.seCustom(); assert.equal(activeStep(), 1);
  se.seMethod('Direct', true); se.seNext(); assert.equal(activeStep(), 2);
  se.seBank('bank-advbench', true); se.seBankAll(0, false); se.seBankN(0, 17); se.seDraft();
  const draft = store.strategies.find(row => row.name === 'wizard custom resume');
  assert.equal(draft.authoringStep, 2); assert.equal(draft.banks[0].count, 17);
  editor.openEditor(draft.id); assert.equal(activeStep(), 2);
  assert.equal(document.querySelector('.se-n').value, '17');
  se.seNext(); assert.equal(activeStep(), 3); se.sePublish();
  const published = structuredClone(store.strategies.find(row => row.id === draft.id));
  router.nav('strategy', 'strategy-create', published.id);
  assert.match(document.querySelector('main').textContent, /组合攻击策略详情/);
  assert.equal(document.querySelector('[onclick="App.sePublish()"]'), null);
  se.seField('name', 'cannot alter publication'); se.seDraft();
  assert.deepEqual(store.strategies.find(row => row.id === published.id), published);
  router.nav('strategy', 'attack');
  const copiedId = page.actions.copyStrategy(published.id);
  assert.equal(router.state().param, copiedId); assert.equal(activeStep(), 0);
  assert.match(document.getElementById('se-name').value, /副本/);
  assert.throws(() => store.copyStrategy(copiedId), /仅已发布/);
  const copy = store.strategies.find(row => row.id === copiedId);
  assert.deepEqual(copy.banks, published.banks); assert.notEqual(copy.banks, published.banks);
  assert.equal('version' in copy, false); assert.equal('familyId' in copy, false);
  se.seCancel();
});

test('navigation guard can continue, discard, or save a partially configured strategy', () => {
  editor.openEditor(); se.seField('name', 'wizard discard guard');
  se.seCancel(); assert.equal(router.state().sub, 'strategy-create');
  assert.match(document.getElementById('modal').textContent, /保存策略更改/);
  se.seBack(); assert.equal(router.state().sub, 'strategy-create');
  editor.openEditor(); assert.equal(document.getElementById('se-name').value, 'wizard discard guard');
  se.seCancel(); se.seLeave(false);
  assert.equal(router.state().sub, 'attack');
  assert.equal(store.strategies.some(row => row.name === 'wizard discard guard'), false);
  editor.openEditor(); se.seField('name', 'wizard save guard');
  router.nav('platform', 'intake'); se.seLeave(true);
  assert.equal(router.state().page, 'platform');
  const saved = store.strategies.find(row => row.name === 'wizard save guard');
  assert.equal(saved.status, 'draft'); assert.deepEqual(saved.methods, []);
  editor.openEditor(saved.id); assert.equal(document.getElementById('se-name').value, saved.name); se.seCancel();
});
