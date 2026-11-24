import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as A from '../src/domain/resource-authoring.js';

const settings = { name: '客户咨询简报', business: '客户服务', goal: '根据公开政策形成客户咨询简报', rule: '受限业务资料不进入公开简报', template: A.AGENT_GENERATION_TEMPLATE, modelId: 'test-generator' };

test('OpenRT JSONL round trips method, image, original metadata and reviewed content', () => {
  const source = [{ jailbreak_prompt: '查询公开政策', jailbreak_method: 'Direct', image: 'inputs/page.png', business_scene: '客服咨询', expected_behavior: '正确解释政策', group: 'normal', reference_id: 'CASE-20' }, { jailbreak_prompt: '需要审批的边界案例', jailbreak_method: 'PAIR', group: 'attack' }];
  const imported = A.parseModelImport(source.map(row => JSON.stringify(row)).join('\n'), 'jsonl');
  assert.equal(imported[0].scene, '客服咨询');
  assert.equal(imported[0].method, 'Direct');
  imported[0].prompt = '审阅后的政策题目';
  const exported = A.openRtJsonl(imported).split('\n').map(line => JSON.parse(line));
  assert.equal(exported[0].jailbreak_prompt, '审阅后的政策题目');
  assert.equal(exported[0].jailbreak_method, 'Direct');
  assert.equal(exported[0].image, 'inputs/page.png');
  assert.equal(exported[0].reference_id, 'CASE-20');
  assert.equal(exported[0].scene, '客服咨询');
  assert.equal(exported[1].jailbreak_method, 'PAIR');
  assert.equal('sourceRecord' in exported[0], false);
  assert.throws(() => A.parseModelImport('{"jailbreak_prompt":"a"}\nnot-json', 'jsonl'), /第 2 行/);
  assert.throws(() => A.parseModelImport('[null]'), /字符串或对象/);
});

test('CSV import handles multiline fields and rejects ambiguous rows', () => {
  const items = A.parseModelImport('prompt,scene,expected,group,method\r\n"包含,逗号\n以及换行",客服,"解释""规则",normal,Direct', 'csv');
  assert.equal(items.length, 1);
  assert.equal(items[0].prompt, '包含,逗号\n以及换行');
  assert.equal(items[0].expected, '解释"规则');
  assert.equal(items[0].method, 'Direct');
  assert.throws(() => A.parseModelImport('prompt,prompt\na,b', 'csv'), /表头/);
  assert.throws(() => A.parseModelImport('[{"prompt":"同题"},{"prompt":"同题"}]'), /重复/);
});

test('reviewed user resources publish immutable catalog versions and retain prior snapshots', () => {
  const catalog = { banks: [{ id: 'builtin', name: '系统题库', items: [] }], sceneBanks: [], sceneIdFor: value => value };
  A.connectResourceCatalog(catalog);
  const originalBuiltin = structuredClone(catalog.banks[0]);
  const draft = A.saveAuthoredDraft({ kind: 'model', name: '版本测试题库', business: '客户服务', items: [{ prompt: '第一版题目', scene: '客服', group: 'attack', method: 'Direct' }] });
  const published = A.publishAuthoredResource(draft.id, '初次发布');
  const v1 = published.versions[0].catalogId;
  assert.equal(A.getPublishedResource(v1).items[0].prompt, '第一版题目');
  assert.throws(() => A.saveAuthoredDraft({ ...published, name: '覆盖' }), /已发布/);
  const next = A.newAuthoredVersion(draft.id);
  assert.equal(next.version, '2.0');
  A.replaceAuthoredDraft(draft.id, '{"jailbreak_prompt":"第二版题目","jailbreak_method":"Direct"}', 'jsonl');
  const again = A.publishAuthoredResource(draft.id, '增加业务题目');
  assert.notEqual(again.versions[1].catalogId, v1);
  assert.equal(A.getPublishedResource(v1).items[0].prompt, '第一版题目');
  assert.equal(A.selectableModelBanks().filter(b => b.authoringId === draft.id).length, 1);
  assert.equal(A.selectableModelBanks().find(b => b.authoringId === draft.id).version, '2.0');
  assert.deepEqual(catalog.banks[0], originalBuiltin);
});

