import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { agentUnits } from '../src/data/agent-units.js';
import { agentTasks } from '../src/data/agent-tasks.js';
import { taskWorkspacePage } from '../src/pages/task-workspace.js';
import { buildReplayEvents, projectReplay } from '../src/domain/task-replay.js';
import { currentTaskContent } from '../src/pages/task-content.js';

test('legacy Agent requirements come verbatim from their task definition, with planned steps separate from execution evidence', () => {
  const counts = { '000003':4, '000038':6, '000040':7, '000047':7, '000052':9 };
  const legacyUnits = agentUnits.filter(unit => ['task-agt-cs5-baseline', 'task-agt-cs5-universal'].includes(unit.taskId));
  assert.equal(legacyUnits.length, 10, 'the legacy source fixture must retain both five-question strategies');
  for (const unit of legacyUnits) {
    const task = readFileSync(new URL(`../../题库/mid/${unit.sceneTaskId}/task.md`, import.meta.url), 'utf8');
    assert.equal(unit.taskSteps.length, counts[unit.sceneTaskId.slice(-6)]);
    assert.ok(task.includes(unit.taskDescription));
    for (const step of unit.taskSteps) {
      const normalizedTask = task.replace(/\*\*([^*]+)\*\*/g, '$1').replaceAll('`', '');
      assert.ok(normalizedTask.includes(step));
    }
    assert.equal(unit.trace, undefined);
  }
  assert.ok(agentUnits.every(unit => unit.trace === undefined), 'no dataset may supply a reconstructed execution trace');
});

test('Agent task detail shows requirements and final performance without attack rounds or reconstructed steps', () => {
  const document = new JSDOM(taskWorkspacePage({param:'task-agt-cs5-universal'}, 'agent')).window.document;
  assert.deepEqual([...document.querySelectorAll('.ew-table th')].map(el => el.textContent), ['序号 / 方法','状态']);
  const detail = document.querySelector('[data-ew-process]').textContent;
  assert.match(detail, /题目目标|题目描述|题目要求|靶标完成度|抵御情况|判定理由/);
  assert.doesNotMatch(detail, /轮次|轮数|执行步骤|执行过程/);
  assert.doesNotMatch(detail, /证据与判断局限|需醒目标注/);
  const baseline = new JSDOM(taskWorkspacePage({param:'task-agt-cs5-baseline'}, 'agent')).window.document;
  assert.deepEqual([...baseline.querySelectorAll('[data-ew-process] h5')].map(el => el.textContent), ['题目目标','靶标完成度','抵御情况','判定理由']);
});

test('Agent replay exposes only final response and assessments, never legacy inferred trace', () => {
  const source = agentTasks.find(task => task.id === 'task-agt-cs5-universal');
  const original = agentUnits.find(unit => unit.taskId === source.id && unit.sceneTaskId === 'openart-mid-000003');
  assert.ok(original.selfReport, 'this replay fixture requires a recorded final target response');
  const unit = {...original, trace:[{title:'fabricated action',detail:'not a tool event'}]};
  const events = buildReplayEvents(source, [unit]);
  assert.equal(events.filter(event => event.stage === 'target').length, 1);
  assert.ok(events.every(event => !event.text.includes('fabricated')));
  const task = {...source, id:'evidence-test',sourceTaskId:source.id,status:'running'};
  const beforeTarget = events.findIndex(event => event.stage === 'target');
  const early = projectReplay(task, source, [unit], events, beforeTarget);
  assert.equal(early.executionUnits[0].selfReport, undefined);
  assert.equal(early.executionUnits[0].completion, undefined);
  const afterTarget = projectReplay(task, source, [unit], events, beforeTarget + 1);
  assert.equal(afterTarget.executionUnits[0].selfReport, unit.selfReport);
  assert.equal(afterTarget.executionUnits[0].completion, undefined);
  assert.equal(currentTaskContent({...task,replay:afterTarget.replay},afterTarget.executionUnits[0]).label,'靶标最终答复');
  const done = projectReplay({...task,status:'done'}, source, [unit], events, events.length);
  assert.equal(done.units[0].trace,undefined);
  assert.equal(done.units[0].completion,unit.completion);
});
