import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { getAsset, getAssetSnapshot, listAssetVersions, saveManualAgent, markAssetUsed } from '../src/domain/asset-intake.js';
import { initializeAssetBridge } from '../src/domain/asset-bridge.js';
import { listPickerResources, openResourcePicker } from '../src/core/resource-picker.js';
import * as router from '../src/core/router.js';
import { agentIntakePage, openAgentIntake, actions } from '../src/pages/agent-intake.js';

initializeAssetBridge();
const agent = (id, extra={}) => ({id,kind:'agent',name:'页面 Agent '+id,owner:'应用研发',source:'人工上传',sourceStatus:'未发布',enterpriseVersion:'1.0.0',image:'company/page-agent:1.0',command:['page-agent','--auto'],taskInput:'stdin',surfaceDeclarations:[{kind:'instruction',path:'AGENTS.md'}],...extra});

async function withPage(run) {
  const dom = new JSDOM('<main id="app-main"></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>',{url:'http://localhost/'});
  const previous = {window:globalThis.window, document:globalThis.document, location:globalThis.location, history:globalThis.history, fetch:globalThis.fetch};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history,fetch:()=>{throw Error('manual Agent registration must not send network requests');}});
  router.setRenderer(()=>document.getElementById('app-main').innerHTML=router.state().sub.startsWith('agent-')?agentIntakePage():'<p>资产接入列表</p>');
  router.nav('platform','intake');
  try { await run(dom.window); }
  finally {
    document.querySelector('[data-rp-action="close"]')?.click();
    if(router.state().sub.startsWith('agent-')){actions.aiuCancel();actions.aiuDiscard();}
    router.setRenderer(null);dom.window.close();
    for(const [key,value] of Object.entries(previous))value===undefined?delete globalThis[key]:globalThis[key]=value;
  }
}

