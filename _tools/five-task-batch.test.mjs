import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { fiveTaskBank, fiveTaskStrategies, fiveTaskTasks, fiveTaskUnits } from '../src/data/five-task-batch.js';
import * as store from '../src/domain/store.js';
import { RISK_LABEL } from '../src/domain/constants.js';
import { buildAgentConfiguration } from '../src/domain/agent-configuration.js';
import { agentPerformance } from '../src/domain/agent-performance.js';
import { taskWorkspacePage } from '../src/pages/task-workspace.js';
import { agentReportDetailPage } from '../src/pages/agent-reports.js';
import { injectionAssessmentHTML, injectionAssessmentMd, highlySuspectedSurface } from '../src/pages/agent-evidence.js';

const demo = fileURLToPath(new URL('../', import.meta.url));
const root = path.dirname(demo.replace(/[\\/]$/, ''));
const batch = path.join(root, 'experiments/five-task-batch-20261119');
const finalRuns = JSON.parse(readFileSync(path.join(batch, 'RESULTS.json'), 'utf8')).items;
const artifacts = JSON.parse(readFileSync(path.join(batch, 'ARTIFACTS.json'), 'utf8')).runs;
const questions = ['000023', '000041', '000055', '000150', '000160'].map(id => `openart-mid-${id}`);
const sorted = values => [...values].sort();
const scopeMatches = (value, template) => {
  const pattern = template.split('<skill-name>').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]+');
  return new RegExp(`^${pattern}$`).test(value);
};

test('final batch has six independent target/strategy tasks and exactly thirty retained results', () => {
  assert.equal(fiveTaskStrategies.length, 2);
  assert.deepEqual(sorted(fiveTaskStrategies.map(strategy => strategy.methodId)), ['baseline', 'universal']);
  assert.equal(fiveTaskTasks.length, 6);
  assert.equal(new Set(fiveTaskTasks.map(task => task.id)).size, 6);
  assert.equal(new Set(fiveTaskTasks.map(task => `${task.targetId}/${task.technique}`)).size, 6);
  assert.equal(new Set(fiveTaskTasks.map(task => task.targetId)).size, 3);
  assert.equal(fiveTaskUnits.length, 30);
  assert.equal(new Set(fiveTaskUnits.map(unit => unit.id)).size, 30);
  assert.deepEqual(sorted(fiveTaskUnits.map(unit => unit.runId)), sorted(finalRuns.map(run => run.run_id)));
  assert.deepEqual(fiveTaskBank.items.map(item => item.taskId), questions);
  for (const task of fiveTaskTasks) {
    const units = fiveTaskUnits.filter(unit => unit.taskId === task.id);
    assert.equal(units.length, 5, task.id);
    assert.deepEqual(sorted(units.map(unit => unit.sceneTaskId)), questions);
    assert.deepEqual(task.taskIdSnapshot, questions);
    assert.equal(task.total, 5);
    assert.equal(task.status, 'done');
    assert.match(task.judgeProvenance, /离线语义复核/);
    assert.equal(task.evaluationBasis, 'semantic-output-review-v1');
    for (const unit of units) {
      assert.ok(['safe', 'breach'].includes(unit.verdict), unit.runId);
      assert.equal(unit.runEvidence.targetExitCode, 0);
      assert.equal(unit.trace, undefined, 'A final artifact must not become a fabricated execution trace');
      assert.ok(unit.taskDescription && unit.taskSteps.length && unit.judgeRationale && unit.completion && unit.resistance);
      assert.equal(unit.completionEvidence.contentProduced, true);
      assert.notEqual(unit.completionEvidence.publicationStatus, 'complete');
    }
  }
});

test('the two published strategies recreate all six task configurations from selected targets and the five-question bank', () => {
  const catalog = { agents: store.agents, agentStrategies: store.agentStrategies, agentMethods: store.agentMethods, sceneBanks: store.sceneBanks, models: [...store.models, ...store.agentReviewJudges] };
  for (const strategy of fiveTaskStrategies) {
    assert.equal(strategy.status, 'published');
    assert.equal(store.agentStrategyTaskCount(strategy), 5);
    assert.deepEqual(store.agentStrategyTaskIds(strategy), questions);
  }
  for (const task of fiveTaskTasks) {
    const actual = buildAgentConfiguration(task, catalog);
    assert.equal(actual.targetId, task.targetId);
    assert.equal(actual.technique, task.technique);
    assert.deepEqual(actual.taskIdSnapshot, task.taskIdSnapshot);
    assert.deepEqual(actual.requestedSurfaces.map(surface => surface.path), task.requestedSurfaces.map(surface => surface.path));
    assert.equal(actual.attackerId, task.attackerId);
    assert.equal(actual.evaluationBasis, 'semantic-output-review-v1');
    assert.equal(store.getAgentTask(task.id).units.length, 5);
  }
});

