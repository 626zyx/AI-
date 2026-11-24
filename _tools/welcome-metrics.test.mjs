import test from 'node:test';
import assert from 'node:assert/strict';
import { welcomeDashboard, welcomeTaskTimestamp } from '../src/domain/welcome.js';
import { taskMetricValues } from '../src/domain/metrics.js';
import { taskOperationalMetrics } from '../src/domain/task-technical-metrics.js';
import * as store from '../src/domain/store.js';

const now = '2026-11-24T12:00:00+08:00';
const evidenceRefs = [{ path: 'evaluation.json' }];
const model = (id, units, extra = {}) => ({ id, objectType: 'model', status: 'done', finishedAt: '2026-11-23 12:00', total: units.length, units, ...extra });
const agent = (id, units, extra = {}) => ({ id, objectType: 'agent', status: 'done', technique: 'universal', finishedAt: '2026-11-23 12:00', total: units.length, units, ...extra });

test('homepage ranges use one timezone-aware clock, include boundaries and never include future or undated tasks', () => {
  assert.equal(welcomeTaskTimestamp({ finishedAt: '2026-11-24 12:00' }), Date.parse(now));
  const tasks = [
    model('boundary', [], { finishedAt: '2026-11-21 12:00' }),
    model('before', [], { finishedAt: '2026-11-21 11:59' }),
    model('future', [], { finishedAt: '2026-11-24 12:01' }),
    model('undated', [], { finishedAt: null }),
    model('running', [], { status: 'running', finishedAt: null, startedAt: '2026-11-24 11:00' }),
    model('draft', [], { status: 'draft', finishedAt: null, createdAt: '2026-11-24T01:00:00Z' }),
  ];
  const result = welcomeDashboard({ modelTasks: tasks, days: 3, now });
  assert.deepEqual(result.tasks.map(task => task.id), ['running', 'draft', 'boundary']);
  assert.deepEqual(result.counts, { total: 3, running: 1, done: 1, draft: 1 });
  assert.equal(result.model.averageDuration.sampleCount, 1, 'unfinished tasks do not enter completed averages');
});

test('homepage task averages exclude unknown verdicts while highest groups pool valid execution units', () => {
  const unit = (target, method, judgeSuccess, scene = 'A') => ({ target, method, judgeSuccess, scenarioId: scene, scenarioName: scene });
  const tasks = [
    model('a', [unit('same', 'Direct', true)]),
    model('b', [unit('same', 'Direct', false), unit('two', 'PAIR', false), unit('three', 'PAIR', false)]),
    model('unknown', [unit('four', 'Direct', null)]),
  ];
  const original = structuredClone(tasks);
  const result = welcomeDashboard({ modelTasks: tasks, now }).model;
  assert.equal(result.asr.value, .5, 'each assessed task has equal weight regardless of its unit count');
  assert.equal(result.asr.sampleCount, 2);
  assert.equal(result.asr.numerator, 1);
  assert.equal(result.asr.denominator, 4);
  assert.equal(result.topMethod.name, 'Direct');
  assert.equal(result.topMethod.value, .5);
  assert.equal(result.topScenario.value, .25);
  assert.equal(result.coverage.questions, 4, 'same question used in another task is counted once');
  assert.equal(result.coverage.methods, 2);
  assert.deepEqual(tasks, original, 'aggregation does not alter task snapshots');
});

test('Agent dashboard keeps suspected response, final verdict and business completion independent', () => {
  const tasks = [
    agent('attack', [
      { sceneTaskId: 'e1', verdict: 'breach', completionAssessment: { status: 'complete', evidenceRefs }, semanticResponseAssessment: { responded: true, affected: true, adoption: 'rejected', evidenceRefs } },
      { sceneTaskId: 'e2', verdict: 'safe', completionAssessment: { status: 'complete', evidenceRefs }, semanticResponseAssessment: { responded: true, affected: false, adoption: 'rejected', evidenceRefs } },
    ]),
    agent('baseline', [{ sceneTaskId: 'e1', verdict: 'safe', completionAssessment: { status: 'partial', evidenceRefs } }], { technique: 'baseline' }),
  ];
  const result = welcomeDashboard({ agentTasks: tasks, now }).agent;
  assert.equal(result.asr.value, .25);
  assert.equal(result.suspectedAdoptionRate.value, .5);
  assert.equal(result.suspectedAdoptionRate.sampleCount, 1, 'baseline is not counted as zero adoption');
  assert.equal(result.completionRate.value, .5, 'both safe and breached completed deliveries count');
  assert.equal(result.coverage.environments, 2);
});

test('technical averages reuse the detail display layer and expose demo provenance', () => {
  const tasks = [model('missing-telemetry', [{ judgeSuccess: true }]), model('other-missing', [{ judgeSuccess: false }, { judgeSuccess: false }])];
  const technical = tasks.map(taskOperationalMetrics);
  const result = welcomeDashboard({ modelTasks: tasks, now }).model;
  assert.equal(result.averageDuration.value, technical.reduce((sum, row) => sum + row.timing.totalSeconds, 0) / 2);
  assert.equal(result.averageTokens.value, technical.reduce((sum, row) => sum + row.tokens.total, 0) / 2);
  assert.equal(result.averageDuration.demo, true);
  assert.equal(result.averageTokens.demo, true);
  assert.deepEqual(result.executionRate, { value: 1, sampleCount: 2, executed: 3, expected: 3 });
  const empty = welcomeDashboard({ modelTasks: tasks, now: '2026-12-24T12:00:00+08:00', days: 3 });
  assert.equal(empty.model.asr.value, null);
  assert.equal(empty.model.averageTokens.value, null);
  assert.equal(empty.model.executionRate.value, null);
  assert.equal(empty.model.topMethod.value, null);
});

test('archived homepage metrics match task definitions and actual archive dates', () => {
  const modelTasks = store.listTasks(), agentTasks = store.listAgentTasks();
  const month = welcomeDashboard({ modelTasks, agentTasks, days: 30, now });
  const week = welcomeDashboard({ modelTasks, agentTasks, days: 7, now });
  assert.equal(month.model.completedCount, 3);
  assert.equal(month.agent.completedCount, 2);
  assert.equal(week.model.completedCount, 0);
  assert.equal(week.agent.completedCount, 2);
  assert.equal(month.model.coverage.questions, 20);
  assert.equal(month.model.coverage.methods, 4);
  assert.equal(month.agent.coverage.environments, 5);
  assert.equal(month.agent.suspectedAdoptionRate.value, taskMetricValues(agentTasks.find(task => task.technique !== 'baseline')).suspectedAdoptionRate.value);
  assert.equal(month.agent.averageTokens.demo, true);
});
