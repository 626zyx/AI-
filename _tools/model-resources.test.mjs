import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/domain/store.js';
import { initializeAssetBridge } from '../src/domain/asset-bridge.js';
import { listPickerResources } from '../src/core/resource-picker.js';
import {
  assetErrors, getAsset, getAssetSnapshot, importAssets, listAssets, listAssetVersions,
  listTestableAssets, markAssetUsed, saveAsset, selectAssetVersion, updateAssetConnection,
  testModelConnection, saveModelResource, listModelResources, deleteModelResource,
} from '../src/domain/asset-intake.js';

initializeAssetBridge();
const model=(id,extra={})=>({id,name:'API 模型 '+id,apiModel:'demo-chat',baseUrl:'https://model.example.test/v1',apiType:'openai',authType:'bearer',apiKey:'model-intake-test-secret',...extra});
async function create(data){const connectionTest=await testModelConnection(data);return saveModelResource(data,{connectionTest});}

test('model draft testing is local, requires complete connection fields, and never publishes a resource',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=()=>{throw Error('model draft checks must not issue a network request');};
  try{
    const data=model('model-draft-only'),before=listModelResources().length;
    for(const field of ['name','apiModel','baseUrl','apiKey'])await assert.rejects(testModelConnection({...data,[field]:''}));
    for(const baseUrl of ['1','file:///model'])await assert.rejects(testModelConnection({...data,baseUrl}),/HTTP/);
    await assert.rejects(testModelConnection({...data,apiType:'unsupported'}),/协议/);
    await assert.rejects(testModelConnection({...data,authType:'none'}),/鉴权/);
    await assert.rejects(testModelConnection({...data,baseUrl:'https://unreachable.example.test/v1'}),/演示连接检查失败/);
    const connectionTest=await testModelConnection(data);
    assert.equal(connectionTest.state,'passed');assert.equal(connectionTest.mode,'demo');
    assert.equal(connectionTest.actualConnectionVerified,false);assert.ok(connectionTest.checkedAt);
    assert.equal(JSON.stringify(connectionTest).includes(data.apiKey),false);
    assert.equal(getAsset(data.id),null);assert.equal(listModelResources().length,before);
    assert.ok(!listPickerResources('model').some(row=>row.assetId===data.id));
    assert.throws(()=>saveModelResource(data),/先测试/);
    assert.throws(()=>saveModelResource(data,{connectionTest:{token:'forged'}}),/先测试/);
    const saved=saveModelResource({...data,name:'测试后改名',enterpriseVersion:'user-version-is-ignored'},{connectionTest});
    assert.equal(saved.name,'测试后改名');assert.equal(saved.enterpriseVersion,'');
    assert.equal(saved.status,'ready');assert.equal(saved.validation.actualConnectionVerified,false);
    assert.equal(saved.credentialConfigured,true);assert.equal('apiKey' in saved,false);
    assert.equal(JSON.stringify(saved).includes(data.apiKey),false);
  }finally{previous===undefined?delete globalThis.fetch:globalThis.fetch=previous;}
});

test('a model test result cannot be reused across resources, changed connections, or later credential revisions',async()=>{
  const data=model('model-proof-boundary');
  const connectionTest=await testModelConnection(data);
  for(const patch of [{id:'model-proof-other'},{apiModel:'changed-chat'},{baseUrl:'https://other.example.test/v1'},{apiKey:'changed-secret'}]){
    assert.throws(()=>saveModelResource({...data,...patch},{connectionTest}),/先测试|重新测试/);
  }
  assert.equal(getAsset(data.id),null);assert.equal(getAsset('model-proof-other'),null);
  const saved=saveModelResource(data,{connectionTest});
  const edit={id:saved.id,name:saved.name,apiModel:saved.apiModel,baseUrl:saved.baseUrl,apiKey:''};
  const stale=await testModelConnection(edit);
  assert.equal(getAsset(saved.id).status,'ready','testing an existing model does not change its state');
  updateAssetConnection(saved.id,saved.version,{baseUrl:'https://rotated.example.test/v1',apiKey:'rotated-test-secret'});
  assert.throws(()=>saveModelResource(edit,{connectionTest:stale}),/先测试|重新测试/);
  const repaired={...edit,baseUrl:'https://rotated.example.test/v1'};
  const fresh=await testModelConnection(repaired);
  assert.equal(saveModelResource(repaired,{connectionTest:fresh}).status,'ready');
});

