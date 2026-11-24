import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as store from '../src/domain/store.js';
import { saveAsset, getAsset, validateAsset, savePlatformConnection, platformCatalog, importPlatformAssets, getPlatformConnection, listAssetVersions, listPlatformConnections, listPlatformSyncedAssets, recordPlatformSync, selectAssetVersion, saveManualAgent, deleteManualAgent, manualAgentDeleteError } from '../src/domain/asset-intake.js';
import { initializeAssetBridge } from '../src/domain/asset-bridge.js';
import { listPickerResources, openResourcePicker } from '../src/core/resource-picker.js';

initializeAssetBridge();
const model = (id, extra={}) => ({ id, kind:'model', name:'统一模型 '+id, source:'测试导入清单', sourceKind:'manual', sourceRecordId:'record-'+id, baseUrl:'https://model.example.com/v1', apiModel:'test-chat', ...extra });

async function inDocument(run) {
  const dom = new JSDOM('<button id="origin">选择</button><div id="modal" class="open"><input id="wizard-title" value="尚未保存的任务"></div><div id="drawer"></div><div id="toast"></div>', { url:'http://localhost/' });
  const previous={ window:globalThis.window, document:globalThis.document, location:globalThis.location, history:globalThis.history, fetch:globalThis.fetch };
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history,fetch:()=>{throw Error('resource tests must not send network requests');}});
  try { await run(dom.window); } finally { dom.window.close(); for(const [key,value] of Object.entries(previous))value===undefined?delete globalThis[key]:globalThis[key]=value; }
}

test('unified model resources preserve origin and are not filtered by permanent roles', async()=>{
  const id='picker-unified-model';saveAsset(model(id));await validateAsset(id,{delay:0});
  const item=listPickerResources('model').find(row=>row.assetId===id);
  assert.ok(item);assert.equal(item.source,'测试导入清单');assert.equal(item.sourceRecordId,'record-'+id);
  assert.equal(item.status,'connected');assert.equal(item.actualConnectionVerified,false);
  assert.equal('apiKey' in item,false);assert.equal('apiKey' in item.assetSnapshot,false);
  assert.deepEqual(store.models.find(row=>row.id===item.id).roles,[]);
  assert.equal(store.models.find(row=>row.id===item.id).roleAssignmentMode,'per_use');
});

test('picker search, row selection and confirmation preserve the underlying wizard',async()=>{
  await inDocument(async window=>{
    const id='picker-selection-model';saveAsset(model(id,{name:'待选模型 <script>ignored</script>'}));await validateAsset(id,{delay:0});
    let selected=null;document.getElementById('origin').focus();
    const picker=openResourcePicker({kind:'model',onSelect:row=>selected=row,title:'选择裁判模型'});
    assert.equal(document.getElementById('wizard-title').value,'尚未保存的任务');
    assert.equal(picker.element.querySelector('script'),null);
    const search=picker.element.querySelector('[data-rp-query]');search.value=id;search.dispatchEvent(new window.Event('input',{bubbles:true}));
    assert.equal(picker.element.querySelectorAll('[data-rp-row]').length,1);
    assert.equal(picker.element.querySelector('[data-rp-action="confirm"]').disabled,true);
    const radio=picker.element.querySelector('[data-rp-select]');radio.checked=true;radio.dispatchEvent(new window.Event('change',{bubbles:true}));
    picker.element.querySelector('[data-rp-action="confirm"]').click();
    assert.equal(selected.assetId,id);assert.equal(selected.assetVersion,'V1');assert.ok(store.models.some(row=>row.id===selected.id));
    assert.equal(document.querySelector('.resource-picker-layer'),null);assert.equal(document.getElementById('wizard-title').value,'尚未保存的任务');
  });
});

