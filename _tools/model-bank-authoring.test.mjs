import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/domain/resource-authoring.js';
import * as M from '../src/domain/model-bank-authoring.js';

const question=(prompt,extra={})=>({prompt,scene:'越权操作',expected:'遵循权限',group:'attack',method:'Direct',...extra});
const bank=(name,extra={})=>({name,business:'通用',scenes:['越权操作'],items:[question('基础测试 '+name)],...extra});
function catalogWithTasks(){
 const tasks=[];let notify;
 const catalog={banks:[{id:'system-jsonl-bank',name:'系统 JSONL 题库',source:'system',industry:'通用',scenes:['系统场景'],items:[question('系统原始问题')]}],sceneBanks:[],strategies:[],listTasks:()=>structuredClone(tasks),sceneIdFor:value=>value,subscribeTasks:fn=>{notify=fn;return()=>{notify=null;};}};
 A.connectResourceCatalog(catalog);return {catalog,tasks,changed:()=>notify?.()};
}

test('JSONL parsing reports physical lines, deduplicates question content, and retains original metadata',()=>{
 const row={jailbreak_prompt:' 同一问题 ',jailbreak_method:'Direct',image:'images/a.png',scene:'越权操作',reference_id:'CASE-1'};
 const text='\uFEFF'+[JSON.stringify(row),'',JSON.stringify({...row,jailbreak_prompt:'同一问题'}),JSON.stringify({...row,jailbreak_method:'PAIR'}),JSON.stringify({...row,image:'images/b.png'})].join('\n');
 const preview=M.parseModelBankJsonl(text,{deduplicate:false});
 assert.equal(preview.valid,false);assert.equal(preview.items.length,4);
 assert.deepEqual(preview.report.duplicateRows,[{line:3,firstLine:1},{line:4,firstLine:1},{line:5,firstLine:1}]);
 assert.equal(preview.report.total,4);assert.equal(preview.report.invalid,0);
 const cleaned=M.parseModelBankJsonl(text);
 assert.equal(cleaned.valid,true);assert.equal(cleaned.report.accepted,1);assert.equal(cleaned.report.duplicates,3);
 assert.equal(cleaned.items[0].sourceRecord.reference_id,'CASE-1');
 assert.equal(cleaned.items[0].image,'images/a.png');
 const bad=M.parseModelBankJsonl('\nnot json\n[]\n{"jailbreak_prompt":4}\n{"jailbreak_prompt":""}');
 assert.equal(bad.valid,false);assert.deepEqual(bad.report.errors.map(error=>error.line),[2,3,4,5]);
 assert.equal(M.parseModelBankJsonl('  \n').valid,false);
 const alias=M.parseModelBankJsonl('{"prompt":"兼容已有导出","scene":"已有场景"}');
 assert.equal(alias.items[0].scene,'已有场景');
 const tags=M.parseModelBankJsonl('{"jailbreak_prompt":"标签数组","scenes":["标签甲","标签乙"]}');
 assert.equal(tags.items[0].scene,'标签甲');
});

test('model bank metadata and JSONL-only import are enforced before publishing',()=>{
 catalogWithTasks();
 assert.throws(()=>M.saveModelBankDraft(bank('')),/题库名称/);
 assert.throws(()=>M.saveModelBankDraft(bank('缺业务',{business:''})),/业务领域/);
 assert.throws(()=>M.saveModelBankDraft(bank('缺场景',{items:[{prompt:'缺少题目场景'}]})),/场景/);
 const draft=M.saveModelBankDraft({name:'单场景兼容',business:'金融',scene:'数据安全',items:[]});
 assert.deepEqual(draft.scenes,[]);assert.equal(draft.version,'1.0');
 assert.equal(A.selectableModelBanks().some(row=>row.authoringId===draft.id),false);
 assert.throws(()=>M.publishModelBank(draft.id),/至少保留/);
 assert.throws(()=>M.importModelBankJsonl(draft.id,'[]',{fileName:'questions.json'}),/JSONL/);
 assert.throws(()=>M.importModelBankJsonl(draft.id,'prompt\na',{fileName:'questions.csv'}),/JSONL/);
 const text='{"jailbreak_prompt":"正常题","scene":"数据安全"}';
 M.importModelBankJsonl(draft.id,text);
 assert.deepEqual(M.getModelBank(draft.id).scenes,['数据安全']);
 assert.throws(()=>M.importModelBankJsonl(draft.id,'not json'),/第 1 行/);
 assert.equal(M.getModelBank(draft.id).items[0].prompt,'正常题','invalid import does not replace the saved draft');
 assert.equal(M.publishModelBank(draft.id).status,'published','only question content and scene are required');
 assert.deepEqual(Object.keys(JSON.parse(M.exportModelBankJsonl(draft.id))),['jailbreak_prompt','scene']);
 assert.equal(M.parseModelBankJsonl('{"jailbreak_prompt":"无场景题"}').valid,false);
});

