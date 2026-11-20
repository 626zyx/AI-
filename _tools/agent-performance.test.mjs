import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { agentPerformance } from '../src/domain/agent-performance.js';
import { agentErrorFramework, AGENT_ERROR_TYPES } from '../src/domain/agent-error-framework.js';
import * as store from '../src/domain/store.js';
import { buildReplayEvents, projectReplay } from '../src/domain/task-replay.js';
import { agentReportDetailPage, actions } from '../src/pages/agent-reports.js';

test('failure framework counts unique questions and preserves unrecorded coverage and new categories', () => {
  const row = {stage:'汇总',type:'转述泄漏'};
  const result = agentErrorFramework([
    {id:'a',errors:[row,row,{stage:'发布',type:'转述泄漏'}]},
    {id:'b',errors:[row,{stage:'规划',type:'新增失误'}]},
    {id:'c',errors:[]},
  ]);
  assert.equal(result.totalQuestions, 3);
  assert.equal(result.affectedQuestions, 2);
  const leak = result.rows.find(item => item.key === '转述泄漏');
  assert.equal(leak.count, 2, 'cross-stage totals count each question only once');
  assert.equal(leak.cells.find(cell => cell.stage === '汇总').count, 2);
  assert.equal(leak.cells.find(cell => cell.stage === '发布').count, 1);
  assert.deepEqual(leak.cells.find(cell => cell.stage === '读取'), {stage:'读取',count:null,status:'unrecorded'});
  for (const type of AGENT_ERROR_TYPES) assert.ok(result.rows.some(item => item.key === type.key));
  assert.ok(result.stages.includes('规划'));
  assert.equal(result.rows.find(item => item.key === '新增失误').count, 1);
  assert.ok(agentErrorFramework([]).rows.every(item => item.count === null && item.cells.every(cell => cell.count === null)));
});

test('completion synthesis separates produced content from publication and leaves absent evidence unknown', () => {
  const source = store.getAgentTask('task-agt-cs5-universal');
  const actual = agentPerformance(source);
  assert.match(actual.completion.summary, /各题均已生成内容产物/);
  assert.match(actual.completion.summary, /5 道题的发布尚未完成/);
  assert.match(actual.completion.summary, /服务配置或凭据缺失/);
  assert.match(actual.resistance.summary, /5 道未攻破、0 道已攻破/);
  assert.match(actual.resistance.summary, /元信息披露/);
  assert.deepEqual(actual.completion.items.map(item => item.question), ['000003','000038','000040','000047','000052']);
  assert.deepEqual(actual.resistance.items.map(item => item.content), source.units.map(unit => unit.resistance));
  const mixed = agentPerformance({ units: [source.units[0], {sceneTaskId: 'openart-mid-000038', outputFiles: [{path:'output.json'}]}] });
  assert.match(mixed.completion.summary, /1 道题缺少可汇总的发布状态/);
  assert.doesNotMatch(mixed.completion.summary, /各题均|全部完成|100%/);
  assert.equal(mixed.resistance.items[1].content, '—');
  assert.match(mixed.resistance.summary, /1 道题尚无有效判定/);
  const missing = agentPerformance({units: [{sceneTaskId:'openart-mid-000003',completion:'仅有自由文本'}]});
  assert.match(missing.completion.summary, /缺少可汇总的发布状态/);
  assert.doesNotMatch(missing.completion.summary, /已完成发布|已生成内容产物/);
  assert.equal(agentPerformance({units: []}).completion.summary, '暂无可供汇总的完成度记录。');
});

test('completion evidence is copied with completed replay records and hidden before completion', () => {
  const source = store.getAgentTask('task-agt-cs5-universal'), unit = source.units[0];
  const task = {...source, id:'performance-copy',sourceTaskId:source.id,status:'running'};
  const events = buildReplayEvents(source, [unit]);
  const completeIndex = events.findIndex(event => event.stage === 'unit_complete');
  const early = projectReplay(task, source, [unit], events, completeIndex);
  assert.equal(early.executionUnits[0].completionEvidence, undefined);
  const completed = projectReplay(task, source, [unit], events, completeIndex + 1);
  assert.deepEqual(completed.units[0].completionEvidence, unit.completionEvidence);
  assert.notEqual(completed.units[0].completionEvidence, unit.completionEvidence);
});

test('Agent HTML and Markdown use the same overview and numbered full per-question assessments', async context => {
  const task = store.getAgentTask('task-agt-cs5-universal');
  const expected = agentPerformance(task);
  const report = new JSDOM(agentReportDetailPage({param:task.id})).window.document;
  for (const key of ['completion','resistance']) {
    const section = report.querySelector(`[data-performance="${key}"]`);
    assert.equal(section.querySelector('[data-performance-summary]').textContent, expected[key].summary);
    const entries = [...section.querySelectorAll('.report-question')];
    assert.ok(entries.every(entry => entry.open));
    assert.deepEqual(entries.map(entry => entry.querySelector('summary').textContent), expected[key].items.map(item => `${item.number}. 题目序号${item.question}`));
    assert.deepEqual(entries.map(entry => entry.querySelector('p').textContent), expected[key].items.map(item => item.content));
  }
  const inline = [...report.querySelectorAll('.report-injection')];
  assert.equal(inline.length, task.units.filter(unit => unit.attack).length);
  assert.ok(inline.every(panel => !panel.open && panel.querySelector(':scope > summary').textContent === '查看注入面分析'));
  assert.ok(inline.every(panel => !panel.querySelector('[onclick*="agrpUnit"]')));
  for (const panel of inline) {
    const unit = task.units.find(item => item.id === panel.dataset.injectionUnit);
    for (const surface of unit.attack.surfaces) assert.ok(panel.textContent.includes(surface.path));
    assert.match(panel.textContent, /注入意图|产物对应表现/);
  }
  const dom = new JSDOM('<div id="toast"></div><input id="agex-analysis" type="checkbox" checked><input id="agex-detail" type="checkbox"><input name="agex-fmt" type="radio" value="md" checked>');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {configurable:true,value:dom.window.document});
  const downloads=[];
  context.mock.method(URL,'createObjectURL',blob => {downloads.push(blob);return 'blob:performance';});
  context.mock.method(URL,'revokeObjectURL',()=>{});
  context.mock.method(dom.window.HTMLAnchorElement.prototype,'click',()=>{});
  try {
    actions.agrpExport(task.id);
    const md = await downloads[0].text();
    for (const key of ['completion','resistance']) {
      assert.ok(md.includes(expected[key].summary));
      for (const item of expected[key].items) assert.ok(md.includes(`${item.number}. 题目序号${item.question}，${item.content}`));
    }
    assert.match(md,/### 抵御表现/);
    assert.match(md,/#### 失误维度与类型/);
    assert.match(md,/现有数据未提供逐维度覆盖标记/);
    for (const unit of task.units.filter(item => item.attack)) for (const surface of unit.attack.surfaces) assert.ok(md.includes(surface.path));
  } finally {
    if(previousDocument) Object.defineProperty(globalThis,'document',previousDocument);
    else delete globalThis.document;
    dom.window.close();
  }
});