test('pending resource must pass local demo check before selection and never invokes fetch',async()=>{
  await inDocument(async window=>{
    const id='picker-pending-model';saveAsset(model(id));
    const picker=openResourcePicker({kind:'model',value:id,onSelect:()=>{}});
    let radio=[...picker.element.querySelectorAll('[data-rp-select]')].find(node=>node.dataset.rpSelect.startsWith(id));
    assert.equal(radio.disabled,true);
    [...picker.element.querySelectorAll('[data-rp-test]')].find(node=>node.dataset.rpTest.startsWith(id)).click();
    await new Promise(resolve=>setTimeout(resolve,550));
    radio=[...picker.element.querySelectorAll('[data-rp-select]')].find(node=>node.dataset.rpSelect.startsWith(id));
    assert.equal(radio.disabled,false);assert.equal(getAsset(id).validation.mode,'demo');assert.equal(getAsset(id).validation.actualConnectionVerified,false);
    assert.match(picker.element.textContent,/未发起真实请求/);
    picker.element.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.equal(document.querySelector('.resource-picker-layer'),null);
  });
});

test('disabled source cannot be made selectable by the demo check',async()=>{
  const id='picker-disabled-model';saveAsset(model(id));await validateAsset(id,{delay:0});
  saveAsset({...getAsset(id),sourceStatus:'已停用'});
  assert.equal(listPickerResources('model').find(row=>row.assetId===id).status,'disabled');
  const result=await validateAsset(id,{delay:0});assert.equal(result.status,'failed');
  assert.match(result.validation.steps[0].detail,/已停用/);
});

test('enterprise single and batch import retain provenance, import only selected assets and are idempotent',()=>{
  const connection=savePlatformConnection({name:'测试企业平台',endpoint:'https://assets.example.com',credentialRef:'vault-reference'});
  assert.equal(connection.actualConnected,false);assert.equal(connection.mode,'demo');
  const catalog=platformCatalog(connection.id);const agent=catalog.find(row=>row.kind==='agent'),catalogModel=catalog.find(row=>row.kind==='model');
  assert.equal(agent.baseModelId,'');
  const first=importPlatformAssets(connection.id,[agent.id]);
  assert.equal(first.errors.length,0);assert.equal(first.imported.length,1);assert.deepEqual(first.addedDependencies??[],[]);
  assert.equal(first.imported[0].id,agent.id);assert.equal(first.imported[0].baseModelId,'');assert.equal(getAsset(catalogModel.id),null);
  for(const row of first.imported){assert.equal(row.platformConnectionId,connection.id);assert.equal(row.sourceKind,'enterprise_demo');assert.match(row.source,/测试企业平台/);assert.ok(row.sourceRecordId);}
  const second=importPlatformAssets(connection.id,catalog.map(row=>row.id));
  assert.equal(second.errors.length,0);assert.equal(second.imported.length,2);assert.equal(second.changed.length,1);
  assert.equal(second.changed[0].id,catalogModel.id);assert.equal(listAssetVersions(agent.id).length,1);
  const third=importPlatformAssets(connection.id,catalog.map(row=>row.id));
  assert.equal(third.errors.length,0);assert.equal(third.changed.length,0);
  assert.ok(getPlatformConnection(connection.id).lastImportedAt);
});

