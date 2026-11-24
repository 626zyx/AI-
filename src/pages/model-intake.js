import * as UI from '../core/ui.js';
import * as Assets from '../domain/asset-intake.js';

const e = UI.esc;
const FIELDS = ['name','apiModel','baseUrl','apiType','authType','apiKey'];
const CONNECTION_FIELDS = ['apiModel','baseUrl','apiType','authType','apiKey'];
const STATUS = {ready:['已连通','green'],pending:['待测试','amber'],failed:['连通失败','red']};
let editor = null, detail = null, boundLayer = null;
const clean = value => String(value ?? '').trim();
const fingerprint = data => JSON.stringify(CONNECTION_FIELDS.map(key => clean(data[key])));
const latestModel = id => {
  const listed = Assets.listModelResources?.().find(row=>row.id===id);
  if (listed) return listed;
  if (Assets.listModelResources) return null;
  const asset = Assets.getAsset(id);
  return asset?.kind==='model' ? Assets.getAsset(id,asset.latestVersion) : null;
};
const field = (key,label,body,{required=false,wide=false}={}) => `<label class="mi-field${wide?' mi-full':''}" for="mi-${key}"><span>${e(label)}${required?' <b class="mi-required">*</b>':''}</span>${body}</label>`;
function input(key,value,placeholder='',extra='') {
  return `<input id="mi-${key}" value="${e(value??'')}" placeholder="${e(placeholder)}" oninput="App.miField('${key}',this.value)" ${editor?.testing||editor?.saving?'disabled':''} ${extra}>`;
}
function hasValidTest() { return Boolean(editor?.test && editor.testFingerprint===fingerprint(editor.form)); }
function reusesSavedTest() { return Boolean(editor?.existingReady && !editor.testError && editor.originalFingerprint===fingerprint(editor.form)); }
function maySave() { return Boolean(editor&&!editor.testing&&!editor.saving&&clean(editor.form.name)&&(hasValidTest()||reusesSavedTest())); }
function collect() {
  if (!editor) return;
  const before=fingerprint(editor.form);
  for(const key of FIELDS){const node=document.getElementById('mi-'+key);if(node)editor.form[key]=node.value;}
  if(before!==fingerprint(editor.form)){editor.test=null;editor.testFingerprint='';editor.error='';}
}
function feedback() {
  if(editor.testing)return {className:'running',text:'正在测试连通…'};
  if(hasValidTest())return {className:'passed',text:'演示连通测试通过'};
  if(reusesSavedTest())return {className:'passed',text:'当前连接已通过演示测试'};
  if(editor.testError)return {className:'failed',text:editor.testError};
  return {className:'pending',text:editor.existing?'连接信息已更改，请重新测试':'请先测试连通，再接入模型'};
}
function updateControls() {
  if(!editor)return;
  const save=document.getElementById('mi-save');if(save)save.disabled=!maySave();
  const error=document.getElementById('mi-error');if(error)error.textContent=editor.error;
  const status=document.getElementById('mi-test-result'),result=feedback();
  if(status){status.className='mi-test-result '+result.className;status.textContent=result.text;}
}
function decorateDrawer() {
  const layer=document.getElementById('drawer');
  if(boundLayer!==layer){boundLayer?.removeEventListener('click',onBackdrop);layer?.addEventListener('click',onBackdrop);boundLayer=layer;}
  const drawer=document.querySelector('#drawer .drawer');
  drawer?.classList.add('mi-drawer');
  const close=drawer?.querySelector('.modal-head .icon-btn');
  if(close)close.setAttribute('onclick','App.miCancel()');
  drawer?.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();actions.miCancel();}});
}
function onBackdrop(event) { if(event.target===boundLayer&&boundLayer.querySelector('.mi-drawer'))actions.miCancel(); }
function renderEditor() {
  const c=editor.form,disabled=editor.testing||editor.saving?'disabled':'';
  const body=`<form class="mi-form" onsubmit="event.preventDefault();App.miSave()" autocomplete="off">
    <div class="mi-fields">
      ${field('name','模型名称',input('name',c.name,'例如：企业对话模型'),{required:true})}
      ${field('apiModel','请求模型标识 (model)',input('apiModel',c.apiModel,'例如：deepseek-chat'),{required:true})}
      ${field('baseUrl','API 地址 (BaseURL)',input('baseUrl',c.baseUrl,'https://api.example.com/v1'),{required:true,wide:true})}
      ${field('apiType','接口类型',`<select id="mi-apiType" onchange="App.miField('apiType',this.value)" ${disabled}><option value="openai" selected>OpenAI 兼容对话接口</option></select>`)}
      ${field('authType','鉴权方式',`<select id="mi-authType" onchange="App.miField('authType',this.value)" ${disabled}><option value="bearer" selected>API Key</option></select>`)}
      ${field('apiKey','API Key',input('apiKey',c.apiKey,editor.credentialConfigured?'已配置，留空保留现有 API Key':'请输入 API Key','type="password" autocomplete="new-password"'),{required:!editor.credentialConfigured,wide:true})}
    </div><div class="mi-feedback"><p id="mi-test-result" class="mi-test-result" role="status" aria-live="polite"></p><p id="mi-error" class="mi-error" role="alert">${e(editor.error)}</p><p class="mi-note">本地演示测试，未向模型服务发送请求。</p></div>
  </form>`;
  const footer=`<div class="mi-footer-left">${UI.btn(editor.testing?'测试中…':'测试连通',{onclick:'App.miTest()',disabled:!!disabled})}</div><div class="mi-footer-right">${UI.btn('取消',{onclick:'App.miCancel()',disabled:editor.saving})}<button id="mi-save" type="button" class="btn w-lg primary" onclick="App.miSave()" ${maySave()?'':'disabled'}>${editor.saving?'保存中…':editor.existing?'保存修改':'接入模型'}</button></div>`;
  UI.drawer(editor.existing?'编辑模型':'接入模型',body,footer);decorateDrawer();updateControls();
}
export function openModelIntake({id,onSaved}={}) {
  const existing=id?latestModel(id):null;
  if(id&&!existing)return UI.toast('模型不存在或已删除');
  if(existing?.busy)return UI.toast('模型正在测试，请稍后重试');
  detail=null;
  const form={...(existing?{id:existing.id}:{}),name:existing?.name||'',apiModel:existing?.apiModel||'',baseUrl:existing?.baseUrl||'',apiType:'openai',authType:'bearer',apiKey:''};
  editor={form,existing:Boolean(existing),existingReady:existing?.status==='ready',credentialConfigured:Boolean(existing?.credentialConfigured),originalFingerprint:fingerprint(form),onSaved,test:null,testFingerprint:'',testError:'',error:'',testing:false,saving:false};
  UI.closeModal();renderEditor();
}
export function modelDetail(id,{onEdit,onDelete,onTest}={}) {
  const asset=latestModel(id);if(!asset)return UI.toast('模型不存在或已删除');
  editor=null;detail={id,onEdit,onDelete,onTest};
  const validation=asset.validation||{},lastIssue=validation.steps?.find(step=>step.state==='failed')?.detail;
  const result=(lastIssue||validation.state==='passed')?(lastIssue||'演示连通测试通过'):'';
  const rows=[['模型名称',asset.name],['请求模型标识 (model)',asset.apiModel],['API 地址 (BaseURL)',asset.baseUrl],['接口类型','OpenAI 兼容对话接口'],['鉴权方式','API Key'],['API Key',asset.credentialConfigured?'已配置':'未配置']];
  const body=`<div class="mi-detail"><dl>${rows.map(([label,value])=>`<div><dt>${e(label)}</dt><dd>${e(value||'—')}</dd></div>`).join('')}<div><dt>接入状态</dt><dd>${UI.badge(...(STATUS[asset.status]||STATUS.pending))}</dd></div></dl>${result?`<p class="mi-detail-result${lastIssue?' failed':''}">${e(result)}</p>`:''}</div>`;
  const footer=`<div class="mi-footer-left">${onTest?UI.btn('测试连通',{onclick:'App.miDetailTest()',disabled:asset.busy}):''}</div><div class="mi-footer-right">${onDelete?UI.btn('删除',{onclick:'App.miDelete()'}):''}${UI.btn('关闭',{onclick:'App.miCancel()'})}${UI.btn('编辑信息',{kind:'primary',onclick:'App.miEdit()'})}</div>`;
  UI.closeModal();UI.drawer(asset.name,body,footer);decorateDrawer();
}