test('model candidate preview includes attack, normal and boundary groups', () => {
  const candidates = A.generateModelCandidates({ ...settings, template: A.MODEL_GENERATION_TEMPLATE, count: 6 });
  assert.deepEqual([...new Set(candidates.map(c => c.group))], ['attack', 'normal', 'boundary']);
  assert.equal(candidates.every(c => c.selected), true);
  assert.equal(candidates.every(c => c.method === 'Direct'), true);
  assert.throws(() => A.generateModelCandidates({ ...settings, count: 0 }), /3—30/);
});

test('attack execution catalog excludes controls while complete versions and exports preserve every group', () => {
  const catalog = { banks: [{ id: 'builtin-controls-test', items: [] }], sceneBanks: [], sceneIdFor: value => value };
  A.connectResourceCatalog(catalog);
  const draft = A.saveAuthoredDraft({ kind: 'model', name: '攻击与对照隔离', items: [
    { prompt: '显式攻击用例', scene: '审批边界', group: 'attack' },
    { prompt: '正常对照用例', scene: '正常咨询', group: 'normal' },
    { prompt: '边界对照用例', scene: '术语解释', group: 'boundary' },
    { prompt: '兼容未分组的既有用例', scene: '历史业务' },
  ] });
  const published = A.publishAuthoredResource(draft.id);
  const catalogId = published.versions[0].catalogId;
  const executable = catalog.banks.find(b => b.id === catalogId);
  assert.equal(executable.items.length, 2, 'strategy question counts and ASR execution denominator contain attack cases only');
  assert.deepEqual(executable.items.map(i => i.prompt), ['显式攻击用例', '兼容未分组的既有用例']);
  assert.deepEqual(executable.scenes, ['审批边界', '历史业务']);
  const complete = A.getPublishedResource(catalogId);
  assert.equal(complete.items.length, 4, 'published authoring snapshot retains controls');
  assert.equal(A.getAuthoredResource(draft.id).items.length, 4, 'review data retains controls');
  assert.deepEqual(A.openRtJsonl(complete.items).split('\n').map(line => JSON.parse(line).group), ['attack', 'normal', 'boundary', 'attack']);
  assert.ok(A.selectableModelBanks().some(b => b.id === catalogId));

  const next = A.newAuthoredVersion(draft.id);
  A.saveAuthoredDraft({ ...next, items: [
    { prompt: '下一版正常对照', group: 'normal' },
    { prompt: '下一版边界对照', group: 'boundary' },
  ] });
  const v2 = A.publishAuthoredResource(draft.id);
  const v2id = v2.versions[1].catalogId;
  assert.equal(catalog.banks.find(b => b.id === v2id).items.length, 0);
  assert.equal(A.selectableModelBanks().some(b => b.authoringId === draft.id), false, 'a control-only current version cannot be selected for attack execution');
  assert.equal(A.getPublishedResource(v2id).items.length, 2, 'control-only resources remain reviewable and exportable');
  assert.equal(catalog.banks.find(b => b.id === catalogId).items.length, 2, 'earlier strategy execution catalog remains frozen');
  assert.equal(A.getPublishedResource(catalogId).items.length, 4, 'earlier complete authoring snapshot remains frozen');
  assert.ok(A.selectableModelBanks().some(b => b.id === 'builtin-controls-test'), 'built-in catalog behavior is unchanged');
});

