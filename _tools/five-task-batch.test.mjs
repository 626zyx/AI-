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
import { agentDetailPage } from '../src/pages/agent-detail.js';
import { renderAgentQuestionFlow } from '../src/pages/agent-question-flow.js';
import { agentMetricLabel, agentMetricDefinition } from '../src/domain/metrics.js';
import { agentReportDetailPage } from '../src/pages/agent-reports.js';
import { injectionAssessmentHTML, injectionAssessmentMd, highlySuspectedSurface, suspicionLevel } from '../src/pages/agent-evidence.js';

const demo = fileURLToPath(new URL('../', import.meta.url));
const root = path.dirname(demo.replace(/[\\/]$/, ''));
const batch = path.join(root, 'experiments/five-task-batch-20261119');
const archiveChecks = { skip: !existsSync(batch) && 'Original research archive is not distributed with the demo' };
const finalRuns = existsSync(path.join(batch, 'RESULTS.json')) ? JSON.parse(readFileSync(path.join(batch, 'RESULTS.json'), 'utf8')).items : null;
const artifacts = existsSync(path.join(batch, 'ARTIFACTS.json')) ? JSON.parse(readFileSync(path.join(batch, 'ARTIFACTS.json'), 'utf8')).runs : null;
const questions = ['000023', '000041', '000055', '000150', '000160'].map(id => `openart-mid-${id}`);
const visibleIds = ['task-agt-b5-dc-baseline','task-agt-b5-dc-universal'];
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

test('retained results and delivered injection paths match the optional original batch manifests', archiveChecks, () => {
  assert.ok(Array.isArray(finalRuns), 'Original archive must contain a valid RESULTS.json');
  assert.ok(Array.isArray(artifacts), 'Original archive must contain a valid ARTIFACTS.json');
  assert.deepEqual(sorted(fiveTaskUnits.map(unit => unit.runId)), sorted(finalRuns.map(run => run.run_id)));
  for (const unit of fiveTaskUnits.filter(unit => unit.attack)) {
    const original = artifacts.find(record => record.run_id === unit.runId);
    assert.ok(original, unit.runId);
    assert.deepEqual(sorted(unit.attack.surfaces.map(surface => surface.path)), sorted(original.control_materialized_paths));
  }
});

test('archived strategies retain six source configurations while new tasks choose one evaluator for their question snapshots', () => {
  const catalog = { agents: store.agents, agentStrategies: store.agentStrategies, agentMethods: store.agentMethods, sceneBanks: store.sceneBanks, models: [...store.models, ...store.agentReviewJudges] };
  for (const strategy of fiveTaskStrategies) {
    assert.equal(strategy.status, 'published');
    assert.equal(store.agentStrategyTaskCount(strategy), 5);
    assert.deepEqual(store.agentStrategyTaskIds(strategy), questions);
  }
  for (const task of fiveTaskTasks) {
    for (const evaluationMode of ['llm']) {
      const actual = buildAgentConfiguration({...task,evaluationMode,judgeId:'mdl-qwen-flash',questionIds:questions}, catalog);
      assert.equal(actual.targetId, task.targetId);
      assert.equal(actual.technique, task.technique);
      assert.deepEqual(actual.taskIdSnapshot, task.taskIdSnapshot);
      assert.deepEqual(actual.requestedSurfaces.map(surface => surface.path), task.requestedSurfaces.map(surface => surface.path));
      assert.equal(actual.attackerId, task.attackerId);
      assert.equal(actual.evaluationMode,evaluationMode);
      assert.equal(actual.evalStrategy,'llm');
      assert.equal(actual.judgeId,'mdl-qwen-flash');
      assert.equal(actual.evaluationProvenance,'planned');
      assert.equal(actual.evaluationBasis,undefined,'new configuration must not claim an already completed offline review');
      assert.ok(actual.questionSnapshots.every(question => !question.ruleDefinition && question.llmDefinition && question.contentMode === 'sanitized-demo' && question.contentFingerprint));
    }
    const archive = store.getAgentTask(task.id);
    assert.equal(archive.units.length, 5);
    assert.equal(archive.evaluationBasis,'semantic-output-review-v1');
    assert.deepEqual(archive.units.map(unit => unit.runId),fiveTaskUnits.filter(unit => unit.taskId === task.id).map(unit => unit.runId));
  }
});

