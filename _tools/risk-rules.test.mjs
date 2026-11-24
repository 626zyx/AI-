import test from 'node:test';
import assert from 'node:assert/strict';
import { saveRiskRule, publishRiskRule, toggleRiskRule, listRiskEvents, getRiskRule } from '../src/domain/risk-rules.js';

const modelTask = { id: 'risk-test-model', status: 'done', name: '模型验证', targetId: 'model-risk-test@V1', targetName: '验证模型', units: [{ id: 'u1', scenarioId: 'scene-a', scenarioName: '客服', method: 'Direct', judgeSuccess: true }], total: 1 };
const config = (name, extra = {}) => ({ name, source: 'model', metricKey: 'asr', comparison: 'gt', threshold: 0.3, severity: 'high', scope: 'project', targetId: '', ...extra });
const eventsFor = (rule, models = [modelTask], agents = []) => listRiskEvents(models, agents).filter(event => event.ruleId === rule.id);

test('drafts do not trigger; publishing freezes the previous configuration until the next release', () => {
  const rule = saveRiskRule(config('待发布规则'));
  assert.equal(eventsFor(rule).length, 0);
  const first = publishRiskRule(rule.id);
  assert.equal(first.version, 'V1');
  assert.equal(eventsFor(rule).length, 1);
  saveRiskRule(config('待发布规则', { id: rule.id, threshold: 1 }));
  assert.equal(getRiskRule(rule.id).threshold, 0.3);
  assert.equal(eventsFor(rule).length, 1);
  const second = publishRiskRule(rule.id);
  assert.equal(second.version, 'V2');
  assert.equal(second.versions[0].snapshot.threshold, 0.3);
  assert.equal(eventsFor(rule).length, 0);
});

test('completion rules use lower thresholds without treating unknown evidence as zero', () => {
  const rule = saveRiskRule(config('业务完成率告警', { source: 'agent', metricKey: 'completionRate', comparison: 'lt', threshold: 0.8 }), { publish: true });
  const task = { id: 'risk-test-agent', name: 'Agent 验证', status: 'done', targetId: 'agent-risk-test', total: 1, units: [{ id: 'a1', verdict: 'safe' }] };
  assert.equal(eventsFor(rule, [], [task]).length, 0);
  task.units[0].completionAssessment = { status: 'failed', evidenceRefs: ['result.json'] };
  const [event] = eventsFor(rule, [], [task]);
  assert.equal(event.value, 0);
  assert.equal(event.metric.denominator, 1);
  task.units[0].completionAssessment.status = 'complete';
  assert.equal(eventsFor(rule, [], [task]).length, 0);
});

test('rules respect asset scope and enablement; distinct rules have independent event identifiers', () => {
  const rule = saveRiskRule(config('指定资产规则', { targetId: 'different-asset' }), { publish: true });
  assert.equal(eventsFor(rule).length, 0);
  saveRiskRule(config('指定资产规则', { id: rule.id, targetId: 'model-risk-test' }), { publish: true });
  const [event] = eventsFor(rule);
  assert.equal(event.taskId, modelTask.id);
  const other = saveRiskRule(config('另一个同任务规则'), { publish: true });
  assert.notEqual(eventsFor(other)[0].id, event.id);
  toggleRiskRule(rule.id);
  assert.equal(eventsFor(rule).length, 0);
});

test('highest scenario rules preserve the source group and skip unjudged or unfinished tasks', () => {
  const rule = saveRiskRule(config('场景薄弱点规则', { metricKey: 'maxScenarioAsr' }), { publish: true });
  const [event] = eventsFor(rule);
  assert.equal(event.value, 1);
  assert.equal(event.metric.name, '客服');
  assert.equal(eventsFor(rule, [{ ...modelTask, status: 'running' }]).length, 0);
  assert.equal(eventsFor(rule, [{ ...modelTask, units: [{ ...modelTask.units[0], judgeSuccess: null }] }]).length, 0);
  assert.throws(() => saveRiskRule(config('错配指标', { metricKey: 'completionRate' })), /适用于/);
  assert.throws(() => saveRiskRule(config('无效阈值', { threshold: '' })), /阈值/);
});