test('confirmed leaks drive risk labels, task reports, Agent evaluations, and risk events consistently', () => {
  const riskEvents = store.riskEvents().filter(event => event.source === 'agent');
  const reports = store.listAgentReports();
  const evaluated = store.agentResultRows();
  for (const unit of fiveTaskUnits) {
    assert.deepEqual(sorted(unit.triggeredLabels), sorted(new Set(unit.leaks.map(leak => leak.label))), unit.runId);
    assert.ok(unit.declaredLabels.every(label => RISK_LABEL[label]), unit.runId);
    assert.ok(unit.triggeredLabels.every(label => unit.declaredLabels.includes(label)), unit.runId);
    assert.equal(unit.leaks.length > 0, unit.verdict === 'breach', unit.runId);
    if (unit.verdict === 'breach') assert.ok(['medium', 'high'].includes(unit.severity), unit.runId);
  }
  for (const source of fiveTaskTasks) {
    const task = store.getAgentTask(source.id);
    const count = task.units.filter(unit => unit.verdict === 'breach').length;
    assert.equal(task.agg.judged, 5);
    assert.equal(task.agg.breach, count);
    assert.equal(task.agg.value, count / 5);
    assert.equal(reports.find(report => report.taskId === task.id)?.asr, count / 5);
    assert.equal(riskEvents.some(event => event.id === task.id), count / 5 > store.agentRiskRule.trigger);
    assert.ok(evaluated.find(row => row.agentId === task.targetId)?.tasks.some(item => item.id === task.id));
    for (const row of task.labelsAgg) {
      assert.equal(row.denominator, task.units.filter(unit => unit.declaredLabels.includes(row.key)).length);
      assert.equal(row.breach, task.units.filter(unit => unit.triggeredLabels.includes(row.key)).length);
    }
    assert.match(agentPerformance(task).completion.summary, /发布尚未完成|发布未完成/);
  }
});

test('all attack files match the configured injection scope and inferred responses retain evidence and uncertainty', () => {
  let injected = 0, skills = 0;
  for (const task of fiveTaskTasks) {
    for (const unit of fiveTaskUnits.filter(unit => unit.taskId === task.id)) {
      if (task.technique === 'baseline') {
        assert.equal(unit.attack, null);
        assert.equal(task.requestedSurfaces.length, 0);
        continue;
      }
      const attack = unit.attack;
      const original = artifacts.find(record => record.run_id === unit.runId);
      assert.equal(attack.deliveryStatus, 'complete');
      assert.deepEqual(sorted(attack.surfaces.map(surface => surface.path)), sorted(original.control_materialized_paths));
      assert.equal(attack.deliveryChecks.ignoredFiles, 0);
      assert.equal(attack.deliveryChecks.rejectedSkills, 0);
      injected += attack.surfaces.length;
      skills += attack.deliveryChecks.validatedSkills;
      for (const surface of attack.surfaces) {
        assert.ok(task.requestedSurfaces.some(scope => scopeMatches(surface.path, scope.path)), `${unit.runId}: ${surface.path}`);
        assert.equal(surface.inferred, true);
        assert.match(surface.reaction, /疑似/);
        assert.ok(surface.evidenceRefs.length > 0);
        assert.ok(surface.evidenceRefs.some(ref => /workspace\/shared\/|stdout\.txt$/.test(ref.path)), 'A response inference needs observable-output evidence');
      }
      const dom = new JSDOM(injectionAssessmentHTML(unit));
      const text = dom.window.document.body.textContent;
      assert.match(text, /疑似靶标响应/);
      const deliveryText = [...dom.window.document.querySelectorAll('.ud-field')].find(field => field.querySelector('.ud-label')?.textContent === '注入交付合规').textContent;
      assert.match(deliveryText, /已按规定范围交付攻击文件/);
      for (const surface of attack.surfaces) assert.ok(deliveryText.includes(surface.path));
      assert.doesNotMatch(deliveryText, /预期|落地|技能校验|materialization|snapshots|\d+ 项|\d+ 个/);
      assert.doesNotMatch(text, /需醒目标注/);
      const high = attack.surfaces.filter(highlySuspectedSurface);
      assert.equal(dom.window.document.querySelectorAll('.agent-surface-highlight').length, high.length);
      assert.equal(Boolean(dom.window.document.querySelector('[data-suspected-response="high"]')), high.length > 0);
      if (high.length) assert.match(injectionAssessmentMd(unit).join('\n'), /高度疑似响应/);
      dom.window.close();
    }
  }
  assert.equal(injected, 27);
  assert.equal(skills, 17);
});

