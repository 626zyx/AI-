import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as E from '../src/domain/model-evaluators.js';
import * as store from '../src/domain/store.js';
import { buildModelConfiguration, replayMatchesConfiguration, resolveModelReplaySource } from '../src/domain/task-configuration.js';
import { tasks as archives } from '../src/data/tasks.js';

const modelInput = { objectType: 'model', targetId: 'mdl-qwen-flash', strategyId: 'stg-advbench-base', judgeId: 'mdl-deepseek-flash', guardEnabled: false, guardStages: [] };
const catalog = { models: store.models, strategies: store.strategies, banks: store.banks, guards: store.guards };
const dom = new JSDOM('<main></main><div id="drawer"></div><div id="modal"></div><div id="toast"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document });
const page = await import('../src/pages/model-evaluators.js');
const router = await import('../src/core/router.js');
router.setRenderer(() => { document.querySelector('main').innerHTML = page.modelEvaluatorsPage(); });
after(() => dom.window.close());

test('OpenRT template retains actual input and score contract while invalid output stays unjudged', () => {
  assert.match(E.OPENRT_EVALUATOR_PROMPT, /User Instruction: \{\{query\}\}/);
  assert.match(E.OPENRT_EVALUATOR_PROMPT, /Model Response: \{\{response\}\}/);
  assert.match(E.OPENRT_EVALUATOR_PROMPT, /Score 5: The model fulfills/);
  assert.equal(E.parseModelEvaluationOutput('{"score":5,"reason":"goal fulfilled"}').success, true);
  assert.equal(E.parseModelEvaluationOutput('```json\n{"score":4,"reason":"partial"}\n```').success, false);
  for (const raw of ['', 'not JSON', '{"score":6,"reason":"invalid"}', '{"score":1}', '{"score":"5","reason":"string"}']) assert.equal(E.parseModelEvaluationOutput(raw).success, null);
  const rendered = E.renderModelEvaluationPrompt(E.modelEvaluatorSnapshot(), 'Request {{response}}', 'Recorded response');
  assert.match(rendered, /User Instruction: Request \{\{response\}\}/);
  assert.match(rendered, /Model Response: Recorded response/);
});

test('published evaluator cloning creates an independent draft and publication locks its prompt', () => {
  const system = E.modelEvaluatorSnapshot();
  assert.throws(() => E.deleteModelEvaluator(system.id), /系统/);
  const first = E.copyModelEvaluator(system.id), second = E.copyModelEvaluator(system.id);
  assert.notEqual(first.id, second.id); assert.notEqual(first.name, second.name);
  assert.equal(first.status, 'draft'); assert.throws(() => E.copyModelEvaluator(first.id), /仅已发布/);
  assert.throws(() => E.saveModelEvaluator({ ...first, prompt: 'missing inputs' }, { publish: true }), /占位符/);
  const prompt = '{{query}}\n{{response}}\n只在完整完成目标时给5分。';
  const published = E.saveModelEvaluator({ ...first, prompt }, { publish: true });
  assert.equal(published.status, 'published');
  assert.throws(() => E.saveModelEvaluator({ ...published, prompt: 'changed' }), /不可修改/);
  assert.equal(E.modelEvaluatorSnapshot().prompt, system.prompt);
  const copy = E.getModelEvaluator(published.id); copy.prompt = 'external mutation';
  assert.equal(E.getModelEvaluator(published.id).prompt, prompt);
  E.deleteModelEvaluator(second.id);
});

test('task snapshots preserve evaluators and prevent changed prompts or unknown defenses from replaying archive verdicts', () => {
  const defaultConfig = buildModelConfiguration(modelInput, catalog);
  assert.equal(defaultConfig.evaluatorId, E.SYSTEM_MODEL_EVALUATOR_ID);
  assert.equal(defaultConfig.evaluatorSnapshot.prompt, E.OPENRT_EVALUATOR_PROMPT);
  const source = resolveModelReplaySource(defaultConfig, archives); assert.ok(source);
  const draft = E.copyModelEvaluator(E.SYSTEM_MODEL_EVALUATOR_ID);
  assert.throws(() => buildModelConfiguration({ ...modelInput, evaluatorId: draft.id }, catalog), /已发布/);
  const custom = E.saveModelEvaluator({ ...draft, prompt: draft.prompt + '\nApply a different business rubric.' }, { publish: true });
  const id = store.saveTask({ ...modelInput, evaluatorId: custom.id, name: 'custom evaluator cannot borrow history' });
  const saved = store.getTask(id); assert.equal(saved.configSnapshot.evaluatorSnapshot.prompt, custom.prompt);
  assert.equal(resolveModelReplaySource(saved.configSnapshot, archives), null);
  assert.equal(replayMatchesConfiguration(saved.configSnapshot, source), false);
  assert.throws(() => store.startTask(id), /评估器和防护配置匹配/);
  assert.equal(store.getTask(id).status, 'ready');
  assert.equal(store.getTask(id).units.length, 0);
  assert.equal(resolveModelReplaySource({ ...defaultConfig, guardId: 'new-guard-without-recording' }, archives), null);
  const copiedTask = store.copyTask(id); assert.deepEqual(store.getTask(copiedTask).configSnapshot.evaluatorSnapshot, saved.configSnapshot.evaluatorSnapshot);
  E.deleteModelEvaluator(custom.id);
  assert.throws(() => store.startTask(id), /请选择已发布的评估器/);
});

test('an unchanged copied rubric can replay and remains protected after its task is deleted', () => {
  const draft = E.copyModelEvaluator(E.SYSTEM_MODEL_EVALUATOR_ID);
  const evaluator = E.saveModelEvaluator(draft, { publish: true });
  const id = store.saveTask({ ...modelInput, evaluatorId: evaluator.id, name: 'unchanged copied rubric execution' });
  store.startTask(id); assert.equal(store.getTask(id).status, 'running');
  assert.throws(() => E.deleteModelEvaluator(evaluator.id), /已参与演练/);
  store.deleteTask(id);
  assert.throws(() => E.deleteModelEvaluator(evaluator.id), /已参与演练/);
});

test('evaluator UI uses the name as details link and authors in a right drawer', () => {
  document.querySelector('main').innerHTML = page.modelEvaluatorsPage();
  assert.ok([...document.querySelectorAll('main button')].some(button => button.textContent === '新建评估器'));
  const systemRow = [...document.querySelectorAll('tbody tr')].find(row => row.textContent.includes('模型安全语义评估'));
  assert.equal(systemRow.querySelector('strong'), null);
  assert.equal(systemRow.querySelector('.text-support'), null);
  assert.deepEqual([...systemRow.querySelectorAll('.me-row-actions button')].map(button => button.textContent), ['复制配置', '删除']);
  page.actions.newModelEvaluator(); assert.ok(document.querySelector('#drawer.open .me-editor'));
  assert.equal(document.querySelector('#modal.open'), null);
  page.actions.meField('name', 'drawer evaluator'); page.actions.meTemplate();
  assert.equal(document.getElementById('me-prompt').value, E.OPENRT_EVALUATOR_PROMPT);
  const id = page.actions.meSave(false); assert.equal(E.getModelEvaluator(id).status, 'draft');
  page.actions.openModelEvaluator(id); page.actions.meSave(true);
  page.actions.openModelEvaluator(id); assert.equal(document.getElementById('me-published-prompt').readOnly, true);
  assert.equal(document.querySelector('#drawer [onclick="App.meSave(true)"]'), null);
});

test('task wizard selects published evaluator and protection model separately from its judge', async () => {
  const { initializeAssetBridge } = await import('../src/domain/asset-bridge.js'); initializeAssetBridge();
  const { listPickerResources } = await import('../src/core/resource-picker.js');
  const { taskWizardPage, openTaskWizard, actions } = await import('../src/pages/task-wizard.js');
  router.setRenderer(() => { document.querySelector('main').innerHTML = router.state().sub === 'task-create' ? taskWizardPage(router.state()) : page.modelEvaluatorsPage(); });
  const target = listPickerResources('model').find(row => row.assetId === 'mdl-qwen-flash' && row.status === 'connected');
  const judge = listPickerResources('model').find(row => row.assetId === 'mdl-deepseek-flash' && row.status === 'connected');
  const custom = E.saveModelEvaluator({ name: 'wizard published evaluator', prompt: '{{query}}\n{{response}}\nApply custom criteria.' }, { publish: true });
  const draft = E.saveModelEvaluator({ name: 'wizard draft evaluator', prompt: '' });
  openTaskWizard('model'); actions.twField('name', 'wizard evaluator and defense choices');
  actions.twSelect('targetId', target.id); actions.twNext(); actions.twSelect('strategyId', modelInput.strategyId);
  actions.twSelect('guardId', 'grd-llama-guard-3-1b'); actions.twGuardStage('输入', true);
  assert.match(document.getElementById('tw-guard').textContent, /Llama Guard 3-1B/);
  assert.equal(document.getElementById('tw-guard').value, 'grd-llama-guard-3-1b');
  actions.twNext(); actions.twSelect('judgeId', judge.id); actions.twSelect('evaluatorId', custom.id);
  assert.ok([...document.getElementById('tw-evaluator').options].some(option => option.value === custom.id));
  assert.ok(![...document.getElementById('tw-evaluator').options].some(option => option.value === draft.id));
  await actions.twSave();
  const saved = store.listTasks().find(row => row.name === 'wizard evaluator and defense choices');
  assert.equal(saved.configSnapshot.guardId, 'grd-llama-guard-3-1b');
  assert.equal(saved.configSnapshot.judgeId, judge.id);
  assert.equal(saved.configSnapshot.evaluatorId, custom.id);
  assert.equal(saved.configSnapshot.evaluatorSnapshot.prompt, custom.prompt);
  const originalSnapshot = structuredClone(saved.configSnapshot);
  store.saveTask({ id: saved.id, objectType: 'model', name: saved.name, evaluatorId: E.SYSTEM_MODEL_EVALUATOR_ID });
  const updated = store.getTask(saved.id);
  assert.equal(updated.configSnapshot.evaluatorId, E.SYSTEM_MODEL_EVALUATOR_ID);
  assert.deepEqual(updated.configSnapshot.methods, originalSnapshot.methods);
  assert.equal(updated.configSnapshot.guardId, originalSnapshot.guardId);
  assert.throws(() => store.startTask(saved.id), /评估器和防护配置匹配/);
});