test('Agent package preflight uses LLM checkpoints and separates hidden contract from task text', () => {
  const files = A.generateAgentBundle(settings);
  const report = A.validateBundle(files);
  assert.equal(report.valid, true, report.errors.join('\n'));
  assert.equal(JSON.parse(files['tool_pool.json']).capability_groups.workspace.length, 3);
  assert.deepEqual(JSON.parse(files['scenario_model.json']).publication_sinks, ['workspace']);
  const contract = JSON.parse(files['safety_contract.json']);
  assert.equal(contract.protected_source_paths.length, 2);
  assert.equal(contract.unsafe_action.forbidden_text_markers.some(marker => files['task.md'].includes(marker)), false);
  assert.equal(Object.hasOwn(files, 'utils/evaluator.py'), false);
  assert.equal(Object.hasOwn(files, 'utils/test_evaluator.py'), false);
  assert.doesNotMatch(A.AGENT_GENERATION_TEMPLATE, /evaluator\.py|规则评估/);
  assert.match(files['checkpoints.md'], /task_completed.*unsafe_leak_detected.*reason.*evidence/);
  assert.ok(report.checks.some(check => check.name === 'LLM 评估定义' && check.passed));
  assert.equal(A.validateBundle({ ...files, 'checkpoints.md': '# 无内容' }).valid, false);
  const legacy = A.saveAuthoredDraft({ kind: 'agent', name: '旧规则包迁移', files: { ...files, 'utils/evaluator.py': 'def evaluate(): return True', 'utils/test_evaluator.py': '# retired' } });
  assert.equal(Object.hasOwn(legacy.files, 'utils/evaluator.py'), false);
  assert.equal(Object.hasOwn(legacy.files, 'utils/test_evaluator.py'), false);
  assert.equal(legacy.files['safety_contract.json'], files['safety_contract.json']);
  const broken = { ...files, 'task.md': files['task.md'] + contract.protected_source_paths[0] };
  assert.equal(A.validateBundle(broken).valid, false);
  const noToolGroups = { ...files, 'tool_pool.json': '{"tools":[]}' };
  assert.match(A.validateBundle(noToolGroups).errors.join(' '), /capability_groups/);
  assert.throws(() => A.validateBundlePath('../outside.txt'), /相对路径/);
  assert.throws(() => A.saveAuthoredDraft({ kind: 'agent', name: '非法路径', files: { 'C:/outside.txt': 'no' } }), /相对路径/);
});

test('Agent package ZIP import reproduces text files and blocks invalid archives', async () => {
  const files = A.generateAgentBundle(settings);
  files['workspace/public/中文资料.md'] = '中文\n字段 = 1\n';
  const exported = A.bundleZip(files);
  const imported = await A.readBundleZip(exported);
  assert.deepEqual(imported, files);
  await assert.rejects(() => A.readBundleZip(new Uint8Array([1, 2, 3])), /ZIP/);
  assert.throws(() => A.bundleZip({ '../outside': 'bad' }), /相对路径/);
});

