import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom=new JSDOM('<main></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>',{url:'http://localhost/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;
const router=await import('../src/core/router.js');
const A=await import('../src/domain/resource-authoring.js');
const M=await import('../src/domain/model-bank-authoring.js');
await import('../src/pages/resource-authoring.js');
const {modelBankAuthoringPage,actions}=await import('../src/pages/model-bank-authoring.js');
router.setRenderer(()=>{document.querySelector('main').innerHTML=router.state().sub==='bank-authoring'?modelBankAuthoringPage(router.state()):'';});
after(()=>{router.setRenderer(null);dom.window.close();});
const tableRows=()=>document.querySelectorAll('.mb-question-table tbody tr');

test('two-step bank import previews only question content and scenes then publishes immutable incremental releases',async()=>{
 actions.mbCreate();assert.equal(document.querySelector('#modal.open'),null);assert.equal(document.querySelector('#mb-file').accept,'.jsonl,application/x-ndjson');assert.equal(document.querySelector('.mb-question-table'),null);
 actions.mbField('name','两步页面版本验证');actions.mbField('business','客户服务');
 await actions.mbReadFile({files:[{name:'wrong.csv',size:5,text:async()=>''}]});assert.match(document.getElementById('mb-error').textContent,/jsonl/);
 actions.mbExample();actions.mbParse();
 assert.equal(document.querySelector('#mb-jsonl'),null);assert.equal(tableRows().length,3);
 assert.deepEqual([...document.querySelectorAll('.mb-question-table th')].map(el=>el.textContent),['序号','题目内容','场景标签','操作']);
 assert.doesNotMatch(document.querySelector('main').textContent,/攻击用例|预期表现|正常对照|边界对照/);
 actions.mbPublish();const first=A.listAuthoredResources('model').find(r=>r.name==='两步页面版本验证');
 assert.equal(first.version,'1.0');assert.equal(first.status,'published');assert.equal(document.getElementById('mb-name').readOnly,true);assert.equal(document.querySelector('#mb-file'),null);
 const original=structuredClone(first.versions[0]);actions.mbNewVersion(first.id);
 assert.equal(document.querySelector('.mb-question-table'),null);assert.match(document.querySelector('main').textContent,/本次只上传新增内容/);
 actions.mbImportText([JSON.stringify({jailbreak_prompt:first.items[0].prompt,scene:'审批边界'}),JSON.stringify({jailbreak_prompt:'新增边界测试',scene:'新增场景'})].join('\n'));actions.mbParse();
 assert.equal(tableRows().length,2,'only this import is shown, not the three original questions');assert.match(document.querySelector('.mb-duplicate-report').textContent,/1 道与已发布题目重复/);
 actions.mbPublish();assert.match(document.getElementById('mb-error').textContent,/重复/);
 actions.mbRemoveDuplicates();assert.equal(tableRows().length,1);
 actions.mbQuestionDetail(0);assert.ok(document.querySelector('#drawer.open'));assert.equal(document.querySelector('#modal.open'),null);
 document.getElementById('mb-edit-prompt').value='第二版新增的测试问题';document.getElementById('mb-edit-scene').value='新增场景，权限';actions.mbQuestionSave();actions.mbPublish();
 const next=M.getModelBank(first.id);assert.equal(next.version,'2.0');assert.equal(next.items.length,4);assert.equal(next.items[3].prompt,'第二版新增的测试问题');assert.deepEqual(next.items.slice(0,3),original.items);
 actions.mbVersion(first.versions[0].catalogId);assert.equal(tableRows().length,3);assert.doesNotMatch(document.querySelector('.mb-question-table').textContent,/第二版/);actions.mbBack();
});

test('saving and leaving preserves the preview step and compact pagination for large banks',()=>{
 actions.mbCreate();actions.mbField('name','分页草稿验证');actions.mbField('business','金融');
 actions.mbImportText(Array.from({length:35},(_,i)=>JSON.stringify({jailbreak_prompt:`问题 ${i+1}`,scene:'金融业务'})).join('\n'));actions.mbParse();assert.equal(tableRows().length,10);
 actions.mbBack();assert.equal(router.state().sub,'bank-authoring');assert.ok(document.querySelector('#modal.open'));actions.mbStay();assert.equal(tableRows().length,10);
 actions.mbPage(4);assert.equal(tableRows().length,5);actions.mbBack();actions.mbSaveAndLeave();assert.equal(router.state().sub,'banks');
 const saved=A.listAuthoredResources('model').find(r=>r.name==='分页草稿验证');assert.equal(saved.status,'draft');assert.equal(saved.items.length,35);assert.equal(saved.bankEditorStep,1);
 actions.mbOpen(saved.id);assert.equal(document.querySelector('#mb-jsonl'),null);assert.equal(tableRows().length,10);actions.mbPrevious();assert.equal(document.getElementById('mb-name').value,'分页草稿验证');actions.mbBack();
});

test('system and user bank pages have no copy operation and old copy actions cannot create a bank',()=>{
 const before=A.listAuthoredResources('model').length;actions.mbCopy('bank-advbench');assert.equal(A.listAuthoredResources('model').length,before);
 actions.mbOpen('bank-advbench');assert.doesNotMatch(document.querySelector('main').textContent,/复制配置|更新版本|版本 1.0/);assert.equal(tableRows().length,10);actions.mbBack();
});
