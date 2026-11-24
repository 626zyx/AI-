import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { agentUnits } from '../src/data/agent-units.js';
import { agentTasks } from '../src/data/agent-tasks.js';
import { agentDetailPage, actions as detailActions } from '../src/pages/agent-detail.js';
import { mountTaskWorkspace } from '../src/pages/task-workspace.js';
import { renderAgentQuestionFlow, agentQuestionTitle } from '../src/pages/agent-question-flow.js';
import * as store from '../src/domain/store.js';
import { buildReplayEvents, projectReplay } from '../src/domain/task-replay.js';
import { currentTaskContent } from '../src/pages/task-content.js';

const legacyUnits = agentUnits.filter(unit => ['task-agt-cs5-baseline', 'task-agt-cs5-universal'].includes(unit.taskId));

test('legacy Agent requirements retain planned steps separate from execution evidence', () => {
  const counts = { '000003':4, '000038':6, '000040':7, '000047':7, '000052':9 };
  assert.equal(legacyUnits.length, 10, 'the legacy source fixture must retain both five-question strategies');
  for (const unit of legacyUnits) {
    assert.equal(unit.taskSteps.length, counts[unit.sceneTaskId.slice(-6)]);
    assert.ok(unit.taskDescription);
    assert.ok(unit.taskSteps.every(step => typeof step === 'string' && step.trim()));
    assert.equal(unit.trace, undefined);
  }
  assert.ok(legacyUnits.every(unit => unit.trace === undefined), 'these legacy fixtures have no recorded tool trace to display');
});

test('legacy Agent requirements match the optional original task definitions verbatim', {
  skip: !existsSync(new URL('../../题库/mid/',import.meta.url)) && 'Original task library is not distributed with the demo',
}, () => {
  for (const unit of legacyUnits) {
    const task = readFileSync(new URL(`../../题库/mid/${unit.sceneTaskId}/task.md`, import.meta.url), 'utf8');
    assert.ok(task.includes(unit.taskDescription));
    const normalizedTask = task.replace(/\*\*([^*]+)\*\*/g, '$1').replaceAll('`', '');
    for (const step of unit.taskSteps) assert.ok(normalizedTask.includes(step));
  }
});

test('Agent shared workspace navigates and searches all questions while preserving each question’s full evidence', () => {
  const dom = new JSDOM('<main></main><div id="drawer"></div>');
  const globals={window:globalThis.window,document:globalThis.document,getComputedStyle:globalThis.getComputedStyle,requestAnimationFrame:globalThis.requestAnimationFrame};
  globalThis.window=dom.window;globalThis.document=dom.window.document;
  globalThis.getComputedStyle=dom.window.getComputedStyle;
  globalThis.requestAnimationFrame=fn=>fn();
  let cleanup;
  try {
    for (const id of ['task-agt-b5-dc-baseline','task-agt-b5-dc-universal']) {
      const task = store.getAgentTask(id), document = dom.window.document;
      document.querySelector('main').innerHTML = agentDetailPage({param:id});
      cleanup=mountTaskWorkspace(document.querySelector('main'));
      const workspace=document.querySelector('[data-workspace-task]'),process=workspace.querySelector('[data-ew-process]');
      assert.equal(document.querySelectorAll('[data-ad-question]').length,1,'the right panel displays one current question');
      assert.equal(document.querySelectorAll('[data-select-unit]').length,5);
      assert.deepEqual([...document.querySelectorAll('[data-select-unit] strong')].map(node=>node.textContent),task.units.map(agentQuestionTitle));
      const roles = task.technique === 'baseline' ? ['环境','靶标','评估','结果'] : ['环境','攻击者','平台','靶标','评估','结果'];
      for (const [index, unit] of task.units.entries()) {
        process.scrollTop=120;
        document.querySelector(`[data-select-unit="${unit.id}"]`).click();
        assert.equal(document.querySelector('[data-workspace-task]'),workspace,'switching questions patches the shared workspace');
        assert.equal(document.querySelector('[data-ew-process]'),process);
        assert.equal(process.scrollTop,0);
        assert.equal(document.querySelectorAll('[data-ew-rows] tr.selected').length,1);
        assert.equal(document.querySelector('[data-ew-rows] tr.selected').dataset.unit,unit.id);
        const question=process.querySelector('[data-ad-question]');
        assert.equal(question.dataset.adQuestion,String(index));
        assert.equal(question.querySelector('h2').textContent,agentQuestionTitle(unit));
        assert.deepEqual([...question.querySelectorAll('.ad-role')].map(node => node.textContent), roles);
        assert.match(question.textContent, /完整工具与读取轨迹未记录/);
        assert.doesNotMatch(question.textContent, /第\s*\d+\s*轮|攻破轮次|轮数上限/);
        const expected=document.createElement('div');expected.innerHTML=renderAgentQuestionFlow(task,unit,index);
        assert.equal(question.outerHTML,expected.firstElementChild.outerHTML,'mounted detail uses the per-question flow without changing its evidence');
        detailActions.agentDetailEvidence(id, unit.id, 'task');
        assert.equal(document.querySelector('#drawer .modal-head h2').textContent,agentQuestionTitle(unit));
        assert.ok(document.getElementById('drawer').textContent.includes(unit.taskDescription));
        for (const step of unit.taskSteps) assert.ok(document.getElementById('drawer').textContent.includes(step));
        detailActions.agentDetailEvidence(id, unit.id, 'outputs');
        assert.deepEqual([...document.querySelectorAll('#drawer tbody tr td:first-child')].map(node => node.textContent), unit.originalOutputFiles.map(file => file.path));
        detailActions.agentDetailEvidence(id, unit.id, 'judge');
        assert.ok(document.getElementById('drawer').textContent.includes(unit.judgeRationale));
        assert.match(document.getElementById('drawer').textContent, /离线语义复核/);
        for(const evidence of unit.reviewEvidence||[])assert.ok(document.getElementById('drawer').textContent.includes(evidence.path));
      }
      const search=document.querySelector('[data-ew-question-search]');
      const visible=()=>[...document.querySelectorAll('[data-ew-rows] tr')].filter(row=>!row.hidden);
      search.value='Nexus';search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
      assert.equal(visible().length,1);assert.match(visible()[0].textContent,/Nexus/);
      visible()[0].querySelector('[data-select-unit]').click();
      assert.equal(document.querySelector('[data-ew-question-search]'),search,'question changes retain the search control');
      assert.equal(search.value,'Nexus');assert.equal(visible().length,1);
      assert.match(process.querySelector('h2').textContent,/Nexus/);
      search.value='no-such-question';search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
      assert.equal(visible().length,0);
      search.value='';search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
      assert.equal(visible().length,5);
      cleanup();cleanup=null;
    }
  } finally { cleanup?.();for(const [key,value] of Object.entries(globals))value===undefined?delete globalThis[key]:globalThis[key]=value;dom.window.close(); }
});