test('three-step Agent upload preserves the user version and semicolon arguments without a model binding',async()=>{
  await withPage(async()=>{
    const id='agent-intake-created';
    openAgentIntake();
    assert.equal(router.state().sub,'agent-upload');
    assert.equal(document.querySelectorAll('.ai-wizard-steps li').length,3);
    assert.equal(document.querySelector('#modal').classList.contains('open'),false);
    assert.doesNotMatch(document.querySelector('.aiu-page').textContent,/连通检查|测试连通|保存并检查/);
    actions.aiuNext();assert.match(document.querySelector('#aiu-error').textContent,/资产名称/);
    assert.equal(document.querySelector('#aiu-source'),null);
    for(const [key,value] of Object.entries({id,name:'三步上传 Agent',owner:'平台产品组',sourceStatus:'已发布'}))actions.aiuField(key,value);
    actions.aiuField('source','不可编辑的来源');
    actions.aiuNext();assert.match(document.querySelector('#aiu-error').textContent,/配置版本号/);
    assert.equal(document.querySelector('#aiu-enterpriseVersion').value,'');
    assert.equal(document.querySelector('#aiu-version'),null);
    actions.aiuField('enterpriseVersion','release-2026.11');
    actions.aiuNext();
    assert.match(document.querySelector('[aria-current="step"]').textContent,/运行配置/);
    assert.equal(document.querySelector('#aiu-base-model'),null);
    assert.equal(document.querySelector('#aiu-pick-base'),null);
    assert.equal(document.querySelector('#aiu-runtimeEndpoint'),null);
    assert.equal('aiuPickBase' in actions,false);
    actions.aiuNext();assert.match(document.querySelector('#aiu-error').textContent,/命令|镜像/);
    document.querySelector('#aiu-image').value='1';
    document.querySelector('#aiu-command').value='three-step-agent';
    assert.equal(document.querySelector('#aiu-args').tagName,'INPUT');
    document.querySelector('#aiu-args').value='--format; json； --label; customer support';
    actions.aiuField('taskInput','argv');actions.aiuField('promptFlag','-p');
    actions.aiuPrev();assert.equal(document.querySelector('#aiu-name').value,'三步上传 Agent');
    assert.equal(document.querySelector('#aiu-owner').value,'平台产品组');
    assert.equal(document.querySelector('#aiu-enterpriseVersion').value,'release-2026.11');
    actions.aiuNext();assert.equal(document.querySelector('#aiu-image').value,'1');
    assert.equal(document.querySelector('#aiu-command').value,'three-step-agent');
    assert.equal(document.querySelector('#aiu-args').value,'--format; json； --label; customer support');
    actions.aiuNext();assert.match(document.querySelector('[aria-current="step"]').textContent,/注入面/);
    actions.aiuAddSurface();actions.aiuSave();
    assert.match(document.querySelector('#aiu-error').textContent,/明确文件路径/);
    assert.equal(getAsset(id),null);
    const surfaceSelect=document.querySelector('#aiu-surface-kind-0');
    assert.deepEqual([...surfaceSelect.querySelectorAll('optgroup')].map(group=>group.label),['指令与约束','技能与命令','记忆与历史','运行配置']);
    assert.deepEqual([...surfaceSelect.options].map(option=>option.value),['instruction','rule','skill','command','memory:long_term','memory:conversation','memory:task_state','configuration']);
    assert.equal(document.querySelector('#aiu-surface-path-0').placeholder,'AGENTS.md');
    actions.aiuSurface(0,'path','memory/conversation.md');
    actions.aiuSurface(0,'kind','skill');
    assert.equal(document.querySelector('#aiu-surface-path-0').placeholder,'.opencode/skills/urgent-upload/SKILL.md');
    assert.match(document.querySelector('#aiu-surface-hint-0').textContent,/OpenCode/);
    assert.equal(document.querySelector('#aiu-surface-path-0').value,'memory/conversation.md');
    actions.aiuSurface(0,'kind','memory:conversation');
    assert.equal(document.querySelector('#aiu-surface-path-0').placeholder,'.aider.chat.history.md');
    assert.match(document.querySelector('#aiu-surface-hint-0').textContent,/Aider/);
    actions.aiuAddSurface();actions.aiuSurface(1,'path','EXTRA.md');actions.aiuRemoveSurface(1);
    assert.equal(document.querySelector('#aiu-surface-kind-0').value,'memory:conversation');
    assert.equal(document.querySelector('#aiu-surface-path-0').value,'memory/conversation.md');
    actions.aiuSave();assert.equal(router.state().sub,'intake');
    const saved=getAsset(id);
    assert.equal(saved.status,'ready');assert.equal(saved.intakeMode,'configuration');
    assert.equal(saved.validation.state,'not_run');assert.equal(saved.validation.actualConnectionVerified,false);
    assert.deepEqual(saved.command,['three-step-agent','--format','json','--label','customer support']);
    assert.equal(saved.enterpriseVersion,'release-2026.11');
    assert.equal(saved.baseModelId,'');assert.equal(saved.runtimeEndpoint,'');
    assert.equal(saved.taskInput,'argv');assert.equal(saved.promptFlag,'-p');
    assert.equal(saved.sourceStatus,'已发布');assert.equal(saved.owner,'平台产品组');assert.equal(saved.source,'人工上传');
    assert.equal(saved.surfaceDeclarations[0].kind,'memory');assert.equal(saved.surfaceDeclarations[0].subtype,'conversation');
    assert.equal(saved.surfaceDeclarations[0].path,'memory/conversation.md');
    let selected;
    const picker=openResourcePicker({kind:'agent',onSelect:row=>selected=row,value:id});
    const resource=listPickerResources('agent').find(row=>row.assetId===id);
    const selectedRow=picker.element.querySelector(`[data-rp-row="${resource.id}"]`);
    assert.equal(selectedRow.querySelector('[data-rp-select]').disabled,false);
    assert.equal(selectedRow.querySelector('[data-rp-test]'),null);
    assert.match(selectedRow.textContent,/已登记/);
    picker.element.querySelector('[data-rp-action="confirm"]').click();
    assert.equal(selected.assetId,id);assert.equal(selected.actualConnectionVerified,false);
    assert.equal(selected.assetSnapshot.validation.state,'not_run');
  });
});

