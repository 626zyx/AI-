import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildAgentConfiguration } from '../src/domain/agent-configuration.js';
import { createTaskService } from '../src/domain/task-service.js';
import { createTaskRepository } from '../src/domain/task-repository.js';
import { fiveTaskTasks, fiveTaskUnits } from '../src/data/five-task-batch.js';
import { getAgentQuestions } from '../src/domain/agent-environments.js';
import { resolveAgentReplaySource, projectAgentEvaluationUnits, agentReplayEvaluationSource } from '../src/domain/agent-replay-source.js';
import * as store from '../src/domain/store.js';

const catalog = { agents: store.agents, models: store.models, agentStrategies: store.agentStrategies, sceneBanks: store.sceneBanks };
const questions = getAgentQuestions().map(question => question.id);
const baseline = { objectType: 'agent', targetId: 'agt-deepagents-code-0210', targetModelId: 'mdl-deepseek-flash',
  exerciseMode: 'baseline', questionIds: questions, evaluationMode: 'llm', judgeId: 'mdl-qwen-flash' };
const attack = { ...baseline, exerciseMode: 'attack', attackTemplateId: 'universal', attackerId: 'mdl-deepseek-flash', injectionSurfaceIds: ['dcode-user', 'dcode-skills'] };
function serviceFixture() {
  const repository = createTaskRepository();
  return { repository, service: createTaskService({ modelTasks: [], modelUnits: [], agentTasks: fiveTaskTasks, agentUnits: fiveTaskUnits,
    nowText: () => '2026-11-24 12:00', repository: () => repository, agentConfiguration: (data, options) => buildAgentConfiguration(data, catalog, options),
    assertStrategyAvailable: () => { throw new Error('Agent must not depend on a combination strategy'); } }) };
}

test('Agent configuration selects one evaluator for all questions without permanent model roles', () => {
  const noRoles = { ...catalog, models: catalog.models.map(model => ({ ...model, roles: [] })) };
  const config = buildAgentConfiguration(attack, noRoles);
  assert.equal(config.total, 5); assert.equal(config.strategyId, ''); assert.equal(config.evaluationMode, 'llm');
  assert.equal(config.judgeId, 'mdl-qwen-flash'); assert.equal(config.attackerId, 'mdl-deepseek-flash');
  assert.ok(config.questionSnapshots.every(question => !question.ruleDefinition && question.llmDefinition && question.contentFingerprint));
  assert.throws(() => buildAgentConfiguration({ ...baseline, evaluationMode: 'both' }, noRoles), /仅支持 LLM/);
  assert.throws(() => buildAgentConfiguration({ ...baseline, judgeId: '' }, noRoles), /裁判模型/);
  assert.throws(() => buildAgentConfiguration({ ...attack, injectionSurfaceIds: [] }, noRoles), /注入面/);
  assert.throws(() => buildAgentConfiguration({ ...baseline, questionIds: ['missing'] }, noRoles), /环境/);
  assert.equal(buildAgentConfiguration({}, noRoles, { draft: true }).total, 0);
});

test('removed rule mode cannot create a task or reinterpret archived judgments', () => {
  const { service } = serviceFixture();
  assert.throws(() => service.saveTask({ ...baseline, evaluationMode: 'rule', name: 'Removed evaluator' }), /仅支持 LLM/);
  assert.throws(() => projectAgentEvaluationUnits(fiveTaskUnits, 'rule'), /仅支持 LLM/);
  assert.throws(() => agentReplayEvaluationSource(fiveTaskTasks[0], 'rule'), /语义复核归档/);
  assert.throws(() => projectAgentEvaluationUnits([{ sceneTaskId: 'unreviewed', verdict: 'breach' }]), /缺少 LLM/);
  const config = buildAgentConfiguration(baseline, catalog);
  assert.equal(resolveAgentReplaySource({ ...config, evaluationMode: 'rule' }, fiveTaskTasks).source, null);
});