test('only a ready unchanged connection can be renamed without another test while blank keys retain private credentials',async()=>{
  const data=model('model-rename');
  const saved=await create(data);
  const renamed=saveModelResource({id:saved.id,name:'仅修改名称',apiModel:saved.apiModel,baseUrl:saved.baseUrl,apiKey:''});
  assert.equal(renamed.name,'仅修改名称');assert.equal(renamed.status,'ready');
  assert.equal(renamed.credentialConfigured,true);assert.equal(renamed.version,'V1');
  assert.equal(renamed.connectionRevision,1);assert.equal('apiKey' in renamed,false);
  const pending=saveAsset({...model('model-pending-name'),kind:'model'});
  assert.throws(()=>saveModelResource({id:pending.id,name:'未测试不能靠改名接入',apiKey:''}),/先测试/);
  assert.equal(getAsset(pending.id).status,'pending');
});

test('editing a used model creates an internal version and preserves historical task snapshots',async()=>{
  const data=model('model-used-history');
  const first=await create(data);
  const taskId=store.saveTask({name:'Model resource history',objectType:'model',targetId:`${first.id}@V1`,strategyId:'stg-advbench-base',judgeId:'mdl-deepseek-flash'});
  markAssetUsed(first.id,'V1',taskId);
  const historical=getAssetSnapshot(first.id,'V1'),taskSnapshot=structuredClone(store.getTask(taskId).configSnapshot);
  const edit={id:first.id,name:'新版模型配置',apiModel:'demo-chat-v2',baseUrl:'https://model-v2.example.test/v1',apiKey:''};
  const second=await create(edit);
  assert.equal(second.version,'V2');assert.equal(second.immutable,false);
  assert.equal(second.credentialConfigured,true);assert.equal(second.apiModel,'demo-chat-v2');
  assert.deepEqual(getAssetSnapshot(first.id,'V1'),historical);
  assert.deepEqual(store.getTask(taskId).configSnapshot,taskSnapshot);
  assert.ok(store.models.some(row=>row.id===`${first.id}@V1`),'stored task targets retain their exact internal version');
  selectAssetVersion(first.id,'V1');
  const latest=listModelResources().filter(row=>row.id===first.id);
  assert.equal(latest.length,1);assert.equal(latest[0].version,'V2');
  assert.deepEqual(listPickerResources('model').filter(row=>row.assetId===first.id).map(row=>row.assetVersion),['V2']);
  assert.equal(listAssetVersions(first.id).length,2);
});

test('deleting a model hides every live entry, invalidates old forms, and keeps history without accidental revival',async()=>{
  const data=model('model-delete-history');
  const saved=await create(data);
  const taskId=store.saveTask({name:'Deleted model history',objectType:'model',targetId:`${saved.id}@V1`,strategyId:'stg-advbench-base',judgeId:'mdl-deepseek-flash'});
  markAssetUsed(saved.id,'V1',taskId);
  const historical=getAssetSnapshot(saved.id,'V1'),taskSnapshot=structuredClone(store.getTask(taskId).configSnapshot);
  const oldForm={id:saved.id,name:saved.name,apiModel:saved.apiModel,baseUrl:saved.baseUrl,apiKey:''};
  const proof=await testModelConnection(oldForm);
  store.models.push({id:saved.id,name:'Legacy alias',status:'connected'});
  assert.deepEqual(deleteModelResource(saved.id),{id:saved.id,deleted:true});
  assert.deepEqual(getAssetSnapshot(saved.id,'V1'),historical);
  assert.deepEqual(store.getTask(taskId).configSnapshot,taskSnapshot);
  for(const rows of [listAssets(),listModelResources(),listTestableAssets(),listPickerResources('model'),store.models,store.platformModels()]){
    assert.ok(!rows.some(row=>row.id===saved.id||row.assetId===saved.id||row.id.startsWith(saved.id+'@')));
  }
  await assert.rejects(testModelConnection(oldForm),/已删除/);
  assert.throws(()=>saveModelResource(oldForm,{connectionTest:proof}),/已删除/);
  assert.throws(()=>deleteModelResource('platform-enterprise-demo:agent'),/模型资源不存在/);
  assert.equal(importAssets([{...data,kind:'model',owner:'同步更新'}]).errors.length,0);
  assert.ok(!listAssets().some(row=>row.id===saved.id));
  assert.ok(!listPickerResources('model').some(row=>row.assetId===saved.id||row.id===saved.id));
});

test('deleting a seeded model removes its legacy alias and Agent demo image references only require a value',()=>{
  const id='mdl-qwen-flash',history=getAssetSnapshot(id,'V1');
  deleteModelResource(id);
  assert.deepEqual(getAssetSnapshot(id,'V1'),history);
  assert.ok(!store.models.some(row=>row.id===id||row.assetId===id||row.id.startsWith(id+'@')));
  assert.ok(!listPickerResources('model').some(row=>row.id===id||row.assetId===id));
  const agent={kind:'agent',name:'Image placeholder',image:'1',command:['agent'],taskInput:'stdin',surfaceDeclarations:[]};
  assert.deepEqual(assetErrors(agent),[]);
  assert.match(assetErrors({...agent,image:'   '}).join('；'),/镜像引用/);
});