export const actions={
  miField(key,value){
    if(!editor||editor.testing||editor.saving||!FIELDS.includes(key))return;
    if(editor.form[key]===String(value))return;
    editor.form[key]=String(value);
    const node=document.getElementById('mi-'+key);if(node)node.value=String(value);
    if(CONNECTION_FIELDS.includes(key)){editor.test=null;editor.testFingerprint='';editor.testError='';}
    editor.error='';updateControls();
  },
  async miTest(){
    if(!editor||editor.testing||editor.saving)return;
    collect();const current=editor,submitted={...editor.form},tested=fingerprint(submitted);
    current.testing=true;current.test=null;current.testFingerprint='';current.testError='';current.error='';renderEditor();
    try {
      const result=await Assets.testModelConnection(submitted);
      if(editor!==current)return;
      if(fingerprint(current.form)!==tested)return;
      current.test=result;current.testFingerprint=tested;
    } catch(error){if(editor===current)current.testError=error.message||'连通测试失败';}
    finally{current.testing=false;if(editor===current)renderEditor();}
  },
  async miSave(){
    if(!editor||editor.testing||editor.saving)return;
    collect();
    if(!maySave()){editor.error=clean(editor.form.name)?'请先测试当前连接配置':'请填写模型名称';updateControls();return;}
    const current=editor;current.saving=true;current.error='';renderEditor();
    try {
      const saved=await Assets.saveModelResource({...current.form},{connectionTest:hasValidTest()?current.test:undefined});
      if(editor!==current)return;
      const onSaved=current.onSaved;editor=null;UI.closeDrawer();onSaved?.(saved);UI.toast('模型已保存');
    }catch(error){if(editor===current){current.saving=false;current.error=error.message||'保存失败';renderEditor();}}
  },
  miCancel(){editor=null;detail=null;UI.closeDrawer();},
  miEdit(){if(!detail)return;const {id,onEdit}=detail;onEdit?onEdit(id):openModelIntake({id});},
  miDelete(){if(detail?.onDelete)detail.onDelete(detail.id);},
  miDetailTest(){if(detail?.onTest)detail.onTest(detail.id);},
};