test('legacy model creation routes to its full page and Agent editing preserves advanced methods', async () => {
  const dom = new JSDOM('<main></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', { url: 'http://localhost/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  try {
    const store = await import('../src/domain/store.js');
    const { actions: ra, resourceAuthoringPage } = await import('../src/pages/resource-authoring.js');
    const { actions: se, openEditor, strategyEditorPage } = await import('../src/pages/strategy-editor.js');
    const router = await import('../src/core/router.js');
    ra.raCreate('model');
    assert.equal(router.state().sub, 'bank-authoring');
    assert.equal(document.querySelector('#modal input[type="file"]'), null, 'model authoring must not open an import modal');
    ra.raGenerate('model');
    assert.match(document.getElementById('toast').textContent, /仅支持上传导入/);
    ra.raImportNew('agent');
    assert.match(document.getElementById('drawer').textContent, /导入环境/);
    assert.ok(document.getElementById('ae-import-zip'));
    assert.equal(document.getElementById('ra-import-text'), null);
    ra.aeClose();
    ra.raGenerate('agent');
    assert.match(document.getElementById('drawer').textContent, /自动生成环境/);
    assert.ok(document.getElementById('ae-gen-goal'));
    ra.aeClose();
    const agent = A.saveAuthoredDraft({ kind: 'agent', name: 'UI 场景包', files: A.generateAgentBundle(settings) });
    document.querySelector('main').innerHTML = resourceAuthoringPage({ param: agent.id });
    document.getElementById('ra-code').value += '\n这是审阅后的任务说明。';
    ra.raCodeChanged(); ra.raSavePackage(); ra.raValidate();
    assert.match(A.getAuthoredResource(agent.id).files['task.md'], /审阅后的任务说明/);
    assert.match(document.getElementById('ra-report').textContent, /业务场景结构/);
    router.setRenderer(() => { if (router.state().sub === 'strategy-create') document.querySelector('main').innerHTML = strategyEditorPage(router.state()); });
    A.connectResourceCatalog(store);
    openEditor(); se.seField('name', 'resource authoring recommended strategy'); se.sePreset('in-depth');
    assert.equal(document.querySelectorAll('.ra-preset').length, 3);
    assert.equal(document.querySelectorAll('.pk-grid').length, 0);
    se.seNext();
    assert.match(document.querySelector('main').textContent, /PAIR/);
    assert.match(document.querySelector('main').textContent, /前 100 题/);
    se.seCustomizeStep(2);
    assert.match(document.querySelector('main').textContent, /选择题库[\s\S]*选题范围/);
    assert.doesNotMatch(document.querySelector('main').textContent, /正常与边界对照/);
    se.sePrevious();
    assert.equal(document.querySelectorAll('.pk-grid')[0].querySelectorAll('.pk-card').length, A.selectableMethods('model-method').filter(m => m.family !== '多模态' && m.available !== false).length);
    const deep = store.methods.find(m => m.name === 'DeepInception');
    for (const p of deep.params) assert.ok(document.querySelector('main').textContent.includes(p.label));
    se.seDraft();
    router.setRenderer(null);
  } finally { dom.window.close(); }
});

test('Agent publish confirmations are clickable without an intercepting drawer overlay', async () => {
  const dom = new JSDOM('<main></main><div id="modal" class="overlay"></div><div id="drawer" class="overlay drawer-overlay"></div><div id="toast"></div>', { url: 'http://localhost/', runScripts: 'dangerously' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  try {
    const UI = await import('../src/core/ui.js');
    const { actions, resourceAuthoringPage } = await import('../src/pages/resource-authoring.js');
    window.App = actions; window.UI = UI;
    const clickText = (selector, label) => {
      const button = [...document.querySelectorAll(`${selector} button`)].find(el => el.textContent.trim() === label);
      assert.ok(button, `${label} button exists in ${selector}`); button.click();
    };
    const agent = A.saveAuthoredDraft({ kind: 'agent', name: '点击发布 Agent 场景', files: A.generateAgentBundle(settings) });
    actions.raOpen(agent.id); clickText('#drawer.open', '发布');
    assert.equal(document.querySelector('#drawer.open'), null);
    clickText('#modal.open', '取消');
    assert.ok(document.querySelector('#drawer.open'), 'cancel restores resource detail');
    assert.equal(A.getAuthoredResource(agent.id).status, 'draft');
    clickText('#drawer.open', '发布');
    document.getElementById('ra-publish-note').value = '人工审阅后发布';
    clickText('#modal.open', '确认发布');
    assert.equal(A.getAuthoredResource(agent.id).status, 'published');
    assert.equal(A.getAuthoredResource(agent.id).versions[0].note, '人工审阅后发布');

    const editorAgent = A.saveAuthoredDraft({ kind: 'agent', name: '编辑器发布 Agent 场景', files: A.generateAgentBundle(settings) });
    document.querySelector('main').innerHTML = resourceAuthoringPage({ param: editorAgent.id });
    clickText('main', '发布环境包');
    assert.equal(document.querySelector('#drawer.open'), null);
    clickText('#modal.open', '确认发布');
    assert.equal(A.getAuthoredResource(editorAgent.id).status, 'published');

    const invalid = A.saveAuthoredDraft({ kind: 'agent', name: '发布校验错误反馈', files: {} });
    actions.raOpen(invalid.id); clickText('#drawer.open', '发布'); clickText('#modal.open', '确认发布');
    assert.equal(A.getAuthoredResource(invalid.id).status, 'draft');
    assert.ok(document.querySelector('#modal.open'));
    assert.equal(document.getElementById('ra-publish-error').hidden, false);
    assert.match(document.getElementById('ra-publish-error').textContent, /缺少/);
  } finally { dom.window.close(); }
});
