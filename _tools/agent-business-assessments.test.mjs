import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { agentBusinessAssessmentsByRunId as records, withAgentBusinessAssessment } from '../src/data/agent-business-assessments.js';
import { fiveTaskTasks, fiveTaskUnits } from '../src/data/five-task-batch.js';
import { agentTaskMetrics } from '../src/domain/metrics.js';
import { projectAgentEvaluationUnits } from '../src/domain/agent-replay-source.js';

const ids = ['task-agt-b5-dc-baseline','task-agt-b5-dc-universal'];
const relevant = fiveTaskUnits.filter(unit => ids.includes(unit.taskId));

test('ten versioned business reviews have explicit pass/fail/unknown criteria and original-reference metadata', () => {
  assert.equal(relevant.length,10);
  assert.deepEqual(Object.keys(records).sort(),relevant.map(unit=>unit.runId).sort());
  for(const unit of relevant){
    const record=records[unit.runId];
    assert.equal(record.version,'business-acceptance-v1');
    assert.equal(record.source.kind,'derived-offline-review');
    assert.equal(record.source.reviewedAt,'2026-11-24');
    assert.equal(record.source.onlineModelCalled,false); assert.equal(record.source.rawEvaluationModified,false);
    assert.deepEqual(record.criteria.map(criterion=>criterion.status),['pass','unknown','fail']);
    assert.equal(record.completionAssessment.status,'partial');
    assert.ok(record.criteria.some(criterion=>criterion.required&&criterion.status==='fail'));
    assert.equal(record.errorsAssessment.scope,'business-delivery');
    assert.equal(record.errorsAssessment.label,'业务交付问题率');
    assert.equal(record.errorsAssessment.findings[0].cause,'environment_configuration');
    assert.equal(record.errorsAssessment.findings[0].attributableToAgent,false);
    assert.ok(record.errorsAssessment.excludedItems.includes('安全泄漏'));
    for(const ref of record.evidenceRefs){
      assert.ok(ref.path&&ref.size>0,ref.path);
      assert.match(ref.sha256,/^[a-f0-9]{64}$/);
      assert.ok(Number.isInteger(ref.line)&&ref.line>0,ref.path);
    }
    assert.ok(record.criteria[2].evidenceRefs.some(ref=>ref.kind==='task-definition'));
    assert.ok(record.criteria[2].evidenceRefs.some(ref=>ref.kind.startsWith('archived-')));
  }
});

test('business review references match the optional original research archive', {
  skip: !existsSync(new URL('../../experiments/five-task-batch-20261119/',import.meta.url)) && 'Original research archive is not distributed with the demo',
}, () => {
  for(const unit of relevant)for(const ref of records[unit.runId].evidenceRefs){
    const bytes=readFileSync(new URL(`../../${ref.path}`,import.meta.url));
    assert.equal(bytes.length,ref.size,ref.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),ref.sha256,ref.path);
    assert.ok(ref.line>0&&ref.line<=bytes.toString('utf8').split(/\r?\n/).length,ref.path);
  }
});

test('derived business evidence preserves original security judgments and never appears in unfinished projections', () => {
  for(const unit of relevant){
    const original=structuredClone(unit),reviewed=withAgentBusinessAssessment(unit);
    assert.deepEqual(unit,original,'review attachment cannot mutate the source');
    for(const key of ['verdict','severity','judgeRationale','errors','leaks','triggeredLabels','completionEvidence','attack'])assert.deepEqual(reviewed[key],unit[key],key);
    for(const executionStatus of ['pending','running','stopped']){
      const pending={...unit,executionStatus};
      assert.equal(withAgentBusinessAssessment(pending),pending);
      assert.equal(withAgentBusinessAssessment(pending).completionAssessment,undefined);
    }
    assert.equal(withAgentBusinessAssessment({...unit,executionStatus:'done'}).completionAssessment.status,'partial');
    reviewed.completionAssessment.status='complete';
    assert.equal(records[unit.runId].completionAssessment.status,'partial','returned records are independent copies');
  }
});

test('both cases gain supported zero full completion and full local formation without fabricated adoption', () => {
  for(const id of ids){
    const task=fiveTaskTasks.find(item=>item.id===id),raw=relevant.filter(unit=>unit.taskId===id);
    assert.equal(agentTaskMetrics({...task,units:raw}).completionRate.value,null,'raw archives never contained a full business acceptance');
    for(const mode of ['llm']){
      const evaluated=projectAgentEvaluationUnits(raw,mode),units=evaluated.map(withAgentBusinessAssessment);
      const metrics=agentTaskMetrics({...task,evaluationMode:mode,units});
      assert.equal(metrics.completionRate.value,0); assert.equal(metrics.completionRate.denominator,5);
      assert.equal(metrics.completionRate.unknown,0);
      assert.equal(units.filter(unit=>unit.completionAssessment.status==='partial').length,5);
      assert.equal(units.filter(unit=>unit.localContentAssessment.status==='formed').length,5);
      assert.equal(units.filter(unit=>unit.remoteDeliveryAssessment.status==='blocked').length,5);
      assert.equal(units.filter(unit=>unit.errorsAssessment.findings.length>0).length,5);
      assert.equal(metrics.responseRate.value,null,'business review supplies no observed injection adoption');
      assert.deepEqual(units.map(unit=>unit.verdict),evaluated.map(unit=>unit.verdict));
      assert.deepEqual(units.map(unit=>unit.ruleCheck),evaluated.map(unit=>unit.ruleCheck));
    }
  }
});
