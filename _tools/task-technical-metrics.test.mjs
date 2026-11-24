import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/domain/store.js';
import { parseModelTechnicalLogs, taskTechnicalMetrics, taskOperationalMetrics } from '../src/domain/task-technical-metrics.js';
import { renderTaskTechnicalMetrics } from '../src/pages/task-technical-metrics.js';

test('model technical statistics use actual source log spans and measured calls without inventing per-question coverage',()=>{
  const task=store.getTask('task-tgt-qwen-flash');
  const result=taskTechnicalMetrics({...task,maxTokens:999999,replayIntervalMs:999999,startedAt:'2000-01-01',finishedAt:'2100-01-01'});
  assert.equal(result.timing.totalSeconds,3709.571);
  assert.equal(result.tokens.total,382477);
  assert.equal(result.tokens.input,279321);assert.equal(result.tokens.output,103156);
  assert.equal(result.tokens.calls,371);
  assert.equal(result.tokens.maxInput,2936);assert.equal(result.tokens.minInput,27);
  assert.equal(result.tokens.maxOutput,4892);assert.equal(result.tokens.minOutput,1);
  assert.equal(result.tokens.unitMax,null);assert.equal(result.tokens.knownUnits,null);
  assert.equal(result.tokens.complete,false);
  assert.equal(result.timing.unitMaxSeconds,null);
  assert.match(renderTaskTechnicalMetrics(task),/任务总耗时/);
  assert.match(renderTaskTechnicalMetrics(task),/data-metric-range="duration"/);
  assert.match(renderTaskTechnicalMetrics(task),/data-metric-range="tokens"/);
});

test('unfinished model replays cannot preview the full historical usage and missing usage is not zero',()=>{
  const source=store.getTask('task-tgt-qwen-flash');
  for(const status of ['ready','running','stopped']){
    const measured=taskTechnicalMetrics({...source,id:'copy',sourceTaskId:source.id,status});
    assert.equal(measured.tokens.total,null);assert.equal(measured.timing.totalSeconds,null);
  }
  assert.equal(taskTechnicalMetrics({objectType:'model',id:'missing',status:'done'}).tokens.total,null);
  const parsed=parseModelTechnicalLogs([{lines:['2026-11-03 16:01:00,000 - start','2026-11-03 16:01:01,500 - finish']}]);
  assert.equal(parsed.spanSeconds,1.5);assert.equal(parsed.tokens.total,null);
});

test('Agent technical statistics use recorded per-question wall time and keep absent token telemetry unknown',()=>{
  const source=store.getAgentTask('task-agt-b5-dc-universal');
  const measured=taskTechnicalMetrics(source);
  assert.equal(measured.timing.totalSeconds,3760.03);
  assert.equal(measured.timing.unitMaxSeconds,1105.46);assert.equal(measured.timing.maxUnit,'000150');
  assert.equal(measured.timing.unitMinSeconds,527.26);assert.equal(measured.timing.minUnit,'000160');
  assert.equal(measured.timing.knownUnits,5);assert.equal(measured.tokens.total,null);
  const partial=taskTechnicalMetrics({...source,id:'partial',sourceTaskId:source.id,units:source.units.slice(0,1),status:'running'});
  assert.equal(partial.timing.totalSeconds,613.26);assert.equal(partial.timing.knownUnits,1);
  assert.match(renderTaskTechnicalMetrics(source),/Token 总用量.*演示/s);
  assert.doesNotMatch(renderTaskTechnicalMetrics(source),/单次调用 Token/);
});

test('display estimates fill missing telemetry consistently while preserving recorded evidence', () => {
  const source=store.getAgentTask('task-agt-b5-dc-universal');
  const raw=taskTechnicalMetrics(source), shown=taskOperationalMetrics(source);
  assert.equal(shown.execution.value,1);
  assert.equal(shown.execution.executed,5);
  assert.equal(shown.tokens.totalDemo,true);
  assert.ok(shown.tokens.total>0);
  assert.ok(shown.tokens.unitMin<=shown.tokens.unitAverage&&shown.tokens.unitAverage<=shown.tokens.unitMax);
  assert.ok(shown.timing.unitMinSeconds<=shown.timing.unitAverageSeconds&&shown.timing.unitAverageSeconds<=shown.timing.unitMaxSeconds);
  assert.deepEqual(shown,taskOperationalMetrics({...source,id:'copy',sourceTaskId:source.id}));
  assert.deepEqual(raw,taskTechnicalMetrics(source));
  assert.equal(taskOperationalMetrics({objectType:'agent',total:4,units:[{verdict:'breach'},{verdict:'safe'},{executionStatus:'error'},{executionStatus:'running'}]}).execution.value,.5);
});
