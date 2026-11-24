import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as store from '../src/domain/store.js';
import { saveManualAgent, getAsset } from '../src/domain/asset-intake.js';
import { initializeAssetBridge } from '../src/domain/asset-bridge.js';
import { listPickerResources } from '../src/core/resource-picker.js';
import { getAgentQuestions } from '../src/domain/agent-environments.js';
import { usableTaskModel } from '../src/domain/agent-configuration.js';

test('an Agent uploaded without a base model selects and preserves its task model without borrowing a historical run', async () => {
  const dom = new JSDOM('<main id="app-main"></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', {url:'http://localhost/'});
  const prior = Object.fromEntries(['window','document','location','history','fetch'].map(key=>[key,globalThis[key]]));
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history,fetch:()=>{throw Error('The demo must not request a model');}});
  const router = await import('../src/core/router.js');
  const wizard = await import('../src/pages/task-wizard.js');
  initializeAssetBridge();
  let taskId;
  try {
    const saved = saveManualAgent({id:'manual-task-unbound',kind:'agent',name:'不绑定模型的测试 Agent',enterpriseVersion:'1.0.0',source:'人工上传',sourceStatus:'已发布',image:'company/agent:1.0',command:['agent'],taskInput:'stdin',surfaceDeclarations:[]});
    assert.equal(saved.baseModelId,'');
    const target = listPickerResources('agent').find(row=>row.assetId===saved.id);
    const model = listPickerResources('model').find(row=>usableTaskModel(row)&&row.assetId);
    assert.ok(target); assert.ok(model);
    router.setRenderer(()=>document.getElementById('app-main').innerHTML=router.state().sub==='ag-task-create'?wizard.taskWizardPage(router.state()):'<p>任务详情</p>');
    wizard.openTaskWizard('agent',{targetId:target.id});
    wizard.actions.twField('name','人工 Agent 在任务内选择模型');
    wizard.actions.twNext();
    wizard.actions.twNext();
    assert.match(document.body.textContent,/请选择可用的靶标基模/);
    assert.equal(document.getElementById('tw-target-model').tagName,'BUTTON');
    wizard.actions.twSelect('targetModelId',model.id);
    await wizard.actions.twValidateSandbox();
    wizard.actions.twNext();
    assert.match(document.querySelector('[aria-current="step"]').textContent,/环境与评估/);
    wizard.actions.twQuestion(getAgentQuestions()[0].id,true);
    wizard.actions.twSelect('judgeId',model.id);
    await wizard.actions.twSave();
    const task=store.listAgentTasks().find(row=>row.name==='人工 Agent 在任务内选择模型');
    assert.ok(task);taskId=task.id;
    assert.equal(task.status,'ready');
    assert.equal(task.configSnapshot.targetModelId,model.id);
    assert.equal(task.configSnapshot.targetSnapshot.baseModelId,'');
    assert.equal(task.configSnapshot.targetModelSnapshot.id,model.assetId);
    assert.equal(task.configSnapshot.targetModelSnapshot.version,model.assetVersion);
    assert.throws(()=>store.startTask(task.id,'agent'),/历史案例不同|不能套用其他运行结果/);
    assert.equal(store.getAgentTask(task.id).status,'ready');
    assert.ok(!getAsset(model.assetId,model.assetVersion).usedBy.includes(task.id));
    assert.equal(getAsset(saved.id).baseModelId,'','task model selection must not rewrite the reusable Agent');
  } finally {
    if(taskId&&store.getAgentTask(taskId)?.status==='running')store.stopTask(taskId,'agent');
    router.setRenderer(null);dom.window.close();
    for(const [key,value] of Object.entries(prior))value===undefined?delete globalThis[key]:globalThis[key]=value;
  }
});
