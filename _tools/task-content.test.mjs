import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/domain/store.js';
import { buildReplayEvents, projectReplay } from '../src/domain/task-replay.js';
import { currentTaskContent } from '../src/pages/task-content.js';

test('Agent visible content distinguishes attack delivery, target products and final evaluation',()=>{
  const source=store.getAgentTask('task-agt-b5-dc-universal');
  const unit={...source.units[0],selfReport:'',judgeRationale:'Final judgment marker'};
  const task={...source,id:'content-stages',sourceTaskId:source.id,status:'running'};
  const events=buildReplayEvents(source,[unit]);
  const at=stage=>{
    const cursor=events.findIndex(event=>event.stage===stage)+1;
    const projection=projectReplay(task,source,[unit],events,cursor);
    return {unit:projection.executionUnits[0],content:currentTaskContent({...task,...projection},projection.executionUnits[0])};
  };
  const generated=at('attack');
  assert.equal(generated.content.label,'攻击生成');
  assert.doesNotMatch(generated.content.text,/Final judgment marker|已按规定范围交付/);
  const delivered=at('attack_delivery');
  assert.equal(delivered.content.label,'攻击文件交付');
  for(const surface of unit.attack.surfaces)assert.ok(delivered.content.text.includes(surface.path));
  assert.doesNotMatch(delivered.content.text,/Final judgment marker/);
  const target=at('target');
  assert.equal(target.content.label,'靶标产物');
  for(const file of unit.originalOutputFiles)assert.ok(target.content.text.includes(file.path));
  assert.doesNotMatch(target.content.text,/review\.md|evidence\.json|Final judgment marker/);
  assert.equal(target.unit.completion,undefined);
  const assessed=at('judge');
  assert.equal(assessed.content.label,'LLM 评估');
  assert.equal(assessed.content.text,'Final judgment marker');
  assert.equal(currentTaskContent({...task,status:'ready'},unit).text,'—');
});

test('Agent content retains a recorded final response and labels LLM evaluation without fabricating baseline attacks',()=>{
  const task={objectType:'agent',status:'running',evaluationMode:'llm',replay:{stage:'target'}};
  const unit={executionStatus:'running',selfReport:'Recorded target answer',judgeContent:'Recorded semantic conclusion'};
  assert.deepEqual(currentTaskContent(task,unit),{label:'靶标最终答复',text:'Recorded target answer',role:'target'});
  assert.deepEqual(currentTaskContent({...task,replay:{stage:'judge'}},unit),{label:'LLM 评估',text:'Recorded semantic conclusion',role:'judge'});
  assert.equal(currentTaskContent({...task,replay:{stage:'preparing'}},{executionStatus:'running'}).label,'准备环境');
});
