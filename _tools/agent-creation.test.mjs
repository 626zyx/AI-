import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://localhost/#/agent/ag-tasks', pretendToBeVisual: true, runScripts: 'dangerously' });
globalThis.window = dom.window;
for (const key of ['document','location','history','HTMLElement','Node','Event','CustomEvent','getComputedStyle','localStorage']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
await import('../src/main.js');
const store = await import('../src/domain/store.js'), router = await import('../src/core/router.js');
const { getAgentQuestions } = await import('../src/domain/agent-environments.js');
const app = window.App;
const { listPickerResources } = await import('../src/core/resource-picker.js');
store.initializeTaskRuntime()();
const target = store.connectedAgents().find(agent => agent.assetId === 'agt-deepagents-code-0210');
const judge = store.models.find(model => model.assetId === 'mdl-deepseek-flash' && model.status === 'connected');
assert.ok(target && judge);
const pickModel = (key, id) => {
  app.twPick(key);
  const picker = document.querySelector('[data-resource-picker="model"]');
  assert.ok(picker, `${key} opens the model resource modal`);
  const resourceId = listPickerResources('model').find(row => row.id === id || row.assetId === id)?.id;
  const radio = [...picker.querySelectorAll('[data-rp-select]')].find(node => node.dataset.rpSelect === resourceId);
  assert.ok(radio); assert.equal(radio.disabled, false);
  radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true }));
  picker.querySelector('[data-rp-action="confirm"]').click();
  assert.equal(document.querySelector('[data-resource-picker="model"]'), null);
};


test('Agent creation separates basic information, sandbox validation and business environment selection', async () => {
  app.newAgTask(); assert.equal(document.getElementById('tw-target'), null);
  app.twField('name', 'Agent connected resources'); app.twNext();
  assert.equal(document.getElementById('tw-target').value, ''); app.twNext();
  assert.match(document.getElementById('tw-save-error').textContent, /靶标智能体/);
  app.twSelect('targetId', target.id); assert.equal(document.getElementById('tw-target').tagName, 'SELECT'); assert.equal(document.getElementById('tw-target-model').tagName, 'BUTTON'); pickModel('targetModelId', judge.id); app.twNext();
  assert.match(document.getElementById('tw-save-error').textContent, /沙箱/);
  const report = await app.twValidateSandbox(); assert.equal(report.state, 'passed'); assert.equal(report.actualExecuted, false);
  app.twNext();
  assert.equal(document.querySelectorAll('.tw-steps li').length, 3);
  assert.equal(document.getElementById('tw-question-search'), null);
  app.twQuestionFilter('questionBusiness', getAgentQuestions()[0].business);
  assert.ok(document.getElementById('tw-question-search'));
  app.twQuestionsAll(true); app.twEvaluation('llm'); assert.equal(document.getElementById('tw-judge').tagName, 'BUTTON'); pickModel('judgeId', judge.id);
  await app.twSaveDraft();
  const draft = store.listAgentTasks().find(task => task.name === 'Agent connected resources');
  assert.equal(draft.status, 'draft'); assert.equal(draft.total, getAgentQuestions().length); assert.equal(draft.wizardStep, 2);
  assert.equal(draft.configSnapshot.sandboxValidation.state, 'passed');
  app.editTaskConfig(draft.id, 'agent');
  assert.equal(document.getElementById('tw-judge').value, judge.id);
  app.twEvaluation('rule'); assert.equal(document.getElementById('tw-judge').value, judge.id); assert.equal(document.querySelector('[name=tw-evaluation-mode]'), null);
  await app.twSave();
  assert.equal(router.state().sub, 'ag-task-detail');
  assert.equal(store.getAgentTask(draft.id).judgeId, judge.id); assert.equal(store.getAgentTask(draft.id).status, 'ready');
});

test('copying a history opens the new editable draft directly and preserves the source', async () => {
  const sourceId = 'task-agt-b5-dc-universal', original = store.getAgentTask(sourceId);
  const id = app.copyTaskConfig(sourceId, 'agent');
  assert.equal(router.state().sub, 'ag-task-create'); assert.equal(router.state().param, id);
  assert.equal(document.getElementById('tw-object-type'), null);
  assert.equal(store.getAgentTask(id).status, 'draft');
  assert.equal(document.getElementById('tw-attack-template'), null);
  assert.match(document.querySelector('.tw-content').textContent, /通用攻击者/);
  app.twNext(); await app.twValidateSandbox(); app.twSurface('dcode-user', true); app.twSurface('dcode-skills', true); app.twNext(); app.twSelect('judgeId', judge.id); await app.twSave();
  store.startTask(id, 'agent'); store.advanceTaskReplay(id, 'agent', 9999);
  const task = store.getAgentTask(id);
  assert.equal(task.units.length, 5); assert.equal(task.units.filter(unit => unit.verdict === 'breach').length, 3);
  assert.equal(task.executionSnapshot.judgeId, 'judge-codex-semantic-review');
  assert.equal(store.getAgentTask(sourceId).agg.breach, original.agg.breach);
});