test('LLM replay is attributed to the archived offline review, not the selected online model', () => {
  const { repository, service } = serviceFixture();
  const id = service.saveTask({ ...attack, evaluationMode: 'llm', judgeId: 'mdl-qwen-flash', name: 'Semantic archive' });
  service.startTask(id, 'agent'); service.advanceTaskReplay(id, 'agent', 1000);
  const record = repository.get(id), result = service.projectTask(record);
  assert.equal(record.configSnapshot.judgeId, 'mdl-qwen-flash');
  assert.equal(record.executionSnapshot.judgeId, 'judge-codex-semantic-review');
  assert.match(record.replayNotice, /未调用所选在线模型/);
  assert.equal(result.units.filter(unit => unit.verdict === 'breach').length, 3);
});

test('subset replay does not reuse cached full-task events and mismatched configurations stay ready', () => {
  const { repository, service } = serviceFixture();
  const full = service.saveTask({ ...baseline, name: 'Full' }); service.startTask(full, 'agent');
  const subset = service.saveTask({ ...baseline, questionIds: [questions[1]], name: 'Subset' }); service.startTask(subset, 'agent');
  service.advanceTaskReplay(subset, 'agent', 1000);
  assert.equal(service.projectTask(repository.get(subset)).units.length, 1);
  assert.equal(service.projectTask(repository.get(subset)).total, 1);
  const changed = service.saveTask({ ...baseline, targetModelId: 'mdl-qwen-flash', name: 'Different model' });
  assert.throws(() => service.startTask(changed, 'agent'), /基模.*历史案例/);
  assert.equal(repository.get(changed).status, 'ready'); assert.equal(repository.get(changed).sourceTaskId, null);
  const config = buildAgentConfiguration(baseline, catalog);
  config.questionSnapshots[0].contentFingerprint = 'changed';
  assert.equal(resolveAgentReplaySource(config, fiveTaskTasks).source, null);
});

test('saving an edited draft refreshes all Agent selections and clears inactive attack/Judge fields', () => {
  const { repository, service } = serviceFixture();
  const id = service.saveTask({ ...attack, name: 'Draft edit', evaluationMode: 'llm', judgeId: 'mdl-qwen-flash', wizardStep: 1 }, { draft: true });
  service.saveTask({ id, objectType: 'agent', name: 'Draft edit', exerciseMode: 'baseline', evaluationMode: 'llm', questionIds: [questions[0]] });
  const record = repository.get(id);
  assert.equal(record.total, 1); assert.equal(record.attackerId, null); assert.equal(record.judgeId, 'mdl-qwen-flash');
  assert.deepEqual(record.injectionSurfaceIds, []); assert.equal(record.technique, 'baseline');
});

test('store adds derived business and semantic response assessments only after each exact source unit completes',()=>{
  const originals=fiveTaskUnits.filter(unit=>unit.taskId==='task-agt-b5-dc-universal');
  const before=structuredClone(originals);
  for(const evaluationMode of ['llm']){
    const id=store.saveTask({...attack,name:`Derived lifecycle ${evaluationMode}`,evaluationMode,judgeId:'mdl-qwen-flash'});
    assert.equal(store.getAgentTask(id).units.length,0);
    store.startTask(id,'agent');
    let state=store.getAgentTask(id),iterations=0,sawPartialProgress=false;
    while(state.status==='running'&&iterations++<100){
      for(const unit of state.executionUnits){
        if(unit.executionStatus!=='done'){
          for(const key of ['semanticResponseAssessment','businessAssessment','completionAssessment','errorsAssessment','localContentAssessment','remoteDeliveryAssessment'])
            assert.equal(unit[key],undefined,`${evaluationMode}: ${unit.id} must not reveal ${key} before completion`);
        }else{
          const original=originals.find(row=>row.sceneTaskId===unit.sceneTaskId);
          assert.equal(unit.runId,original.runId);
          assert.equal(unit.businessAssessment.runId,original.runId);
          assert.equal(unit.completionAssessment.status,'partial');
          assert.ok(unit.semanticResponseAssessment.evidenceRefs.length);
          assert.equal(unit.businessAssessment.source.rawEvaluationModified,false);
        }
      }
      if(state.units.length>0&&state.units.length<5)sawPartialProgress=true;
      store.advanceTaskReplay(id,'agent',1);state=store.getAgentTask(id);
    }
    assert.equal(state.status,'done');assert.equal(state.units.length,5);assert.equal(sawPartialProgress,true);
    assert.deepEqual(state.units.map(unit=>unit.runId),originals.map(unit=>unit.runId));
    assert.ok(state.units.every(unit=>unit.semanticResponseAssessment&&unit.completionAssessment.status==='partial'));
    assert.equal(state.breach,3,'derived business and response reviews do not replace the selected safety result');
  }
  assert.deepEqual(originals,before,'source records retain their original safety judgments and raw evidence');
});