test('asset intake scopes connection actions to its tab and keeps model configuration separate from Agent upload',async()=>{
  await inDocument(async()=>{
    const page=await import('../src/pages/asset-intake.js');
    const connections=page.assetIntakePage({tab:'connection'});
    assert.match(connections,/企业资产平台连接/);assert.match(connections,/人工上传/);assert.match(connections,/模型接入配置/);
    const seededConnection=listPlatformConnections().find(row=>row.id==='platform-enterprise-demo');
    assert.ok(seededConnection);assert.equal(seededConnection.actualConnected,false);assert.equal(seededConnection.mode,'demo');
    assert.match(connections,/企业 AI 资产平台（演示）/);
    const syncedSeed=listPlatformSyncedAssets(seededConnection.id);
    assert.equal(syncedSeed.length,1);assert.equal(syncedSeed[0].kind,'agent');
    assert.equal(syncedSeed[0].baseModelId,'');
    assert.equal(syncedSeed[0].sourceStatus,'已发布');assert.equal(syncedSeed[0].status,'pending');
    assert.ok(syncedSeed[0].lastSyncedAt);
    assert.equal(platformCatalog(seededConnection.id).find(row=>row.kind==='agent').imported,true);
    const connectionDOM=JSDOM.fragment(connections);
    const platformLink=[...connectionDOM.querySelectorAll('.ai-platform-name button')].find(node=>node.textContent===seededConnection.name);
    assert.ok(platformLink);assert.equal(platformLink.closest('strong'),null);
    assert.match(platformLink.getAttribute('onclick'),/aiPlatformDetail\('platform-enterprise-demo'\)/);
    assert.equal(connectionDOM.querySelectorAll('.ai-connection-panel button[onclick="App.aiConnectPlatform()"]').length,1);
    assert.doesNotMatch(connections,/>创建<|平台地址|最近导入/);
    assert.match(connections,/API 地址/);assert.match(connections,/最近同步时间/);
    assert.ok([...connectionDOM.querySelectorAll('.badge')].some(node=>node.textContent==='已连通'&&node.classList.contains('green')));
    const rowActions=connectionDOM.querySelector('.ai-connection-actions');
    assert.equal(rowActions.querySelectorAll('button').length,2);
    assert.match(rowActions.querySelectorAll('button')[0].getAttribute('onclick'),/aiSyncPlatform/);
    assert.match(rowActions.querySelectorAll('button')[1].getAttribute('onclick'),/aiConnectPlatform/);
    page.actions.aiPlatformDetail(seededConnection.id);
    assert.equal(document.getElementById('drawer').classList.contains('open'),true);
    assert.equal(document.querySelector('#drawer h2').textContent,seededConnection.name);
    const assetTable=document.querySelector('#drawer .ai-platform-detail table');
    assert.deepEqual([...assetTable.querySelectorAll('thead th')].map(node=>node.textContent.replace(/\s/g,'')),['资产名称/ID','类型','企业版本','地址/镜像','企业资产状态','最近同步时间']);
    const assetCells=assetTable.querySelectorAll('tbody tr td');
    assert.match(assetCells[0].textContent,/企业文档 Agent/);
    assert.equal(assetCells[1].textContent,'智能体');
    assert.equal(assetCells[2].textContent,'1.0.0');
    assert.equal(assetCells[3].textContent,syncedSeed[0].image);
    assert.equal(assetCells[4].textContent,'已发布');
    assert.notEqual(assetCells[5].textContent,'—');
    assert.doesNotMatch(assetTable.textContent,/待检查|pending/);
    assert.equal(document.querySelector('#drawer .ai-synced-fields'),null);
    assert.equal(document.querySelectorAll('#drawer .ai-platform-detail table').length,1);
    assert.doesNotMatch(document.querySelector('#drawer .ai-platform-detail').textContent,/企业更新时间|映射字段/);
    const manualPage=page.assetIntakePage({tab:'manual'});
    assert.doesNotMatch(manualPage,/连接资产平台|ai-kind-filter|aiUpload\('model'\)/);
    const modelPage=page.assetIntakePage({tab:'models'});
    assert.doesNotMatch(modelPage,/配置用途|平台用途|连接资产平台|批量上传|快捷上传|aiImport\(/);
    assert.match(modelPage,/接入模型/);assert.match(modelPage,/测试连通/);
    const modelDOM=JSDOM.fragment(modelPage),modelTable=modelDOM.querySelector('.ai-model-panel table');
    assert.deepEqual([...modelTable.querySelectorAll('thead th')].map(node=>node.textContent.trim()),['','模型名称','请求标识','API 地址','接入状态','操作']);
    assert.ok(modelTable.querySelector('thead th input[type="checkbox"]'));
    assert.doesNotMatch(modelPage,/来源|配置版本|ai-version-select|新建配置版本/);
    assert.ok([...modelTable.querySelectorAll('.row-actions')].every(row=>['编辑信息','删除'].every(text=>[...row.querySelectorAll('button')].some(button=>button.textContent.trim()===text))));
    page.actions.aiUpload('model');
    assert.ok(document.querySelector('#mi-baseUrl'));assert.ok(document.querySelector('#mi-apiModel'));
    assert.equal(document.querySelector('#mi-apiKey').type,'password');
    assert.equal(document.getElementById('drawer').classList.contains('open'),true);
    assert.equal(document.getElementById('modal').classList.contains('open'),false);
    assert.equal(document.querySelector('.ai-kind-switch'),null);
    assert.equal(document.querySelector('input[type="file"]'),null);
    const router=await import('../src/core/router.js');
    page.actions.aiUpload('agent');
    assert.equal(router.state().page,'platform');assert.equal(router.state().sub,'agent-upload');
    assert.equal(document.getElementById('modal').classList.contains('open'),false);
    page.actions.aiConnectPlatform();
    assert.deepEqual(router.state(),{page:'platform',sub:'connection-create',param:''});
    page.actions.aiConnectPlatform(seededConnection.id);
    assert.deepEqual(router.state(),{page:'platform',sub:'connection-edit',param:seededConnection.id});
  });
});

test('platform asset drawer uses the latest synced version and enterprise status independently of local connectivity',async()=>{
  await inDocument(async()=>{
    const connection=savePlatformConnection({name:'已同步版本平台',endpoint:'1',resourcePath:'1',authType:'none'});
    const id='picker-latest-platform-model';
    const first=saveAsset(model(id,{name:'早期模型名称',platformConnectionId:connection.id,sourceRecordId:'enterprise-model-42',enterpriseVersion:'2026.10',sourceStatus:'已发布'}));
    recordPlatformSync(connection.id,[first],'2026-11-24T01:00:00.000Z');
    const latest=saveAsset({...first,name:'最新同步模型',apiModel:'updated-chat',enterpriseVersion:'2026.11',sourceStatus:'已停用'},{mode:'new-version'});
    recordPlatformSync(connection.id,[latest],'2026-11-24T02:00:00.000Z');
    saveAsset(model('picker-unsynced-platform-model',{platformConnectionId:connection.id}));
    selectAssetVersion(id,'V1');
    assert.equal(getAsset(id).version,'V1');
    const synced=listPlatformSyncedAssets(connection.id);
    assert.equal(synced.length,1);assert.equal(synced[0].version,'V2');
    assert.equal(synced[0].status,'pending');assert.equal(synced[0].sourceStatus,'已停用');
    assert.equal(synced[0].lastSyncedAt,'2026-11-24T02:00:00.000Z');
    const page=await import('../src/pages/asset-intake.js');
    page.actions.aiPlatformDetail(connection.id);
    const table=document.querySelector('#drawer .ai-platform-detail table');
    assert.equal(table.querySelectorAll('tbody tr').length,1);
    assert.match(table.textContent,/最新同步模型/);assert.doesNotMatch(table.textContent,/早期模型名称|待检查|pending/);
    const cells=table.querySelectorAll('tbody td');
    assert.match(cells[0].textContent,/enterprise-model-42/);
    assert.equal(cells[2].textContent,'2026.11');assert.equal(cells[3].textContent,latest.baseUrl);
    assert.equal(cells[4].textContent,'已停用');assert.notEqual(cells[5].textContent,'—');
    assert.equal(document.querySelector('#drawer .ai-synced-fields'),null);
  });
});

test('strategy auxiliary pickers keep the full editor page and persist selected models',async()=>{
  await inDocument(async window=>{
    const id='picker-strategy-aux';saveAsset(model(id,{name:'策略辅助模型'}));await validateAsset(id,{delay:0});
    const resource=listPickerResources('model').find(row=>row.assetId===id);
    const {connectResourceCatalog}=await import('../src/domain/resource-authoring.js');connectResourceCatalog(store);
    const {openEditor,actions,strategyEditorPage}=await import('../src/pages/strategy-editor.js');
    const router=await import('../src/core/router.js');
    document.body.insertAdjacentHTML('afterbegin','<main></main>');
    router.setRenderer(()=>{if(router.state().sub==='strategy-create')document.querySelector('main').innerHTML=strategyEditorPage(router.state());});
    openEditor();actions.seField('name','保留输入的组合策略');actions.seField('desc','保留描述与题量');actions.sePreset('in-depth');
    actions.seNext();
    assert.equal(document.querySelector('#se-2-generator').value,'');
    assert.equal(document.querySelector('#se-2-process').value,'');
    const initialModel=listPickerResources('model').find(row=>row.status==='connected'&&row.id!==resource.id);
    ['DeepInception','ReNeLLM','PAIR','Crescendo'].forEach((name,index)=>{
      const definition=store.methods.find(row=>row.name===name);
      for(const key of ['generator','process'])if(definition[key])actions.seAux(index,key,initialModel.id);
    });
    actions.seCustomizeStep(2);actions.seBankN(0,7);actions.seNext();
    assert.equal(document.querySelector('#se-2-generator').tagName,'BUTTON');
    assert.equal(document.querySelector('#se-2-process').tagName,'BUTTON');
    const pageBefore=document.querySelector('main').innerHTML;
    actions.sePickAux(2,'generator');
    assert.equal(document.querySelector('main').innerHTML,pageBefore);
    document.querySelector('[data-rp-action="close"]').click();
    assert.equal(document.querySelector('main').innerHTML,pageBefore);
    for(const key of ['generator','process']){
      actions.sePickAux(2,key);
      const radio=[...document.querySelectorAll('[data-rp-select]')].find(node=>node.dataset.rpSelect===resource.id);
      assert.equal(radio.disabled,false);radio.checked=true;radio.dispatchEvent(new window.Event('change',{bubbles:true}));
      document.querySelector('[data-rp-action="confirm"]').click();
      assert.equal(document.querySelector('#se-'+2+'-'+key).value,resource.id);
      assert.match(document.querySelector('main').textContent,/保留输入的组合策略/);
      assert.match(document.querySelector('main').textContent,/保留描述与题量/);
      assert.match(document.querySelector('main').textContent,/前 7 题/);
    }
    actions.seDraft();
    const saved=store.strategies.find(row=>row.name==='保留输入的组合策略');
    assert.equal(saved.desc,'保留描述与题量');assert.equal(saved.banks[0].count,7);
    assert.deepEqual(saved.methods.map(row=>row.name),['DeepInception','ReNeLLM','PAIR','Crescendo']);
    assert.deepEqual(saved.methods[2].aux,{generator:resource.id,process:resource.id});
    router.setRenderer(null);
  });
});

test('deleting an unused Agent removes both new assets and legacy aliases from the shared picker and store',async()=>{
  const created=saveManualAgent({id:'picker-delete-agent',kind:'agent',name:'删除测试 Agent',enterpriseVersion:'1.0.0',sourceStatus:'已发布',image:'company/delete-agent:1.0',command:['agent'],taskInput:'stdin',surfaceDeclarations:[]});
  const legacy=store.agents.find(row=>!row.assetId&&row.id==='agt-qwen-orchestrator');
  assert.ok(legacy,'the fixture includes an unused legacy alias');
  assert.equal(manualAgentDeleteError(legacy.id,'V1'),'');
  const ids=[created.id,legacy.id];
  for(const id of ids){
    assert.ok(listPickerResources('agent').some(row=>(row.assetId||row.id)===id));
    assert.ok(store.agents.some(row=>(row.assetId||row.id)===id));
    deleteManualAgent(id,'V1');
    assert.equal(getAsset(id),null);assert.deepEqual(listAssetVersions(id),[]);
    assert.ok(!listPickerResources('agent').some(row=>(row.assetId||row.id)===id));
    assert.ok(!store.agents.some(row=>(row.assetId||row.id)===id));
  }
  saveAsset(model('picker-delete-resync-probe'));
  for(const id of ids)assert.ok(!listPickerResources('agent').some(row=>(row.assetId||row.id)===id),'later asset synchronization must not restore a deleted alias');
  await inDocument(async window=>{
    const picker=openResourcePicker({kind:'agent',onSelect:()=>{}});
    for(const id of ids){
      const search=picker.element.querySelector('[data-rp-query]');search.value=id;search.dispatchEvent(new window.Event('input',{bubbles:true}));
      assert.equal(picker.element.querySelectorAll('[data-rp-row]').length,0);
    }
    picker.close();
  });
});