test('changed target settings invalidate the report and hide attack surfaces until verification passes again', async () => {
  app.newAgTask(); app.twField('name', 'Target validation invalidation'); app.twAgentMode('attack'); app.twNext();
  assert.match(document.getElementById('tw-save-error').textContent, /攻击模型/);
  assert.equal(document.getElementById('tw-attacker').tagName, 'BUTTON'); pickModel('attackerId', judge.id); assert.equal(document.getElementById('tw-name').value, 'Target validation invalidation'); app.twNext(); app.twSelect('targetId', target.id); app.twSelect('targetModelId', judge.id);
  assert.equal(document.querySelector('.tw-surfaces'), null);
  app.twSurface('dcode-user', true); await app.twValidateSandbox();
  assert.ok(document.querySelector('.tw-surfaces')); app.twSurface('dcode-user', true);
  const alternative = store.models.find(model => model.status === 'connected' && model.id !== judge.id);
  pickModel('targetModelId', alternative.id);
  assert.equal(document.querySelector('.tw-surfaces'), null); assert.match(document.getElementById('tw-sandbox-panel').textContent, /配置已变更/);
  app.twNext(); assert.match(document.getElementById('tw-save-error').textContent, /沙箱/);
  await app.twValidateSandbox(); assert.equal(document.querySelector('.tw-surfaces input:checked'), null);
  app.twNext(); assert.match(document.getElementById('tw-save-error').textContent, /注入面/);
  app.twSurface('dcode-user', true); await app.twSaveDraft();
  const draft = store.listAgentTasks().find(task => task.name === 'Target validation invalidation');
  app.editTaskConfig(draft.id, 'agent'); assert.ok(document.querySelector('.tw-surfaces input:checked'));
  app.twPrevious(); app.twAgentMode('baseline'); app.twNext();
  assert.equal(document.querySelector('.tw-surfaces'), null); app.twNext();
  assert.match(document.querySelector('[aria-current="step"]').textContent, /环境与评估/);
  await app.twSaveDraft();
});

test('business entries open environment rows and preserve selections across categories and draft restoration', async () => {
  const environments = await import('../src/domain/agent-environments.js');
  const created = environments.createAgentDemoDrafts({ title: '财务审批环境', goal: '根据公开凭证整理审批报告', business: '财务审批' })[0];
  await environments.validateAgentQuestionSandbox(created.id, { delay: 0 }); environments.publishAgentQuestion(created.id);
  const original = getAgentQuestions().find(question => question.source === 'system');
  app.newAgTask(); app.twField('name', 'Cross-business environment selection'); app.twNext();
  app.twSelect('targetId', target.id); app.twSelect('targetModelId', judge.id); await app.twValidateSandbox(); app.twNext();
  assert.equal(document.getElementById('tw-question-table'), null);
  app.twQuestionFilter('questionBusiness', original.business); app.twQuestion(original.id, true);
  app.twQuestionFilter('questionBusiness', created.business);
  assert.equal(document.querySelectorAll('#tw-question-table tbody tr').length, 1);
  app.twQuestion(created.id, true); assert.equal(document.getElementById('tw-selected-count').textContent, '2');
  app.twQuestionFilter('questionBusiness', original.business); assert.ok(document.querySelector('#tw-question-table tbody input:checked'));
  await app.twSaveDraft();
  const draft = store.listAgentTasks().find(task => task.name === 'Cross-business environment selection');
  assert.deepEqual(new Set(draft.questionIds), new Set([original.id, created.id]));
  app.editTaskConfig(draft.id, 'agent'); assert.equal(document.getElementById('tw-selected-count').textContent, '2');
  assert.equal(document.getElementById('tw-question-table'), null); await app.twSaveDraft();
});

test('an incomplete pending Agent is selectable and shows fixable sandbox blockers before task creation', async () => {
  const pending = { id: 'pending-wizard-target', name: '待完善 Agent', status: 'planned', image: '', command: [], taskInput: 'stdin', surfaces: [] };
  store.agents.push(pending);
  app.newAgTask(); app.twField('name', 'Incomplete target blocker'); app.twNext();
  assert.ok([...document.getElementById('tw-target').options].some(option => option.value === pending.id));
  app.twSelect('targetId', pending.id); app.twSelect('targetModelId', judge.id);
  const report = await app.twValidateSandbox(); assert.equal(report.state, 'failed');
  assert.match(document.getElementById('tw-sandbox-panel').textContent, /缺少镜像引用/);
  assert.match(document.getElementById('tw-sandbox-panel').textContent, /修复建议/);
  app.twNext(); assert.match(document.getElementById('tw-save-error').textContent, /沙箱/);
  await app.twSaveDraft();
  const draft = store.listAgentTasks().find(task => task.name === 'Incomplete target blocker'); assert.equal(draft.targetId, pending.id);
  app.editTaskConfig(draft.id, 'agent'); pending.image = 'company/agent'; pending.command = ['agent'];
  const retried = await app.twValidateSandbox(); assert.equal(retried.state, 'passed'); app.twNext();
  assert.match(document.querySelector('[aria-current="step"]').textContent, /环境与评估/); await app.twSaveDraft();
});

test.after(() => { store.initializeTaskRuntime()(); dom.window.dispatchEvent(new Event('pagehide')); dom.window.close(); });