test('every downloadable result package and original-artifact reference resolves to the retained run', () => {
  for (const unit of fiveTaskUnits) {
    const dir = path.resolve(demo, unit.resultDir);
    assert.ok(dir.startsWith(path.resolve(demo, 'results') + path.sep));
    assert.ok(statSync(dir).isDirectory(), unit.runId);
    assert.deepEqual(sorted(unit.outputFiles.map(file => file.path)), ['evidence.json', 'review.md', 'task.md']);
    for (const file of unit.outputFiles) {
      const resolved = path.resolve(dir, file.path);
      assert.ok(resolved.startsWith(dir + path.sep));
      assert.equal(statSync(resolved).size, file.size, `${unit.runId}: ${file.path}`);
    }
    const evidence = JSON.parse(readFileSync(path.join(dir, 'evidence.json'), 'utf8'));
    assert.equal(evidence.runId, unit.runId);
    assert.equal(evidence.verdict, unit.verdict);
    assert.deepEqual(evidence.leaks, unit.leaks);
    assert.equal(readFileSync(path.join(dir, 'task.md'), 'utf8').replaceAll('\r\n', '\n'), readFileSync(path.join(batch, 'tasks', unit.sceneTaskId, 'task.md'), 'utf8').replaceAll('\r\n', '\n'));
    for (const file of unit.originalOutputFiles) {
      const original = path.join(batch, 'runs', unit.runId, 'workspace/shared', file.path);
      assert.ok(existsSync(original), `${unit.runId}: ${file.path}`);
      const bytes = readFileSync(original);
      assert.equal(bytes.length, file.size, `${unit.runId}: original size`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `${unit.runId}: original hash`);
    }
    for (const ref of [...unit.reviewEvidence, ...(unit.attack?.surfaces || []).flatMap(surface => surface.evidenceRefs)]) {
      const evidencePath = path.resolve(root, ref.path);
      assert.ok(existsSync(evidencePath), `${unit.runId}: missing evidence ${ref.path}`);
      const lines = readFileSync(evidencePath, 'utf8').split('\n').length;
      assert.ok(ref.line > 0 && ref.line <= lines, `${unit.runId}: invalid evidence line ${ref.path}:${ref.line}`);
    }
  }
});

test('all six task/report pages show concise requirements, performance and judgment', () => {
  for (const task of fiveTaskTasks) {
    const workspace = new JSDOM(taskWorkspacePage({ param: task.id }, 'agent'));
    assert.equal(workspace.window.document.querySelector('.ew-result-ring .ring-text span').textContent, 'ASR');
    assert.match(workspace.window.document.querySelector('.ew-result-ring').title, /攻击成功率（ASR）.*有效判定/);
    const detail = workspace.window.document.querySelector('[data-ew-process]')?.textContent || '';
    assert.match(detail, /题目描述/);
    assert.match(detail, /题目要求/);
    assert.match(detail, /靶标完成度/);
    assert.match(detail, /抵御情况/);
    assert.match(detail, /判定理由/);
    assert.doesNotMatch(detail, /证据与判断局限|需醒目标注/);
    if (task.technique === 'baseline') assert.deepEqual([...workspace.window.document.querySelectorAll('[data-ew-process] h5')].map(el => el.textContent), ['题目目标','靶标完成度','抵御情况','判定理由']);
    const report = new JSDOM(agentReportDetailPage({ param: task.id }));
    assert.equal(report.window.document.querySelector('.rr-result .ring-text span').textContent, 'ASR');
    if (task.technique === 'baseline') assert.match(report.window.document.querySelector('.rr-result').textContent, /未启用攻击者.*不表示攻击诱导成功/);
    assert.ok(report.window.document.querySelector('[data-performance="completion"]'));
    assert.ok(report.window.document.querySelector('[data-performance="resistance"]'));
    assert.doesNotMatch(report.window.document.body.textContent, /可复核证据与判断局限/);
    workspace.window.close(); report.window.close();
  }
});
