import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentConfiguration } from '../src/domain/agent-configuration.js';
import { createTaskService } from '../src/domain/task-service.js';
import { createTaskRepository } from '../src/domain/task-repository.js';
import { agentTasks } from '../src/data/agent-tasks.js';
import { agentUnits } from '../src/data/agent-units.js';
import * as store from '../src/domain/store.js';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const catalog = { agents: store.agents, agentStrategies: store.agentStrategies, agentMethods: store.agentMethods, sceneBanks: store.sceneBanks, models: store.models };
const choices = { objectType: 'agent', targetId: 'agt-qwen-ds-flash', strategyId: 'agstg-cs-universal', judgeId: 'mdl-deepseek-v4-pro', injectionSurfaceIds: ['qwen-project'] };

test('Agent configuration starts empty and validates independent role selections', () => {
  const draft = buildAgentConfiguration({}, catalog, { draft: true });
  assert.equal(draft.targetId, ''); assert.equal(draft.strategyId, ''); assert.equal(draft.judgeId, '');
  assert.equal(draft.total, 0); assert.deepEqual(draft.taskIdSnapshot, []);
  assert.throws(() => buildAgentConfiguration({}, catalog), /靶标智能体/);
  assert.throws(() => buildAgentConfiguration({ targetId: choices.targetId }, catalog), /演练策略/);
  assert.throws(() => buildAgentConfiguration({ ...choices, judgeId: '' }, catalog), /裁判模型/);
  const config = buildAgentConfiguration(choices, catalog);
  assert.equal(config.technique, 'universal'); assert.equal(config.attackerName, 'DeepSeek-V4-Pro');
  assert.equal(config.total, 5); assert.equal(config.taskIdSnapshot.length, 5);
  assert.equal(config.guardEnabled, false); assert.deepEqual(config.guardStages, []);
});

test('Agent task saves user choices before binding source and keeps copied configuration', () => {
  const repository = createTaskRepository();
  const service = createTaskService({ modelTasks: [], modelUnits: [], agentTasks, agentUnits, nowText: () => '2026-11-19 12:00', repository: () => repository,
    agentConfiguration: (data, options) => buildAgentConfiguration(data, catalog, options) });
  assert.throws(() => service.saveTask({ objectType: 'agent', name: 'No implicit template' }), /靶标智能体/);
  const draft = service.saveTask({ objectType: 'agent', name: 'Empty Agent', targetId: '', strategyId: '', judgeId: '', wizardStep: 1 }, { draft: true });
  assert.equal(repository.get(draft).sourceTaskId, null);
  const id = service.saveTask({ ...choices, name: 'Chosen Agent' });
  const ready = repository.get(id);
  assert.equal(ready.sourceTaskId, null); assert.equal(ready.status, 'ready');
  assert.deepEqual(service.projectTask(ready).units, []);
  service.startTask(id, 'agent');
  assert.equal(repository.get(id).sourceTaskId, 'task-agt-cs5-universal');
  assert.equal(repository.get(id).replayConfigMatches, false, 'Selecting one file must not relabel wider historical evidence as a matching execution');
  assert.deepEqual(repository.get(id).configSnapshot.requestedSurfaces.map(surface => surface.path), ['QWEN.md']);
  assert.deepEqual(repository.get(id).configSnapshot, ready.configSnapshot);
  service.stopTask(id, 'agent');
  const copied = service.copyTask(id, 'agent');
  service.saveTask({ id: copied, objectType: 'agent', name: 'Copied Agent', judgeId: 'mdl-deepseek-flash' });
  const changed = repository.get(copied);
  assert.equal(changed.judgeId, 'mdl-deepseek-flash');
  assert.deepEqual(changed.configSnapshot.taskIdSnapshot, ready.configSnapshot.taskIdSnapshot);
  assert.equal(changed.technique, 'universal');
  service.saveTask({ id: copied, objectType: 'agent', name: 'Copied Agent', strategyId: 'agstg-cs-baseline' });
  assert.equal(repository.get(copied).technique, 'baseline');
  assert.equal(repository.get(copied).attackerId, null);
});

test('Agent wizard starts with empty selectors, resumes draft, and saves chosen configuration to detail', async () => {
  const dom = new JSDOM(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://localhost/#/agent/ag-tasks', pretendToBeVisual: true, runScripts: 'dangerously' });
  globalThis.window = dom.window;
  for (const key of ['document','location','history','HTMLElement','Node','Event','CustomEvent','getComputedStyle','localStorage']) globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
  await import('../src/main.js');
  const app = window.App, router = await import('../src/core/router.js');
  store.initializeTaskRuntime()();
  try {
    app.newAgTask();
    assert.equal(document.querySelector('#tw-template'), null);
    assert.equal(document.querySelector('#tw-target').value, '');
    app.twField('name', 'Agent empty-first wizard'); app.twNext();
    assert.match(document.querySelector('#tw-save-error').textContent, /靶标智能体/);
    app.twSelect('targetId', choices.targetId); app.twSurface('qwen-project', true); app.twNext();
    assert.equal(document.querySelector('#tw-strategy').value, '');
    assert.equal(document.querySelector('[data-tw-strategy-details]'), null);
    await app.twSaveDraft();
    const draft = store.listAgentTasks().find(task => task.name === 'Agent empty-first wizard');
    assert.equal(draft.status, 'draft'); assert.equal(draft.sourceTaskId, null); assert.equal(draft.total, 0);
    app.taskOpen(draft.id, 'agent');
    assert.match(document.querySelector('[aria-current="step"]').textContent, /红队配置/);
    app.twSelect('strategyId', choices.strategyId);
    assert.match(document.querySelector('[data-tw-strategy-details]').textContent, /间接提示注入/);
    assert.match(document.querySelector('[data-tw-strategy-details]').textContent, /攻击 Agent 基模DeepSeek-V4-Pro/);
    assert.equal(document.querySelector('[data-tw-strategy-details] table'), null);
    assert.deepEqual([...document.querySelectorAll('[data-tw-strategy-details] .tw-read-field > span')].map(node => node.textContent), ['场景题库范围', '攻击方法', '攻击 Agent 基模']);
    assert.match(document.querySelector('[data-tw-strategy-details] .tw-read-field > strong').textContent, /客户服务与社区运营 · 前 5 题/);
    assert.doesNotMatch(document.querySelector('.tw-summary').textContent, /测试范围/);
    app.twSelect('strategyId', 'agstg-cs-baseline');
    assert.deepEqual([...document.querySelectorAll('[data-tw-strategy-details] .tw-read-field > span')].map(node => node.textContent), ['场景题库范围', '攻击方法']);
    assert.doesNotMatch(document.querySelector('[data-tw-strategy-details]').textContent, /攻击 Agent 基模/);
    app.twSelect('strategyId', choices.strategyId);
    app.twNext();
    assert.doesNotMatch(document.querySelector('.tw-root').textContent, /蓝队/);
    assert.equal(document.querySelectorAll('.tw-steps li').length, 4);
    assert.equal(document.querySelector('#tw-judge').value, '');
    app.twNext(); assert.match(document.querySelector('#tw-save-error').textContent, /裁判模型/);
    app.twSelect('judgeId', choices.judgeId); app.twNext(); await app.twSave();
    assert.equal(router.state().sub, 'ag-task-detail');
    const task = store.getAgentTask(draft.id);
    assert.equal(task.status, 'ready'); assert.equal(task.sourceTaskId, null); assert.equal(task.total, 5);
    assert.equal(task.technique, 'universal'); assert.equal(task.judgeId, choices.judgeId);
  } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
});