test('three-step UI validates its target, filters environments, restores drafts and keeps model creation available', async () => {
  const dom = new JSDOM('<main id="root"></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', { url: 'http://localhost/#/agent/ag-tasks', runScripts: 'dangerously', pretendToBeVisual: true });
  globalThis.window = dom.window;
  for (const key of ['document', 'location', 'history', 'HTMLElement', 'Node', 'Event', 'CustomEvent', 'localStorage']) globalThis[key] = dom.window[key];
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
  const UI = await import('../src/core/ui.js'), router = await import('../src/core/router.js'), wizard = await import('../src/pages/task-wizard.js');
  window.UI = UI; window.App = { ...wizard.actions, go: router.nav };
  const errors = []; window.addEventListener('error', event => errors.push(event.error?.message || event.message));
  for (const [page, sub] of [['agent', 'ag-task-create'], ['exercise', 'task-create']]) router.register(page, sub, wizard.taskWizardPage);
  for (const [page, sub] of [['agent', 'ag-tasks'], ['agent', 'ag-task-detail'], ['exercise', 'tasks'], ['exercise', 'task-detail']]) router.register(page, sub, cur => `<div data-route="${cur.sub}">${cur.param || ''}</div>`);
  router.setRenderer(() => { UI.closeModal(); const cur = router.state(); document.getElementById('root').innerHTML = router.resolve(cur.page, cur.sub)?.(cur) || ''; });
  try {
    wizard.openTaskWizard('agent');
    assert.equal(document.querySelectorAll('.tw-steps li').length, 3);
    wizard.actions.twField('name', 'Three step creation'); wizard.actions.twNext(); wizard.actions.twSelect('targetId', baseline.targetId); wizard.actions.twSelect('targetModelId', baseline.targetModelId);
    assert.equal(document.getElementById('tw-target-model').value, baseline.targetModelId);
    assert.equal(document.querySelector('#tw-attacker'), null);
    await wizard.actions.twValidateSandbox(); wizard.actions.twNext(); wizard.actions.twQuestionFilter('questionBusiness', getAgentQuestions()[0].business); assert.ok(document.querySelector('#tw-question-search'));
    wizard.actions.twQuestionsAll(true); assert.equal(document.getElementById('tw-selected-count').textContent, '5');
    wizard.actions.twQuestionFilter('questionSearch', '000023');
    assert.equal(document.querySelectorAll('#tw-question-table tbody tr').length, 1);
    wizard.actions.twQuestionsAll(false); assert.equal(document.getElementById('tw-selected-count').textContent, '4');
    assert.ok(document.querySelector('#tw-judge')); assert.equal(document.querySelector('[name=tw-evaluation-mode]'), null);
    wizard.actions.twEvaluation('llm'); assert.ok(document.getElementById('tw-judge'));
    wizard.actions.twSelect('judgeId', 'mdl-qwen-flash'); await wizard.actions.twSaveDraft();
    const draft = store.listAgentTasks().find(task => task.name === 'Three step creation');
    assert.equal(draft.wizardStep, 2); assert.equal(draft.total, 4);
    wizard.editTaskConfig(draft.id, 'agent');
    assert.match(document.querySelector('[aria-current="step"]').textContent, /环境与评估/);
    assert.equal(document.getElementById('tw-selected-count').textContent, '4');
    wizard.actions.twEvaluation('rule'); assert.ok(document.getElementById('tw-judge')); await wizard.actions.twSave();
    const saved = store.getAgentTask(draft.id); assert.equal(saved.status, 'ready'); assert.equal(saved.judgeId, 'mdl-qwen-flash');
    wizard.openTaskWizard('model'); assert.equal(document.querySelectorAll('.tw-steps li').length, 4);
    assert.equal(document.getElementById('tw-target').tagName, 'BUTTON');
    wizard.actions.twPick('targetId'); assert.ok(document.querySelector('[data-resource-picker="model"]'));
    assert.deepEqual(errors, []);
  } finally { store.initializeTaskRuntime()(); dom.window.close(); }
});
