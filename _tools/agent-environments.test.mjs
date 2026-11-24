import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as E from '../src/domain/agent-environments.js';
import { bundleZip, readBundleZip } from '../src/domain/resource-authoring.js';

test('environment library exposes exactly five immutable published environments with LLM definitions', () => {
  const questions = E.getAgentQuestions();
  assert.deepEqual(questions.map(q => q.taskId), ['openart-mid-000023','openart-mid-000041','openart-mid-000055','openart-mid-000150','openart-mid-000160']);
  for (const q of questions) {
    assert.equal(q.business, '业务交付与保密');
    assert.equal(q.contentMode, 'sanitized-demo');
    assert.equal(q.hasLlm, true);
    assert.equal(Object.hasOwn(q, 'hasRule'), false);
    assert.equal(Object.hasOwn(q, 'ruleDefinition'), false);
    assert.equal(Object.hasOwn(q.files, 'utils/evaluator.py'), false);
    assert.equal(E.checkAgentQuestion(q).valid, true);
    assert.throws(() => E.saveAgentQuestion({ ...q, title: '覆盖' }), /只读/);
    assert.throws(() => E.deleteAgentQuestion(q.id), /不可删除/);
  }
  questions[0].files['task.md'] = 'mutated';
  assert.notEqual(E.getAgentQuestion(questions[0].id).files['task.md'], 'mutated');
});

test('publication requires LLM definitions and sandbox checks; copies stay independent and published snapshots are read-only', async () => {
  const original = E.getAgentQuestions()[0], draft = E.copyAgentQuestion(original.id);
  assert.equal(E.getAgentQuestions().some(q => q.id === draft.id), false);
  const withoutLlm = { ...draft.files, 'checkpoints.md': '# 空定义' };
  E.saveAgentQuestion({ ...draft, files: withoutLlm });
  assert.throws(() => E.publishAgentQuestion(draft.id), /LLM|checkpoints/);
  const saved = E.saveAgentQuestion({ ...draft, files: { ...draft.files, 'utils/evaluator.py': '# 不再支持的规则评估定义' }, hasRule: true, ruleDefinition: { path: 'utils/evaluator.py' } });
  assert.equal(Object.hasOwn(saved.files, 'utils/evaluator.py'), false);
  assert.equal(Object.hasOwn(saved, 'ruleDefinition'), false);
  assert.equal(E.checkAgentQuestion(saved).checks.some(check => check.name === '规则评估定义'), false);
  assert.throws(() => E.publishAgentQuestion(draft.id), /可运行性检查/);
  await E.validateAgentQuestionSandbox(draft.id, { delay: 0 });
  const published = E.publishAgentQuestion(draft.id);
  assert.equal(E.getAgentQuestions().some(q => q.id === draft.id), true);
  assert.equal(E.getAgentQuestions({status:'draft'}).some(q => q.id === draft.id), false);
  assert.equal(published.validation.runtime, 'demo_passed');
  assert.equal(published.validation.sandbox.actualExecuted, false);
  assert.throws(() => E.saveAgentQuestion(published), /只读/);
  assert.deepEqual(E.getAgentQuestion(original.id).files, original.files);
  E.deleteAgentQuestion(draft.id);
});

test('single-environment ZIP template round trips without rule evaluators and still enforces LLM checkpoints', async () => {
  const bytes = E.agentEnvironmentTemplateZip(), files = await readBundleZip(bytes);
  assert.ok(files['task.md']); assert.ok(files['checkpoints.md']);
  assert.ok(files['workspace/public/brief.md']); assert.ok(files['safety_contract.json']);
  assert.equal(Object.hasOwn(files, 'utils/evaluator.py'), false);
  const imported = await E.importAgentZip(bytes);
  try {
    assert.equal(imported.length, 1);
    assert.equal(imported[0].status, 'draft');
    assert.equal(E.checkAgentQuestion(imported[0]).valid, true);
    const missingLlm = { ...imported[0], files: { ...imported[0].files } };
    delete missingLlm.files['checkpoints.md'];
    E.saveAgentQuestion(missingLlm);
    assert.throws(() => E.publishAgentQuestion(imported[0].id), /checkpoints/);
  } finally { imported.forEach(q => E.deleteAgentQuestion(q.id)); }
});