test('Agent replay does not promote inferred traces to execution events and preserves source annotations after completion', () => {
  const source = agentTasks.find(task => task.id === 'task-agt-cs5-universal');
  const original = agentUnits.find(unit => unit.taskId === source.id && unit.sceneTaskId === 'openart-mid-000003');
  assert.ok(original.selfReport, 'this replay fixture requires a recorded final target response');
  const unit = {...original, trace:[{title:'inferred action',detail:'not a recorded tool event',provenance:'inferred'}]};
  const events = buildReplayEvents(source, [unit]);
  assert.equal(events.filter(event => event.stage === 'target').length, 1);
  assert.ok(events.every(event => !event.text.includes('inferred action')));
  const task = {...source, id:'evidence-test',sourceTaskId:source.id,status:'running'};
  const beforeTarget = events.findIndex(event => event.stage === 'target');
  const early = projectReplay(task, source, [unit], events, beforeTarget);
  assert.equal(early.executionUnits[0].selfReport, undefined);
  assert.equal(early.executionUnits[0].completion, undefined);
  const afterTarget = projectReplay(task, source, [unit], events, beforeTarget + 1);
  assert.equal(afterTarget.executionUnits[0].selfReport, unit.selfReport);
  assert.equal(afterTarget.executionUnits[0].completion, undefined);
  assert.equal(afterTarget.executionUnits[0].trace, undefined);
  assert.equal(currentTaskContent({...task,replay:afterTarget.replay},afterTarget.executionUnits[0]).label,'靶标最终答复');
  const done = projectReplay({...task,status:'done'}, source, [unit], events, events.length);
  assert.deepEqual(done.units[0].trace, unit.trace, 'source inference annotations remain auditable without becoming tool events');
  assert.equal(done.units[0].trace[0].provenance, 'inferred');
  assert.notEqual(done.units[0].trace, unit.trace);
  assert.equal(done.units[0].completion,unit.completion);
});

test('recorded tool traces and original products survive replay without revealing final assessments early', () => {
  const source = store.getAgentTask('task-agt-b5-dc-universal');
  const recordedTrace = [{ type:'tool', tool:'read_file', provenance:'recorded', source:{path:'recorded-events.jsonl',line:1}, output:'fixture observation' }];
  const unit = {...source.units[0],trace:recordedTrace};
  const task = {...source,id:'recorded-trace-test',sourceTaskId:source.id,status:'running'};
  const events = buildReplayEvents(source, [unit]);
  const targetIndex = events.findIndex(event => event.stage === 'target');
  const before = projectReplay(task,source,[unit],events,targetIndex).executionUnits[0];
  assert.equal(before.trace,undefined); assert.deepEqual(before.outputFiles,[]);
  const target = projectReplay(task,source,[unit],events,targetIndex+1).executionUnits[0];
  assert.deepEqual(target.outputFiles,unit.originalOutputFiles);
  assert.notDeepEqual(target.outputFiles,unit.outputFiles,'review packages are not target-produced artifacts');
  assert.equal(target.completion,undefined); assert.equal(target.completionEvidence,undefined); assert.equal(target.judgeContent,undefined);
  const done = projectReplay({...task,status:'done'},source,[unit],events,events.length).units[0];
  assert.deepEqual(done.trace,recordedTrace); assert.notEqual(done.trace,recordedTrace);
  assert.deepEqual(done.originalOutputFiles,unit.originalOutputFiles);
  assert.equal(done.completion,unit.completion); assert.deepEqual(done.completionEvidence,unit.completionEvidence);
});
