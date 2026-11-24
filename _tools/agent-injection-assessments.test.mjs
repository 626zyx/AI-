import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentInjectionAssessments, withAgentInjectionAssessment } from '../src/data/agent-injection-assessments.js';

test('output response, partial adoption and observed influence keep separate denominators',()=>{
  const reviews=agentInjectionAssessments.map(row=>row.semanticResponseAssessment);
  assert.equal(reviews.length,5);
  assert.equal(reviews.filter(row=>row.responded===true).length,5);
  assert.equal(reviews.filter(row=>row.adoption==='partial').length,2);
  assert.equal(reviews.filter(row=>row.affected===true).length,3);
  assert.ok(reviews.every(row=>row.inferred===true&&row.source==='2026-11-24 输出语义复核'));
  const echoed=agentInjectionAssessments.find(row=>row.sceneTaskId==='openart-mid-000023').semanticResponseAssessment;
  assert.equal(echoed.adoption,'rejected');assert.equal(echoed.affected,true);
});

test('derived review requires an exact original run and question, preserving telemetry and raw inferences',()=>{
  const record=agentInjectionAssessments[0];
  const unit={runId:record.runId,sceneTaskId:record.sceneTaskId,responseAssessment:{status:'unknown'},attack:{surfaces:[{inferred:true,adopted:'partial'}]}};
  const before=structuredClone(unit),enriched=withAgentInjectionAssessment(unit);
  assert.deepEqual(unit,before);assert.notEqual(enriched,unit);
  assert.deepEqual(enriched.responseAssessment,before.responseAssessment);
  assert.deepEqual(enriched.attack,before.attack);
  enriched.semanticResponseAssessment.evidenceRefs[0].summary='mutated by reader';
  assert.notEqual(withAgentInjectionAssessment(unit).semanticResponseAssessment.evidenceRefs[0].summary,'mutated by reader');
  for(const other of [
    {...unit,runId:unit.runId.replace('universal','baseline')},
    {...unit,runId:'new-run'},
    {...unit,sceneTaskId:'openart-mid-000041'},
    {sceneTaskId:unit.sceneTaskId},
  ])assert.equal(withAgentInjectionAssessment(other),other);
});

test('every review identifies its original archived run and a valid line number',()=>{
  for(const record of agentInjectionAssessments)for(const ref of record.semanticResponseAssessment.evidenceRefs){
    assert.ok(ref.path.includes('/'+record.runId+'/'));
    assert.ok(Number.isInteger(ref.line)&&ref.line>0,ref.path+':'+ref.line);
  }
});

test('every review links to an existing line of the optional original archived run',{
  skip: !fs.existsSync(new URL('../../experiments/five-task-batch-20261119/',import.meta.url)) && 'Original research archive is not distributed with the demo',
},()=>{
  const repository=fileURLToPath(new URL('../../',import.meta.url));
  for(const record of agentInjectionAssessments)for(const ref of record.semanticResponseAssessment.evidenceRefs){
    assert.ok(ref.path.includes('/'+record.runId+'/'));
    const lines=fs.readFileSync(path.join(repository,ref.path),'utf8').split(/\r?\n/);
    assert.ok(Number.isInteger(ref.line)&&ref.line>0&&ref.line<=lines.length,ref.path+':'+ref.line);
    assert.ok(lines[ref.line-1].trim(),ref.path+':'+ref.line);
  }
});