test('legacy rule evaluator imports retire executable definitions while preserving safety boundaries', async () => {
  const example = E.agentEnvironmentTemplate().questions[0];
  const legacy = { ...example.files, 'utils/evaluator.py': 'def evaluate(): return True', 'metadata.json': JSON.stringify({ title: '旧环境', riskLabels: ['internal'], hasRule: true, ruleDefinition: { kind: 'rule', path: 'utils/evaluator.py' } }) };
  const imported = await E.importAgentZip(bundleZip(legacy));
  try {
    assert.equal(imported[0].files['safety_contract.json'], example.files['safety_contract.json']);
    assert.equal(Object.hasOwn(imported[0].files, 'utils/evaluator.py'), false);
    assert.equal(Object.hasOwn(JSON.parse(imported[0].files['metadata.json']), 'ruleDefinition'), false);
    const exported = await readBundleZip(E.exportAgentQuestionZip(imported[0].id));
    assert.equal(Object.hasOwn(exported, 'utils/evaluator.py'), false);
    assert.equal(Object.hasOwn(JSON.parse(exported['environment.json']), 'hasRule'), false);
    await E.validateAgentQuestionSandbox(imported[0].id, { delay: 0 });
    assert.equal(E.publishAgentQuestion(imported[0].id).status, 'published');
  } finally { imported.forEach(q => E.deleteAgentQuestion(q.id)); }
});

test('multi-task ZIP import preserves roots and labels and publishes only after review', async () => {
  const example = E.agentEnvironmentTemplate().questions[0];
  const files = Object.fromEntries(['a','b'].flatMap(root => Object.entries({ ...example.files, 'environment.json': JSON.stringify({ title: `题目${root}`, riskLabels:['internal'], business:'采购' }) }).map(([path,text]) => [`tasks/${root}/${path}`,text])));
  const imported = await E.importAgentZip(bundleZip(files));
  assert.equal(imported.length, 2);
  assert.deepEqual(imported.map(q => q.title), ['题目a','题目b']);
  assert.equal(imported.every(q => q.status === 'draft' && q.files['task.md']), true);
  const roundtrip = await readBundleZip(E.exportAgentQuestionZip(imported[0].id));
  assert.equal(JSON.parse(roundtrip['environment.json']).title, '题目a');
  assert.throws(() => E.importAgentQuestions({questions:[{files:{'../escape':'no'}}]}), /相对路径/);
  assert.equal(E.getAgentQuestions().length, 5);
  imported.forEach(q => E.deleteAgentQuestion(q.id));
});

test('single environment and 100-environment batch navigation keep edits, file operations and publication explicit', async () => {
  const dom = new JSDOM('<main></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', {url:'http://localhost/'});
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  const drafts = E.createAgentDemoDrafts({ title:'导航测试', goal:'整理资料并交付摘要', count:100, business:'测试业务', riskLabels:['internal'], modelId:'demo-model' });
  try {
    const { agentEnvironmentEditorPage: render, agentEnvironmentActions: actions } = await import('../src/pages/agent-environment-editor.js');
    const { sceneBanksPage } = await import('../src/pages/scene-banks.js');
    document.querySelector('main').innerHTML = sceneBanksPage();
    assert.deepEqual([...document.querySelectorAll('thead th')].slice(1).map(node => node.textContent.trim()), ['环境名称','来源','业务类型','风险场景','状态','更新时间','操作']);
    assert.ok(document.querySelector('thead input[aria-label="全选当前页"]'));
    assert.equal(actions.aePublishDrafts, undefined, 'each draft must be reviewed and confirmed separately');
    assert.equal(document.querySelectorAll('tbody tr').length, 5);
    const router = await import('../src/core/router.js');
    router.setRenderer(() => { const current = router.state(); document.querySelector('main').innerHTML = current.sub === 'authoring' ? render(current) : sceneBanksPage(); });
    actions.aeOpen(drafts[0].id);
    assert.equal(document.querySelectorAll('.ae-question').length, 0);
    actions.aeOpenBatch(drafts.map(q => q.id));
    assert.equal(document.querySelectorAll('.ae-question').length, 100);
    actions.aeQuestionSearch('导航测试 100');
    assert.equal(document.querySelectorAll('.ae-question').length, 1);
    actions.aeCode('# 已审阅的业务任务'); actions.aeSave();
    assert.equal(E.getAgentQuestion(drafts[0].id).files['task.md'], '# 已审阅的业务任务');
    actions.aeFileDialog(); document.getElementById('ae-file-path').value = 'workspace/public/new.txt'; actions.aeFileConfirm(false);
    actions.aeCode('新增文本'); actions.aeSave();
    assert.equal(E.getAgentQuestion(drafts[0].id).files['workspace/public/new.txt'], '新增文本');
    actions.aeFileDialog(true); document.getElementById('ae-file-path').value = 'workspace/public/renamed.txt'; actions.aeFileConfirm(true); actions.aeSave();
    assert.equal(E.getAgentQuestion(drafts[0].id).files['workspace/public/renamed.txt'], '新增文本');
    actions.aeDeleteFileConfirm(); actions.aeSave();
    assert.equal(Object.hasOwn(E.getAgentQuestion(drafts[0].id).files, 'workspace/public/renamed.txt'), false);
    actions.aeUploadDialog();
    const bytes = new TextEncoder().encode('上传资料');
    await actions.aeUploadFiles({ files: [{ name: 'uploaded.txt', size: bytes.length, arrayBuffer: async () => bytes.buffer }] });
    actions.aeSave();
    assert.equal(E.getAgentQuestion(drafts[0].id).files['workspace/uploads/uploaded.txt'], '上传资料');
    actions.aeCode('切换前的未保存内容');
    actions.aeSwitch(drafts[99].id);
    assert.equal(router.state().param, drafts[0].id, 'dirty navigation waits for save decision');
    actions.aeLeave(true);
    assert.equal(router.state().param, drafts[99].id, 'can jump directly to question 100');
    assert.equal(E.getAgentQuestion(drafts[0].id).files['workspace/uploads/uploaded.txt'], '切换前的未保存内容');
    actions.aeSwitch(drafts[0].id);
    actions.aePublish(drafts[0].id);
    assert.equal(E.getAgentQuestion(drafts[0].id).status, 'draft', 'opening confirmation must not publish');
    assert.ok(document.querySelector('.ae-validation-workspace'));
    assert.equal(document.querySelector('#modal.open'), null);
    await actions.aeRunSandbox({ delay: 0 });
    actions.aePublishConfirm();
    document.querySelector('main').innerHTML = render({param:drafts[0].id});
    assert.equal(document.getElementById('ae-code').readOnly, true);
    assert.equal(E.getAgentQuestion(drafts[0].id).generation.onlineModelCalled, false);
    assert.equal(E.getAgentQuestions({status:'draft'}).length, 99);
  } finally { drafts.forEach(q => E.deleteAgentQuestion(q.id)); dom.window.close(); }
});

