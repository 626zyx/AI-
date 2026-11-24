import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as store from '../src/domain/store.js';
import { configSummary, mountTaskConfig } from '../src/core/task-config.js';

const input={objectType:'agent',targetId:'agt-deepagents-code-0210',targetModelId:'mdl-deepseek-flash',
  exerciseMode:'attack',attackTemplateId:'universal',attackerId:'mdl-deepseek-flash',
  injectionSurfaceIds:['dcode-user','dcode-skills'],questionIds:['openart-mid-000023','openart-mid-000041'],evaluationMode:'llm',judgeId:'mdl-qwen-flash'};
const overview=task=>{
  const dom=new JSDOM(configSummary(task));
  const rows=[...dom.window.document.querySelectorAll('.tc-overview>div')].map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent]);
  dom.window.close();return Object.fromEntries(rows);
};
function withDrawer(task, check){
  const dom=new JSDOM(`${configSummary(task)}<div id="drawer"></div><div id="toast"></div>`);
  const previous={window:globalThis.window,document:globalThis.document};
  globalThis.window=dom.window;globalThis.document=dom.window.document;
  let cleanup;
  try {
    cleanup=mountTaskConfig(document);document.querySelector('[data-config-toggle]').click();
    check(document.querySelector('#drawer .drawer'),document);
  } finally {
    cleanup?.();globalThis.window=previous.window;globalThis.document=previous.document;dom.window.close();
  }
}

test('Agent summary uses the saved target, selected base, exercise and evaluator instead of legacy strategy',()=>{
  const task={id:'summary-check',objectType:'agent',targetName:'changed live name',strategyName:'obsolete strategy',judgeName:'wrong live judge',
    configSnapshot:{targetName:'Saved Agent',targetModelName:'Saved base',exerciseMode:'baseline',evaluationMode:'llm',judgeId:'mdl-qwen-flash',judgeName:'Saved judge',strategyName:'obsolete strategy'}};
  assert.deepEqual(overview(task),{'靶标':'Saved Agent','所选基模':'Saved base','演练方式':'基础安全演练','评估方式':'LLM 评估 · Saved judge'});
  assert.doesNotMatch(configSummary(task),/obsolete strategy|wrong live judge|changed live name/);
  assert.deepEqual(Object.keys(overview(store.getTask('task-tgt-qwen-flash-guard'))),['靶标','红队','蓝队','裁判']);
});

test('ready Agent configuration shows the selected question and injection scope without claiming archived execution',()=>{
  const id=store.saveTask({...input,name:'Configuration ready scope'}),task=store.getAgentTask(id);
  withDrawer(task,(drawer,document)=>{
    assert.equal(drawer.querySelectorAll('.tc-detail-block').length,2);
    assert.match(drawer.textContent,/所选基模DeepSeek-V3-Flash/);
    assert.match(drawer.textContent,/注入攻击演练/);
    assert.match(drawer.textContent,/攻击模板.*攻击模型/s);
    assert.match(drawer.textContent,/HOME\/.deepagents\/agent\/AGENTS.md/);
    assert.equal(drawer.querySelectorAll('tbody tr').length,2);
    for(const question of input.questionIds)assert.ok(drawer.textContent.includes(question));
    assert.match(drawer.textContent,/评估方式LLM 评估/);
    assert.doesNotMatch(drawer.textContent,/策略名称|规则评估|证据执行来源|未调用/);
    assert.equal(document.querySelector('[data-config-toggle]').getAttribute('aria-expanded'),'true');
    document.querySelector('[data-config-close]').click();
    assert.equal(document.querySelector('[data-config-toggle]').getAttribute('aria-expanded'),'false');
  });
});

test('Agent configuration preserves the selected online Judge while disclosing the actual offline evidence source',()=>{
  const id=store.saveTask({...input,name:'Configuration provenance',evaluationMode:'llm',judgeId:'mdl-qwen-flash'});
  store.startTask(id,'agent');store.advanceTaskReplay(id,'agent',9999);
  const task=store.getAgentTask(id);
  assert.equal(overview(task)['评估方式'],'LLM 评估 · Qwen-Flash');
  withDrawer(task,drawer=>{
    assert.match(drawer.textContent,/裁判模型Qwen-Flash/);
    const provenance=drawer.querySelector('[data-config-execution-source]');
    assert.match(provenance.textContent,/实际评估Codex 离线语义复核/);
    assert.match(provenance.textContent,/未调用本次所选裁判模型/);
    assert.doesNotMatch(provenance.textContent,/实际评估Qwen-Flash/);
  });
  withDrawer(store.getAgentTask('task-agt-b5-dc-baseline'),drawer=>{
    assert.match(drawer.textContent,/所选基模deepseek-flash/);
    assert.match(drawer.textContent,/基础安全演练/);
    assert.match(drawer.querySelector('[data-config-execution-source]').textContent,/Codex 离线语义复核/);
    assert.doesNotMatch(drawer.textContent,/策略名称|攻击模板|攻击模型/);
  });
});
