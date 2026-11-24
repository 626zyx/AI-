import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as E from '../src/domain/agent-environments.js';
import { sceneBanksPage, actions } from '../src/pages/scene-banks.js';
import * as router from '../src/core/router.js';
import * as UI from '../src/core/ui.js';
import { readBundleZip, validateBundlePath } from '../src/domain/resource-authoring.js';

test('environment filters, selection, batch export and custom-only deletion preserve system questions', async context => {
  const dom=new JSDOM('<main></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>',{url:'http://localhost/'});
  globalThis.window=dom.window;globalThis.document=dom.window.document;
  const drafts=E.createAgentDemoDrafts({title:'批量管理',goal:'整理公开资料',count:17,business:'测试采购',riskLabels:['internal']});
  await E.validateAgentQuestionSandbox(drafts[0].id, { delay: 0 });
  const published=E.publishAgentQuestion(drafts[0].id),downloads=[],names=[],reimported=[];
  context.mock.method(URL,'createObjectURL',blob=>{downloads.push(blob);return 'blob:library';});
  context.mock.method(URL,'revokeObjectURL',()=>{});
  context.mock.method(dom.window.HTMLAnchorElement.prototype,'click',function(){names.push(this.download);});
  router.setRenderer(()=>document.querySelector('main').innerHTML=sceneBanksPage());
  UI.bindPageRerender(()=>document.querySelector('main').innerHTML=sceneBanksPage());
  const text=()=>document.querySelector('main').textContent;
  try {
    router.nav('strategy','scenebanks');
    assert.equal(document.querySelectorAll('.ae-list-toolbar select').length,4);
    assert.equal(document.querySelectorAll('thead th').length,8);
    assert.equal(document.querySelectorAll('tbody tr').length,6);
    assert.equal(document.querySelector('[onclick="App.sbExportSelected()"]').textContent.trim(),'批量导出');
    actions.sbFilter('source','custom');assert.equal(document.querySelectorAll('tbody tr').length,1);
    actions.sbFilter('business','测试采购');actions.sbFilter('risk','internal');
    assert.ok(text().includes(published.title));
    actions.sbFilter('status','draft');assert.equal(document.querySelectorAll('tbody tr').length,15);
    actions.sbSelectPage(true);assert.match(document.querySelector('.ae-selection').textContent,/已选 15 个环境/);
    UI.setPage('agent-environments',2);assert.equal(document.querySelectorAll('tbody tr').length,1);
    actions.sbSelectMatching();assert.match(document.querySelector('.ae-selection').textContent,/已选 16 个环境/);
    actions.sbClearSelection();
    const search=document.getElementById('sb-q');search.focus();search.value='批量管理 017';search.setSelectionRange(8,8);actions.sbSearch(search.value);
    assert.equal(document.activeElement.id,'sb-q');assert.equal(document.querySelectorAll('tbody tr').length,1);
    actions.sbSelectPage(true);
    actions.sbExportSelected();
    assert.match(names[0],/1个环境\.zip$/);assert.equal(downloads[0].type,'application/zip');
    const bytes=await downloads[0].arrayBuffer(),exported=await readBundleZip(bytes);
    const manifest=JSON.parse(exported['manifest.json']);assert.equal(manifest.questions.length,1);
    const directory=manifest.questions[0].directory,metadata=JSON.parse(exported[`${directory}/metadata.json`]);
    assert.equal(metadata.id,drafts[16].id);assert.equal(metadata.title,drafts[16].title);
    const imported=await E.importAgentZip(bytes);reimported.push(...imported);
    assert.equal(imported[0].status,'draft');assert.notEqual(imported[0].id,drafts[16].id);
    assert.equal(imported[0].title,drafts[16].title);assert.deepEqual(imported[0].riskLabels,drafts[16].riskLabels);
    for(const [path,content] of Object.entries(drafts[16].files))assert.equal(imported[0].files[path],content);
    E.deleteAgentQuestion(imported[0].id);
    actions.sbSearch('');actions.sbFilter('source','');actions.sbFilter('business','');actions.sbFilter('risk','');actions.sbFilter('status','');
    const system=E.getAgentQuestions().find(q=>q.source==='system');actions.sbSelect(system.id,true);actions.sbSelect(published.id,true);
    actions.sbDeleteSelected();assert.match(document.getElementById('modal').textContent,/删除所选的 2 个自建环境/);assert.match(document.getElementById('modal').textContent,/排除 1 个系统环境/);
    assert.ok(E.getAgentQuestion(drafts[16].id),'opening confirmation must not delete');
    actions.sbDeleteCancel();assert.ok(E.getAgentQuestion(published.id));
    actions.sbDeleteSelected();actions.sbDeleteConfirm();
    assert.equal(E.getAgentQuestion(drafts[16].id),null);assert.equal(E.getAgentQuestion(published.id),null);assert.ok(E.getAgentQuestion(system.id));
    assert.match(document.querySelector('.ae-selection').textContent,/已选 1 个环境/);
    actions.sbDeleteSelected();assert.match(document.getElementById('toast').textContent,/系统环境不可删除/);
    assert.equal(document.querySelector('[onclick*="aePublishDrafts"]'),null);
  } finally {
    actions.sbClearSelection();actions.sbSearch('');for(const key of ['source','business','risk'])actions.sbFilter(key,'');actions.sbCategory('all');
    [...drafts,...reimported].forEach(q=>{if(E.getAgentQuestion(q.id))E.deleteAgentQuestion(q.id);});dom.window.close();
  }
});

test('batch ZIP isolates duplicate unsafe titles and metadata and imports each question as a separate draft',async()=>{
  const example=E.agentEnvironmentTemplate().questions[0],originals=[],imports=[];
  try{
    for(const business of ['采购','质量'])originals.push(E.saveAgentQuestion({...example,title:'../CON:题目/重复?',business}));
    const bytes=E.exportAgentQuestionsZip(originals.map(q=>q.id)),files=await readBundleZip(bytes);
    const manifest=JSON.parse(files['manifest.json']);
    assert.equal(new Set(manifest.questions.map(q=>q.directory)).size,2);
    for(const path of Object.keys(files))validateBundlePath(path);
    for(const item of manifest.questions){
      assert.doesNotMatch(item.directory,/\.\.|[\\/:*?"<>|]/);
      assert.ok(files[`${item.directory}/task.md`]);
      assert.equal(JSON.parse(files[`${item.directory}/metadata.json`]).id,item.id);
    }
    imports.push(...await E.importAgentZip(bytes));
    assert.equal(imports.length,2);assert.ok(imports.every(q=>q.status==='draft'&&q.source==='custom'));
    assert.deepEqual(imports.map(q=>q.business),['采购','质量']);
    for(const [index,q] of imports.entries())for(const [path,content] of Object.entries(originals[index].files))assert.equal(q.files[path],content);
  }finally{[...originals,...imports].forEach(q=>{if(E.getAgentQuestion(q.id))E.deleteAgentQuestion(q.id);});}
});