test('Agent generation uses searchable model picker without discarding entered content or requiring a permanent role', async () => {
  const dom = new JSDOM('<main></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', {url:'http://localhost/'});
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  const { saveAsset, validateAsset } = await import('../src/domain/asset-intake.js');
  const { listPickerResources } = await import('../src/core/resource-picker.js');
  const { actions } = await import('../src/pages/resource-authoring.js');
  const assetId = 'environment-generator-without-role';
  saveAsset({ id:assetId, kind:'model', name:'无固定用途生成模型', baseUrl:'https://example.com/v1', apiModel:'demo-model', source:'测试模型' });
  await validateAsset(assetId, { delay:0 });
  const resource = listPickerResources('model').find(row => row.assetId === assetId);
  const choose = () => {
    const layer = document.querySelector('.resource-picker-layer');
    assert.ok(layer);
    const query = layer.querySelector('[data-rp-query]'); query.value = assetId; query.dispatchEvent(new window.Event('input', {bubbles:true}));
    assert.equal(layer.querySelectorAll('[data-rp-row]').length, 1);
    assert.match(layer.textContent, /测试连通/);
    const radio = layer.querySelector('[data-rp-select]'); radio.checked = true; radio.dispatchEvent(new window.Event('change', {bubbles:true}));
    layer.querySelector('[data-rp-action="confirm"]').click();
  };
  let generated;
  try {
    actions.aeGenerateDialog();
    document.getElementById('ae-gen-title').value = '选择器测试环境'; document.getElementById('ae-gen-count').value = '1';
    document.getElementById('ae-gen-goal').value = '整理公开业务资料并交付摘要';
    assert.ok(document.querySelector('#drawer .drawer'));
    assert.equal(document.querySelector('select#ae-gen-model'), null);
    assert.equal(document.getElementById('ae-gen-model').value, '');
    actions.aePickGenerationModel(); choose();
    assert.equal(document.getElementById('ae-gen-title').value, '选择器测试环境');
    assert.equal(document.getElementById('ae-gen-model').value, resource.id);
    actions.aeGenerateConfirm();
    generated = E.getAgentQuestions({status:'draft'}).find(row => row.title === '选择器测试环境');
    assert.ok(generated); assert.equal(generated.generation.modelId, resource.id);
    assert.equal(generated.modelResource.assetId, assetId);
  } finally { if (generated) E.deleteAgentQuestion(generated.id); dom.window.close(); }
});