test('all six archives retain leak evidence while only two visible cases feed reports, evaluations and risk events', () => {
  const riskEvents = store.riskEvents().filter(event => event.source === 'agent');
  const reports = store.listAgentReports();
  const evaluated = store.agentResultRows();
  assert.deepEqual(sorted(store.listAgentTasks().map(task => task.id)),sorted(visibleIds));
  assert.deepEqual(sorted(reports.map(report => report.taskId)),sorted(visibleIds));
  assert.deepEqual(sorted(evaluated.flatMap(row => row.tasks.map(task => task.id))),sorted(visibleIds));
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
    const visible = visibleIds.includes(task.id);
    assert.equal(reports.find(report => report.taskId === task.id)?.asr, visible ? count / 5 : undefined);
    assert.equal(riskEvents.some(event => event.id === task.id), visible && count / 5 > store.agentRiskRule.trigger);
    assert.equal(evaluated.some(row => row.tasks.some(item => item.id === task.id)),visible);
    for (const row of task.labelsAgg) {
      assert.equal(row.denominator, task.units.filter(unit => unit.declaredLabels.includes(row.key)).length);
      assert.equal(row.breach, task.units.filter(unit => unit.triggeredLabels.includes(row.key)).length);
    }
    if(visible){
      assert.equal(task.units.filter(unit=>unit.completionAssessment?.status==='partial').length,5);
      assert.match(agentPerformance(task).completion.summary,/5 个环境部分完成/);
      assert.ok(task.units.every(unit=>unit.businessAssessment?.source.rawEvaluationModified===false));
    }else{
      assert.ok(task.units.every(unit=>unit.completionAssessment===undefined));
      assert.match(agentPerformance(task).completion.summary,/发布尚未完成|发布未完成/);
    }
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
      assert.equal(attack.deliveryStatus, 'complete');
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
      const hot = attack.surfaces.filter(surface => ['high', 'medium'].includes(suspicionLevel(surface)));
      assert.equal(dom.window.document.querySelectorAll('.agent-surface-highlight').length, hot.length);
      assert.equal(Boolean(dom.window.document.querySelector('[data-suspected-response="high"]')), high.length > 0);
      if (high.length) assert.match(injectionAssessmentMd(unit).join('\n'), /高度疑似响应/);
      dom.window.close();
    }
  }
  assert.equal(injected, 27);
  assert.equal(skills, 17);
});

test('every downloadable demo result package resolves to the retained run', () => {
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
    assert.ok(readFileSync(path.join(dir, 'task.md'), 'utf8').trim(), `${unit.runId}: demo task definition`);
  }
});

test('demo packages and evidence references match the optional original artifacts', archiveChecks, () => {
  for (const unit of fiveTaskUnits) {
    const dir = path.resolve(demo, unit.resultDir);
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

test('visible task/report pages show per-question roles, original outputs and semantic leakage metrics', () => {
  for (const id of visibleIds) {
    const task = store.getAgentTask(id);
    const workspace = new JSDOM(agentDetailPage({ param: task.id }));
    const detail = workspace.window.document.querySelector('[data-workspace-task]');
    assert.equal(detail.querySelectorAll('[data-ad-question]').length,1);
    assert.equal(detail.querySelectorAll('[data-select-unit]').length,5);
    assert.equal(detail.querySelector('[data-ew-results]'),null);
    assert.deepEqual([...detail.querySelectorAll('[data-ew-tab]')].map(node=>node.textContent),['演练进程','运行日志']);
    assert.ok(detail.querySelector('.task-metric-dashboard').textContent.includes('攻击成功率（ASR）'));
    for (const [index,unit] of task.units.entries()) {
      const wrapper=workspace.window.document.createElement('div');wrapper.innerHTML=renderAgentQuestionFlow(task,unit,index);
      const question=wrapper.firstElementChild;
      assert.deepEqual([...question.querySelectorAll('.ad-role')].map(node => node.textContent),task.technique === 'baseline' ? ['环境','靶标','评估','结果'] : ['环境','攻击者','平台','靶标','评估','结果']);
      assert.match(question.textContent,/完整工具与读取轨迹未记录/);
      assert.doesNotMatch(question.textContent,/第\s*\d+\s*轮|攻破轮次|轮数上限/);
    }
    assert.match(detail.querySelector('[data-task-config]').textContent,/LLM 评估.*历史离线语义复核/s);
    assert.match(task.judgeProvenance,/未调用在线 LLM 裁判/);
    const report = new JSDOM(agentReportDetailPage({ param: task.id }));
    assert.equal(agentMetricLabel(task),'攻击成功率（ASR）');
    assert.equal(report.window.document.querySelector('.rr-result .ring-text span').textContent,agentMetricLabel(task,true));
    assert.match(agentMetricDefinition(task), /不表示攻击诱导成功|不等于确认注入因果/);
    if (task.technique === 'baseline') assert.match(report.window.document.querySelector('.rr-result').textContent, /未启用攻击者.*不表示攻击诱导成功/);
    assert.ok(report.window.document.querySelector('[data-performance="completion"]'));
    assert.ok(report.window.document.querySelector('[data-performance="resistance"]'));
    assert.doesNotMatch(report.window.document.body.textContent, /可复核证据与判断局限/);
    workspace.window.close(); report.window.close();
  }
});
