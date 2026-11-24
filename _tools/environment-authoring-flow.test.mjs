import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as E from '../src/domain/agent-environments.js';
import { agentEnvironmentEditorPage as render, agentEnvironmentActions as A } from '../src/pages/agent-environment-editor.js';
import { sceneBanksPage } from '../src/pages/scene-banks.js';
import * as router from '../src/core/router.js';
import { readBundleZip } from '../src/domain/resource-authoring.js';

function setup() {
  const dom = new JSDOM('<main></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', {url:'http://localhost/'});
  globalThis.window=dom.window; globalThis.document=dom.window.document;
  router.setRenderer(()=>document.querySelector('main').innerHTML=router.state().sub==='authoring'?render(router.state()):sceneBanksPage());
  router.nav('strategy','scenebanks');
  return dom;
}
const fileOf=(name,bytes,path)=>({name,webkitRelativePath:path,size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});

test('ZIP import opens one scoped environment editor and checks report in a dismissible dialog',async()=>{
  const dom=setup(),before=new Set(E.getAgentQuestions({status:'all'}).map(x=>x.id));
  try {
    A.aeImportDialog();
    assert.ok(document.querySelector('#drawer.open'));
    assert.equal(document.querySelectorAll('.ae-import-controls summary').length,1);
    assert.equal(document.querySelector('textarea#ae-import-text'),null);
    assert.match(document.querySelector('#ae-import-zip').accept,/zip/);
    await A.aeReadImport({files:[fileOf('single.zip',E.agentEnvironmentTemplateZip())]});
    const env=E.getAgentQuestion(router.state().param);
    assert.equal(router.state().sub,'authoring'); assert.equal(env.status,'draft');
    assert.equal(document.querySelector('.ae-question-pane'),null);
    assert.equal(document.querySelector('.ae-editor-status'),null);
    assert.equal(document.querySelector('#ae-report'),null);
    assert.ok(!env.files['utils/evaluator.py']);
    A.aeCheck(); assert.ok(document.querySelector('#modal.open')); assert.match(document.getElementById('modal').textContent,/检查通过/);
    A.aeClose(); assert.equal(document.querySelector('#modal.open'),null);
    A.aeFile(encodeURIComponent('checkpoints.md')); A.aeCode(''); A.aeCheck();
    assert.match(document.getElementById('modal').textContent,/检查未通过/);
    assert.match(document.getElementById('modal').textContent,/checkpoints.md/);
    assert.doesNotMatch(document.getElementById('modal').textContent,/规则评估/);
    A.aeClose(); A.aeImportDialog();
    await A.aeReadImport({files:[fileOf('unexpected.json',new TextEncoder().encode('{}'))]});
    assert.match(document.getElementById('ae-import-feedback').textContent,/请选择 ZIP/);
    assert.equal(router.state().param,env.id);
  } finally { for(const q of E.getAgentQuestions({status:'all'}))if(!before.has(q.id))E.deleteAgentQuestion(q.id);dom.window.close(); }
});

test('folder import opens only the new numbered batch and direct library opening clears batch navigation',async()=>{
  const dom=setup(),before=new Set(E.getAgentQuestions({status:'all'}).map(x=>x.id));
  try {
    const files=await readBundleZip(E.agentEnvironmentTemplateZip());
    const selected=[];
    for(const group of ['first','second'])for(const [path,content]of Object.entries(files))selected.push(fileOf(path.split('/').at(-1),new TextEncoder().encode(content),`batch/${group}/${path}`));
    A.aeImportDialog(); await A.aeReadFolder({files:selected});
    assert.equal(document.querySelectorAll('.ae-question').length,2);
    assert.match(document.querySelector('.ae-question').textContent,/^1\./);
    const ids=E.getAgentQuestions({status:'draft'}).filter(x=>!before.has(x.id)).map(x=>x.id);
    A.aeCode('# 合规任务更改'); A.aeSwitch(ids[1]);
    assert.equal(router.state().param,ids[0]); assert.match(document.getElementById('modal').textContent,/未保存/);
    A.aeLeave(true); assert.equal(router.state().param,ids[1]);
    assert.equal(E.getAgentQuestion(ids[0]).files['task.md'],'# 合规任务更改');
    assert.equal(document.querySelectorAll('.ae-question').length,2);
    A.aeOpen(E.getAgentQuestions().find(x=>x.source==='system').id);
    assert.equal(document.querySelector('.ae-question-pane'),null);
    assert.equal(document.getElementById('ae-code').readOnly,true);
  } finally { for(const q of E.getAgentQuestions({status:'all'}))if(!before.has(q.id))E.deleteAgentQuestion(q.id);dom.window.close(); }
});