test('Agent edit collects unsaved DOM changes for the leave guard and saves an independent in-place edit',async()=>{
  await withPage(async()=>{
    const saved=saveManualAgent(agent('agent-intake-edit'));
    openAgentIntake({id:saved.id,version:'V1'});
    assert.equal(router.state().sub,'agent-edit');
    assert.equal(document.querySelector('#aiu-name').value,saved.name);
    document.querySelector('#aiu-name').value='尚未保存的名字';
    actions.aiuCancel();assert.equal(router.state().sub,'agent-edit');
    assert.match(document.getElementById('modal').textContent,/Agent 配置尚未保存/);
    actions.aiuStay();assert.equal(document.querySelector('#aiu-name').value,'尚未保存的名字');
    actions.aiuCancel();actions.aiuDiscard();assert.equal(router.state().sub,'intake');
    assert.equal(getAsset(saved.id).name,saved.name);
    openAgentIntake({id:saved.id,version:'V1'});
    actions.aiuField('owner','更新负责人');actions.aiuNext();
    assert.equal(document.querySelector('#aiu-image').value,saved.image);
    assert.equal(document.querySelector('#aiu-args').value,'--auto');
    assert.equal(document.querySelector('#aiu-base-model'),null);
    actions.aiuNext();assert.equal(document.querySelector('#aiu-surface-path-0').value,'AGENTS.md');
    actions.aiuSurface(0,'path','UPDATED.md');actions.aiuSave();
    assert.equal(router.state().sub,'intake');
    assert.equal(getAsset(saved.id).owner,'更新负责人');
    assert.equal(getAsset(saved.id).surfaceDeclarations[0].path,'UPDATED.md');
    assert.equal(listAssetVersions(saved.id).length,1);
  });
});

test('a used Agent version stays frozen and a new user version preserves independent history',async()=>{
  await withPage(async()=>{
    const saved=saveManualAgent(agent('agent-intake-frozen'));
    markAssetUsed(saved.id,'V1','task-agent-intake-frozen');
    openAgentIntake({id:saved.id,version:'V1'});
    assert.equal(document.querySelector('#aiu-name').disabled,true);
    assert.equal(document.querySelector('#aiu-enterpriseVersion').disabled,true);
    assert.equal(document.querySelector('#aiu-enterpriseVersion').value,'1.0.0');
    actions.aiuField('enterpriseVersion','forbidden-version');
    actions.aiuNext();
    assert.equal(document.querySelector('#aiu-image').disabled,true);
    assert.equal(document.querySelector('#aiu-pick-base'),null);
    assert.equal(document.querySelector('#aiu-runtimeEndpoint'),null);
    actions.aiuField('image','company/forbidden:2');
    actions.aiuNext();assert.equal(document.querySelector('#aiu-surface-path-0').disabled,true);
    actions.aiuSurface(0,'path','FORBIDDEN.md');actions.aiuSave();
    const unchanged=getAsset(saved.id,'V1');
    assert.equal(unchanged.image,saved.image);assert.equal(unchanged.surfaceDeclarations[0].path,'AGENTS.md');
    assert.equal(unchanged.enterpriseVersion,'1.0.0');
    assert.equal(unchanged.immutable,true);assert.equal(unchanged.connectionRevision,1);
    openAgentIntake({id:saved.id,version:'V1',mode:'new-version'});
    assert.equal(router.state().sub,'agent-version');
    assert.equal(document.querySelector('#aiu-version'),null);
    assert.equal(document.querySelector('#aiu-enterpriseVersion').value,'');
    assert.equal(document.querySelector('#aiu-name').disabled,false);
    actions.aiuNext();assert.match(document.querySelector('#aiu-error').textContent,/配置版本号/);
    actions.aiuField('enterpriseVersion','1.0.0');
    actions.aiuNext();assert.equal(document.querySelector('#aiu-image').value,saved.image);
    actions.aiuField('image','company/page-agent:2.0');actions.aiuNext();
    assert.equal(document.querySelector('#aiu-surface-path-0').value,'AGENTS.md');
    actions.aiuAddSurface();actions.aiuSurface(1,'path','NEW.md');actions.aiuSave();
    assert.match(document.querySelector('#aiu-error').textContent,/版本号已存在/);
    assert.equal(listAssetVersions(saved.id).length,1);
    actions.aiuPrev();actions.aiuPrev();actions.aiuField('enterpriseVersion','2.0.0');
    actions.aiuNext();actions.aiuNext();actions.aiuSave();
    const next=getAsset(saved.id,'V2');
    assert.equal(next.image,'company/page-agent:2.0');assert.equal(next.immutable,false);
    assert.equal(next.enterpriseVersion,'2.0.0');
    assert.equal(next.status,'ready');assert.equal(next.surfaceDeclarations.length,2);
    assert.equal(getAssetSnapshot(saved.id,'V1').surfaceDeclarations.length,1);
    assert.equal(getAssetSnapshot(saved.id,'V1').image,saved.image);
    assert.equal(getAssetSnapshot(saved.id,'V1').enterpriseVersion,'1.0.0');
    assert.equal(listAssetVersions(saved.id).length,2);
  });
});
