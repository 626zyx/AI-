import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as store from '../src/domain/store.js';
import { taskRepository } from '../src/domain/task-repository.js';
import { reportDetailPage } from '../src/pages/reports.js';
import { agentReportDetailPage } from '../src/pages/agent-reports.js';
import { configSummary, mountTaskConfig } from '../src/core/task-config.js';
import { taskWizardPage } from '../src/pages/task-wizard.js';
import { runSandboxValidation } from '../src/domain/sandbox-validation.js';

test('a model strategy already used by a historical exercise cannot be deleted', () => {
  const history = store.listTaskTemplates('model')[0];
  const original = structuredClone(store.recordedModelStrategy(history.strategyId));
  assert.equal(store.modelStrategyUsage(history.strategyId).used, true);
  assert.throws(() => store.deleteStrategy(history.strategyId), /已参与演练.*不可删除/);
  assert.deepEqual(store.recordedModelStrategy(history.strategyId), original);
  assert.match(reportDetailPage({ param: history.id }), /核心发现/);
});

test('an unused published strategy can be deleted and pending tasks must choose another', () => {
  const id = store.saveStrategy({ name: 'unused published model policy', status: 'published', banks: [{ bankId: 'bank-advbench', count: 5 }], methods: [{ name: 'Direct', order: 1, params: [] }] });
  const input = { objectType: 'model', targetId: 'mdl-qwen-flash', strategyId: id, judgeId: 'mdl-deepseek-flash', guardEnabled: false };
  const ready = store.saveTask({ ...input, name: 'unused policy ready task' });
  const draft = store.saveTask({ ...input, name: 'unused policy draft task' }, { draft: true });
  assert.equal(store.modelStrategyUsage(id).used, false);
  store.deleteStrategy(id);
  assert.equal(store.strategies.some(strategy => strategy.id === id), false);
  assert.throws(() => store.startTask(ready, 'model'), /已删除或不可用/);
  assert.throws(() => store.saveTask({ ...input, name: 'cannot create with removed policy' }), /已发布|已删除|不可用/);
  assert.match(taskWizardPage({ page: 'exercise', sub: 'task-create', param: draft }), /已删除或不可用/);
});

test('deleting completed task rows cannot make a previously exercised model strategy deletable', () => {
  const id = store.saveStrategy({ name: 'used model policy fixture', status: 'published', banks: [{ bankId: 'bank-advbench', count: 5 }], methods: [{ name: 'Direct', order: 1, params: [] }] });
  const taskId = store.saveTask({ objectType: 'model', targetId: 'mdl-qwen-flash', strategyId: id, judgeId: 'mdl-deepseek-flash', guardEnabled: false, name: 'used policy fixture task' });
  const repo = taskRepository(), task = repo.get(taskId);
  const executed = { ...task, status: 'done', startedAt: '2026-11-24 11:00:00', finishedAt: '2026-11-24 11:01:00', sourceTaskId: store.listTaskTemplates('model')[0].id };
  repo.put(executed);
  assert.equal(store.modelStrategyUsage(id).used, true);
  repo.softDelete(taskId, { objectType: 'model', deletedAt: '2026-11-24 11:05:00', record: executed });
  assert.equal(repo.get(taskId), null);
  assert.throws(() => store.deleteStrategy(id), /已参与演练.*不可删除/);
});

test('removing a legacy Agent combination strategy does not change validated three-step tasks or archived evidence', async () => {
  const strategy=store.agentStrategies.find(row=>row.id==='agstg-cs-universal');
  const index=store.agentStrategies.indexOf(strategy);
  const historical=store.getAgentTask('task-agt-b5-dc-universal');
  const originalUnits=structuredClone(historical.units);
  const sandboxValidation=await runSandboxValidation('target',{target:store.agentOf('agt-deepagents-code-0210'),model:store.models.find(row=>row.id==='mdl-deepseek-flash')},{delay:0});
  assert.equal(sandboxValidation.state,'passed');
  assert.equal(sandboxValidation.actualExecuted,false);
  const input={objectType:'agent',targetId:'agt-deepagents-code-0210',targetModelId:'mdl-deepseek-flash',sandboxValidationRequired:true,sandboxValidation,
    exerciseMode:'attack',attackTemplateId:'universal',attackerId:'mdl-deepseek-flash',
    injectionSurfaceIds:['dcode-user','dcode-skills'],questionIds:historical.taskIdSnapshot,evaluationMode:'llm',judgeId:'mdl-qwen-flash'};
  const ready=store.saveTask({...input,name:'Agent independent ready'});
  const draft=store.saveTask({...input,name:'Agent independent draft',wizardStep:2,wizardVisited:2},{draft:true});
  const running=store.saveTask({...input,name:'Agent independent running'});
  store.startTask(running,'agent');
  const snapshot=structuredClone(store.getAgentTask(running).configSnapshot);
  try {
    store.deleteAgentStrategy(strategy.id);
    assert.equal(store.agentStrategies.some(row=>row.id===strategy.id),false);
    assert.equal(snapshot.strategyId,'');
    assert.equal(snapshot.attackTemplateId,'universal');
    const wizard=taskWizardPage({page:'agent',sub:'ag-task-create',param:draft});
    assert.match(wizard,/任务与演练方式.*靶标与沙箱验证.*环境与评估/s);
    assert.match(wizard,/选择环境/);
    assert.doesNotMatch(wizard,/原攻击策略已删除|组合策略已删除/);
    store.saveTask({...input,id:draft,name:'Agent independent draft'},{draft:true});
    const newId=store.saveTask({...input,name:'Agent independent after deletion'});
    assert.equal(store.getAgentTask(newId).status,'ready');
    store.startTask(ready,'agent');
    assert.equal(store.getAgentTask(ready).status,'running');
    assert.equal(store.startTask(running,'agent'),running);
    store.advanceTaskReplay(running,'agent',99999);
    assert.equal(store.getAgentTask(running).status,'done');
    assert.equal(store.getAgentTask(running).breach,3);
    assert.deepEqual(store.getAgentTask(running).configSnapshot,snapshot);
    assert.deepEqual(store.getAgentTask(historical.id).units,originalUnits);
    assert.match(agentReportDetailPage({param:historical.id}),/核心发现/);
    store.stopTask(ready,'agent');
  } finally {
    if(!store.agentStrategies.some(row=>row.id===strategy.id))store.agentStrategies.splice(index,0,strategy);
  }
});