test('published model versions are immutable and use whole major releases with preserved snapshots',()=>{
 const {catalog}=catalogWithTasks();
 const draft=M.saveModelBankDraft(bank('整数版本题库',{version:'99.8'}));
 assert.equal(draft.version,'1.0');
 const v1=M.publishModelBank(draft.id,'首次发布'),first=v1.versions[0],snapshot=structuredClone(first);
 assert.throws(()=>M.saveModelBankDraft({...v1,name:'覆盖'}),/已发布/);
 assert.throws(()=>A.replaceAuthoredDraft(draft.id,'{"jailbreak_prompt":"覆盖"}','jsonl'),/已发布/);
 const edit=M.newModelBankVersion(first.catalogId);
 assert.equal(edit.version,'2.0');assert.equal(edit.status,'draft');
 assert.deepEqual(M.getModelBankVersion(draft.id,'1.0'),snapshot);
 assert.equal(A.selectableModelBanks().filter(row=>row.authoringId===draft.id).length,1);
 assert.equal(A.selectableModelBanks().find(row=>row.authoringId===draft.id).version,'1.0');
 assert.equal(edit.pendingItems.length,0);
 assert.throws(()=>M.publishModelBank(draft.id),/新题目/);
 M.saveModelBankDraft({...edit,pendingItems:[question('下一版问题')]});
 const v2=M.publishModelBank(draft.id,'第二次发布');
 assert.equal(v2.version,'2.0');assert.notEqual(v2.versions[1].catalogId,first.catalogId);
 assert.deepEqual(v2.items.map(item=>item.prompt),[first.items[0].prompt,'下一版问题']);
 assert.deepEqual(M.getModelBankVersion(draft.id,first.catalogId),snapshot);
 assert.equal(catalog.banks.find(row=>row.id===first.catalogId).items[0].prompt,first.items[0].prompt);
 assert.equal(A.selectableModelBanks().find(row=>row.authoringId===draft.id).version,'2.0');
 assert.equal(M.newModelBankVersion(draft.id).version,'3.0');
 assert.equal(JSON.parse(M.exportModelBankJsonl(draft.id,'1.0')).jailbreak_prompt,first.items[0].prompt);
});

test('banks cannot be copied and incremental import compares against immutable published content',()=>{
 const {catalog}=catalogWithTasks(),systemBefore=structuredClone(catalog.banks[0]);
 assert.throws(()=>M.copyModelBank('system-jsonl-bank'),/不支持复制/);
 assert.deepEqual(catalog.banks[0],systemBefore);
 const published=M.publishModelBank(M.saveModelBankDraft(bank('增量更新题库')).id),original=structuredClone(published.versions[0]);
 assert.throws(()=>M.copyModelBank(published.id),/不支持复制/);
 const draft=M.newModelBankVersion(published.id);
 assert.throws(()=>M.saveModelBankDraft({...draft,pendingItems:original.items}),/重复/);
 const text=[{jailbreak_prompt:original.items[0].prompt,scene:'另一标签'},{jailbreak_prompt:'新增问题',scene:'新增场景'}].map(JSON.stringify).join('\n');
 const imported=M.importModelBankJsonl(draft.id,text);
 assert.equal(imported.existingDuplicates,1);assert.equal(imported.bank.pendingItems.length,1);
 const next=M.publishModelBank(draft.id);
 assert.equal(next.items.length,2);assert.deepEqual(next.items[0],original.items[0]);
 assert.deepEqual(M.getModelBankVersion(published.id,'1.0'),original);
 assert.throws(()=>M.deleteModelBank('system-jsonl-bank'),/系统题库/);
});

test('deletion detects executed bank versions from task snapshots and retains usage after a task disappears',()=>{
 const {catalog,tasks,changed}=catalogWithTasks();
 const draft=M.saveModelBankDraft(bank('已用题库')),published=M.publishModelBank(draft.id),catalogId=published.versions[0].catalogId;
 tasks.push({id:'model-bank-used-task',status:'ready',configSnapshot:{banks:[{bankId:catalogId,count:1}]}});
 assert.deepEqual(M.getModelBankUsage(draft.id),{used:false,count:0,taskIds:[]});
 tasks[0].status='running';changed();
 assert.deepEqual(M.getModelBankUsage(catalogId),{used:true,count:1,taskIds:['model-bank-used-task']});
 M.newModelBankVersion(draft.id);
 assert.throws(()=>M.deleteModelBank(draft.id),/已用于演练/);
 tasks.length=0;changed();
 assert.throws(()=>M.deleteModelBank(catalogId),/已用于演练/);
 assert.ok(catalog.banks.some(row=>row.id===catalogId));
 const unused=M.publishModelBank(M.saveModelBankDraft(bank('未用可删')).id);
 assert.deepEqual(M.deleteModelBank(unused.id),{id:unused.id,deleted:true});
 assert.equal(M.getModelBank(unused.id),null);
 assert.ok(!catalog.banks.some(row=>row.authoringId===unused.id));
});

test('removing model demo seeds preserves other authoring kinds and their existing release behavior',()=>{
 const catalog={banks:[],sceneBanks:[],methods:[],agentMethods:[],sceneIdFor:value=>value};
 A.connectResourceCatalog(catalog);
 assert.equal(A.listAuthoredResources('model').some(row=>row.name.startsWith('客服退款业务边界')),false);
 assert.ok(A.listAuthoredResources('agent').some(row=>row.name==='客服资料交付场景'));
 assert.ok(A.listAuthoredResources('agent').some(row=>row.name==='客服资料交付场景 · 扩展计划'));
 const method=A.saveAuthoredDraft({kind:'model-method',name:'保留方法版本',template:'测试 {{prompt}}'});
 A.publishAuthoredResource(method.id);assert.equal(A.newAuthoredVersion(method.id).version,'1.1');
});
