import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as Assets from '../src/domain/asset-intake.js';
import { openModelIntake, modelDetail, actions } from '../src/pages/model-intake.js';

const config = name => ({name,apiModel:'demo-chat',baseUrl:'https://models.example.test/v1',apiType:'openai',authType:'bearer',apiKey:'synthetic-test-key'});
function fill(values) { for(const [key,value] of Object.entries(values))actions.miField(key,value); }
async function withDrawer(run) {
  const dom=new JSDOM('<main></main><div id="modal" class="overlay"></div><div id="drawer" class="overlay drawer-overlay"></div><div id="toast"></div>',{url:'http://localhost/'});
  const previous=Object.fromEntries(['window','document','location','history','fetch'].map(key=>[key,globalThis[key]]));
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history,fetch:()=>{throw Error('Model intake must remain a local demo');}});
  try { await run(dom.window); }
  finally { actions.miCancel();dom.window.close();for(const [key,value] of Object.entries(previous))value===undefined?delete globalThis[key]:globalThis[key]=value; }
}

test('model intake uses the right drawer and only publishes after its local test passes',async()=>{
  await withDrawer(async()=>{
    let saved;
    openModelIntake({onSaved:value=>saved=value});
    const drawer=document.querySelector('#drawer .mi-drawer');
    assert.ok(drawer);assert.equal(document.getElementById('drawer').classList.contains('open'),true);
    assert.equal(document.getElementById('modal').classList.contains('open'),false);
    assert.deepEqual([...drawer.querySelectorAll('.mi-field>span')].map(node=>node.textContent.trim()),['模型名称 *','请求模型标识 (model) *','API 地址 (BaseURL) *','接口类型','鉴权方式','API Key *']);
    assert.equal(document.querySelector('#mi-baseUrl').closest('.mi-field').classList.contains('mi-full'),true);
    assert.equal(document.querySelector('#mi-apiKey').type,'password');
    assert.equal(document.querySelector('#mi-apiType').value,'openai');assert.equal(document.querySelector('#mi-authType').value,'bearer');
    assert.doesNotMatch(drawer.textContent,/来源|版本|资产 ID|负责人/);
    assert.equal(document.querySelector('.mi-footer-left button').textContent,'测试连通');
    assert.equal(document.getElementById('mi-save').disabled,true);
    fill(config('抽屉测试新模型'));
    await actions.miSave();assert.equal(saved,undefined);assert.match(document.getElementById('mi-error').textContent,/先测试/);
    await actions.miTest();
    assert.match(document.getElementById('mi-test-result').textContent,/测试通过/);
    assert.equal(document.getElementById('mi-save').disabled,false);
    assert.ok(!Assets.listModelResources().some(row=>row.name==='抽屉测试新模型'),'testing must not publish a model');
    await actions.miSave();
    assert.ok(saved);assert.equal(saved.status,'ready');assert.equal(saved.validation.actualConnectionVerified,false);
    assert.equal(document.getElementById('drawer').classList.contains('open'),false);
    assert.doesNotMatch(JSON.stringify(Assets.getAssetSnapshot(saved.id,saved.version)),/synthetic-test-key/);
  });
});

test('validation failures stay in the drawer and changes to tested connection fields require a new test',async()=>{
  await withDrawer(async()=>{
    let saved;
    openModelIntake({onSaved:value=>saved=value});
    fill({...config('抽屉重测模型'),apiKey:''});
    await actions.miTest();
    assert.equal(document.getElementById('mi-save').disabled,true);
    assert.match(document.getElementById('mi-test-result').textContent,/API Key|凭据/);
    actions.miField('apiKey','synthetic-retest-key');await actions.miTest();
    assert.equal(document.getElementById('mi-save').disabled,false);
    actions.miField('apiModel','changed-chat');
    assert.equal(document.getElementById('mi-save').disabled,true);
    await actions.miSave();assert.equal(saved,undefined);
    assert.match(document.getElementById('mi-error').textContent,/先测试/);
    await actions.miTest();await actions.miSave();
    assert.equal(saved.apiModel,'changed-chat');
    const originalUrl=saved.baseUrl;
    openModelIntake({id:saved.id,onSaved:value=>saved=value});
    assert.equal(document.getElementById('mi-apiKey').value,'');
    assert.match(document.getElementById('mi-apiKey').placeholder,/留空保留/);
    actions.miField('name','抽屉仅修改名称');
    assert.equal(document.getElementById('mi-save').disabled,false,'an unchanged saved connection can retain its passed test');
    await actions.miSave();assert.equal(saved.name,'抽屉仅修改名称');
    openModelIntake({id:saved.id,onSaved:value=>saved=value});
    actions.miField('baseUrl','https://changed.example.test/v1');
    assert.equal(document.getElementById('mi-save').disabled,true);
    assert.equal(Assets.getAsset(saved.id).baseUrl,originalUrl);
    await actions.miTest();assert.equal(document.getElementById('mi-save').disabled,false);
    await actions.miSave();assert.equal(saved.baseUrl,'https://changed.example.test/v1');
  });
});

test('canceling a tested draft does not save it and direct DOM edits are collected before validation',async()=>{
  await withDrawer(async window=>{
    openModelIntake();fill(config('取消接入模型'));
    await actions.miTest();
    document.getElementById('mi-baseUrl').value='https://unsaved.example.test/v1';
    await actions.miSave();
    assert.equal(document.getElementById('mi-save').disabled,true);assert.match(document.getElementById('mi-error').textContent,/先测试/);
    actions.miCancel();assert.ok(!Assets.listModelResources().some(row=>row.name==='取消接入模型'));
    openModelIntake();fill(config('背景关闭模型'));
    const pending=actions.miTest();
    document.getElementById('drawer').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
    await pending;
    assert.equal(document.getElementById('drawer').classList.contains('open'),false);
    assert.ok(!Assets.listModelResources().some(row=>row.name==='背景关闭模型'));
  });
});

test('model details expose the entered fields and callbacks without versions or secrets',async()=>{
  await withDrawer(async()=>{
    const data=config('只读模型详情');
    const connectionTest=await Assets.testModelConnection(data);
    const saved=Assets.saveModelResource(data,{connectionTest});
    const calls=[];
    modelDetail(saved.id,{onEdit:id=>calls.push(['edit',id]),onDelete:id=>calls.push(['delete',id]),onTest:id=>calls.push(['test',id])});
    const drawer=document.querySelector('#drawer .mi-drawer');
    assert.deepEqual([...drawer.querySelectorAll('dt')].map(node=>node.textContent),['模型名称','请求模型标识 (model)','API 地址 (BaseURL)','接口类型','鉴权方式','API Key','接入状态']);
    assert.match(drawer.textContent,/已配置/);assert.doesNotMatch(drawer.textContent,/synthetic-test-key|来源|版本|资产 ID|负责人/);
    actions.miEdit();actions.miDetailTest();actions.miDelete();
    assert.deepEqual(calls,[['edit',saved.id],['test',saved.id],['delete',saved.id]]);
  });
});
