/* Functional model settings and metric grading share the same form primitives. */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { modelConfigurationReturnButton, returnToModelConfiguration } from '../core/model-config-navigation.js';
import { FUNCTIONAL_ROLES, FUNCTIONAL_ROLE_LABEL, functionalModel, checkFunctionalModel } from '../domain/functional-models.js';
import { GRADING_METRICS, listGradeRules, getGradeRule, saveGradeRule, toggleGradeRule, validateGradeRule } from '../domain/grading-rules.js';
import { previewAssetGradeRule } from '../domain/asset-assessments.js';
import { pushNotification } from '../domain/notifications.js';
import { listAssets } from '../domain/asset-intake.js';

const esc=UI.esc, value=id=>document.getElementById(id)?.value??'';
const options=(rows,current)=>rows.map(([id,label])=>`<option value="${esc(id)}"${id===current?' selected':''}>${esc(label)}</option>`).join('');
const field=(label,body,wide=false)=>`<label class="field${wide?' form-wide':''}"><span>${esc(label)}</span>${body}</label>`;
const input=(id,content='',extra='')=>`<input id="${id}" value="${esc(content)}" ${extra}>`;
const roleLabel=role=>FUNCTIONAL_ROLE_LABEL[role]||role;
const roleOptions=FUNCTIONAL_ROLES.map(role=>[role,roleLabel(role)]);
const stateBadge=model=>UI.badge(({connected:'已连通',planned:'待测试',error:'连接失败',checking:'测试中'})[model.status]||'待测试',model.status==='connected'?'green':model.status==='error'?'red':'gray');
const mv={q:'',role:'all'},rv={q:'',kind:'all'};
let batch=[],ruleDraft;
const blankModel=()=>({name:'',apiModel:'',baseUrl:'',apiKey:'',apiType:'openai',roles:[],status:'planned'});
const checked=name=>[...document.querySelectorAll(`input[name="${name}"]:checked`)].map(el=>el.value);
function modelForm(id=''){
  if(id&&!functionalModel(id))return UI.toast('功能模型不存在');
  const m=functionalModel(id)||blankModel();
  const body=`<div class="form-grid">${field('模型名称 *',input('fm-name',m.name))}${field('模型标识 *',input('fm-model',m.apiModel))}
    ${field('接口协议',`<select id="fm-type">${options([['openai','OpenAI 兼容'],['guard','防护审核 API'],['embedding','Embeddings'],['image','图像生成 API']],m.apiType)}</select>`)}
    ${field('服务地址 *',input('fm-url',m.baseUrl,'type="url" placeholder="https://api.example.com/v1"'))}${field('API Key',input('fm-key',m.apiKey,'type="password" autocomplete="off"'))}
    ${field('响应格式',`<select id="fm-format">${options([['chat','对话消息'],['label','审核标签'],['json','结构化 JSON'],['vector','向量']],m.responseFormat||'chat')}</select>`)}
    <fieldset class="form-wide form-choice"><legend>用途</legend>${FUNCTIONAL_ROLES.map(role=>`<label class="check"><input type="checkbox" name="fm-role" value="${role}" ${m.roles.includes(role)?'checked':''}><span>${roleLabel(role)}</span></label>`).join('')}</fieldset>
    <details class="form-wide"><summary>防护接口配置</summary><div class="form-grid mt-12"><fieldset class="form-choice"><legend>支持位置</legend>${['输入','输出'].map(stage=>`<label class="check"><input type="checkbox" name="fm-stage" value="${stage}" ${(m.guardStages||['输入','输出']).includes(stage)?'checked':''}><span>${stage}审核</span></label>`).join('')}</fieldset>${field('判定字段映射',input('fm-map',m.labelMap||'safe=允许; unsafe=阻断'))}</div></details>
    <p class="form-error form-wide" id="fm-error" role="alert"></p></div>`;
  UI.modal(id?'编辑功能模型':'接入功能模型',body,UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('保存',{onclick:`App.fmSave('${id}',false)`})+UI.btn('保存并测试',{kind:'primary',onclick:`App.fmSave('${id}',true)`}),{wide:true});
}
export function rolesPage(){
  const rows=store.platformModels().filter(m=>(!mv.q||`${m.name} ${m.apiModel}`.toLowerCase().includes(mv.q.toLowerCase()))&&(mv.role==='all'||m.roles.includes(mv.role)));
  return UI.pageHead('功能模型',{actions:modelConfigurationReturnButton()+UI.btn('批量接入',{onclick:'App.fmBatch()'})+UI.btn('接入模型',{kind:'primary',ico:'plus',onclick:'App.fmForm()'})})+UI.filters({search:{id:'fm-q',label:'搜索',value:mv.q,placeholder:'名称或模型标识',oninput:'App.fmFilter("q",this.value)'},selects:[{id:'fm-role-filter',label:'用途',value:mv.role,onchange:'App.fmFilter("role",this.value)',options:[['all','全部用途'],...roleOptions]}]})+UI.card('',UI.pagedTable('functional-models',[
    {title:'模型名称',render:m=>`<strong>${esc(m.name)}</strong><div class="muted text-support">${esc(m.apiModel)}</div>`},
    {title:'接口',render:m=>`<span class="clip-1" data-full="${esc(m.baseUrl)}">${esc(m.baseUrl)}</span>`},
    {title:'用途',render:m=>m.roles.length?UI.tagList(m.roles.map(roleLabel),'blue'):UI.badge('待配置','gray')},
    {title:'连通状态',width:'100px',render:stateBadge},
    {title:'操作',width:'210px',render:m=>`<div class="row-actions">${UI.linkBtn('测试',{onclick:`App.fmTest('${m.id}')`})}${UI.linkBtn('用途',{onclick:`App.roleForm('${m.id}')`})}${UI.linkBtn('编辑',{onclick:`App.fmForm('${m.id}')`})}${UI.linkBtn('删除',{danger:true,onclick:`App.fmDelete('${m.id}')`})}</div>`},
  ],rows,'尚未接入功能模型'),'',true);
}
function renderBatch(){
  UI.modal('批量接入功能模型',`<div class="batch-toolbar">${UI.btn('增加一行',{onclick:'App.fmBatchAdd()'})}${UI.btn('粘贴多行',{onclick:'App.fmBatchPaste()'})}<label class="field"><span>批量用途</span><select onchange="App.fmBatchRole(this.value)">${options([['','选择用途'],...roleOptions],'')}</select></label></div>
  <div class="table-wrap batch-model-table"><table class="table"><thead><tr><th>#</th><th>名称</th><th>模型标识</th><th>服务地址</th><th>API Key</th><th>用途</th><th>状态</th><th></th></tr></thead><tbody>${batch.map((m,i)=>`<tr><td>${i+1}</td>${['name','apiModel','baseUrl','apiKey'].map(key=>`<td><input aria-label="第 ${i+1} 行 ${key}" type="${key==='apiKey'?'password':'text'}" value="${esc(m[key])}" oninput="App.fmBatchField(${i},'${key}',this.value)"></td>`).join('')}<td><select aria-label="第 ${i+1} 行用途" onchange="App.fmBatchField(${i},'roles',[this.value])">${options([['','请选择'],...roleOptions],m.roles[0]||'')}</select></td><td><span class="text-support ${m.error?'danger':'muted'}">${esc(m.error||(m.savedId?(functionalModel(m.savedId)?.status==='connected'?'已连通':'已保存 · 待测试'):'待接入'))}</span></td><td>${UI.linkBtn('移除',{onclick:`App.fmBatchRemove(${i})`})}</td></tr>`).join('')}</tbody></table></div>`,UI.btn('关闭',{onclick:'App.fmBatchClose()'})+UI.btn('保存',{onclick:'App.fmBatchSave(false)'})+UI.btn('保存并测试',{kind:'primary',onclick:'App.fmBatchSave(true)'}),{wide:true,cls:'modal-batch'});
}
export function riskRulePage(){
  const rows=listGradeRules().filter(r=>(rv.kind==='all'||r.kind===rv.kind)&&r.name.includes(rv.q));
  return UI.pageHead('数据等级规则',{actions:UI.btn('新建规则',{kind:'primary',ico:'plus',onclick:'App.grForm()'})})+UI.filters({search:{label:'搜索',id:'gr-q',value:rv.q,placeholder:'搜索规则',oninput:'App.grFilter("q",this.value)'},selects:[{id:'gr-kind',label:'适用对象',value:rv.kind,onchange:'App.grFilter("kind",this.value)',options:[['all','全部'],['model','模型'],['agent','智能体']]}]})+UI.card('',UI.pagedTable('grading-rules',[
    {title:'规则名称',render:r=>`<strong>${esc(r.name)}</strong>`},{title:'指标',render:r=>esc(GRADING_METRICS.find(m=>m.key===r.metricKey)?.label)},
    {title:'等级分界',render:r=>r.bounds.map(n=>`${Math.round(n*1000)/10}%`).join(' / ')},
    {title:'适用范围',render:r=>esc(r.assetId?listAssets().find(a=>a.id===r.assetId)?.name:r.kind==='model'?'全部模型':'全部智能体')},
    {title:'状态',width:'80px',render:r=>UI.badge(r.enabled?'已启用':'已停用',r.enabled?'green':'gray')},
    {title:'操作',width:'180px',render:r=>'<div class="row-actions">'+UI.linkBtn('编辑',{onclick:`App.grForm('${r.id}')`})+UI.linkBtn('预览',{onclick:`App.grPreview('${r.id}')`})+UI.linkBtn(r.enabled?'停用':'启用',{onclick:`App.grToggle('${r.id}')`})+'</div>'},
  ],rows),'',true);
}
function ruleForm(id='',data){
  const r=ruleDraft=data||getGradeRule(id)||{id:'',name:'',kind:'model',metricKey:'asr',direction:'high',assetId:'',bounds:[0,.1,.3,.6],minSamples:1,enabled:true,notify:true,affectsAsset:true};
  const metrics=GRADING_METRICS.filter(m=>m.kinds.includes(r.kind));
  UI.modal(id?'编辑等级规则':'新建等级规则',`<div class="form-grid">${field('规则名称 *',input('gr-name',r.name))}${field('对象类型',`<select id="gr-type" onchange="App.grKind(this.value)">${options([['model','模型'],['agent','智能体']],r.kind)}</select>`)}
    ${field('指标',`<select id="gr-metric" onchange="App.grMetric(this.value)">${options(metrics.map(m=>[m.key,m.label]),r.metricKey)}</select>`)}${field('分级方向',`<select id="gr-direction" onchange="App.grDirection(this.value)">${options([['high','数值越高，等级越高'],['low','数值越低，等级越高']],r.direction)}</select>`)}
    ${field('适用资产',`<select id="gr-asset">${options([['','全部同类资产'],...listAssets({kind:r.kind}).map(a=>[a.id,a.name])],r.assetId)}</select>`)}${field('最低有效样本数',input('gr-samples',r.minSamples,'type="number" min="1" step="1"'))}
    <div class="form-wide grade-bound-grid">${r.bounds.map((n,i)=>field(`分界 ${i+1}（%）`,input(`gr-bound-${i}`,Math.round(n*1000)/10,'type="number" min="0" max="100" step="0.1"'))).join('')}</div>
    <div class="form-wide grade-scale">${(r.direction==='low'?['致命','高危','中危','低危','安全']:['安全','低危','中危','高危','致命']).map((label,i)=>`<span>${label}<small>${i===0?`≤ ${r.bounds[0]*100}%`:i===4?`≥ ${r.bounds[3]*100}%`:`${r.bounds[i-1]*100}–${r.bounds[i]*100}%`}</small></span>`).join('')}</div>
    <label class="check"><input id="gr-affects" type="checkbox" ${r.affectsAsset?'checked':''}>计入资产等级</label><label class="check"><input id="gr-notify" type="checkbox" ${r.notify?'checked':''}>等级变化时提醒</label><p class="form-error form-wide" id="gr-error" role="alert"></p></div>`,UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('效果预览',{onclick:'App.grPreview()'})+UI.btn('保存并启用',{kind:'primary',onclick:'App.grSave()'}),{wide:true});
}
function readRule(){return {...ruleDraft,name:value('gr-name'),kind:value('gr-type'),metricKey:value('gr-metric'),direction:value('gr-direction'),assetId:value('gr-asset'),bounds:[0,1,2,3].map(i=>Number(value(`gr-bound-${i}`))/100),minSamples:Number(value('gr-samples')),notify:!!document.getElementById('gr-notify')?.checked,affectsAsset:!!document.getElementById('gr-affects')?.checked};}
const ruleEffects = rule => previewAssetGradeRule(rule);
function notifyGradeEffects(rule,effects){
  if(rule.notify)for(const e of effects.filter(x=>x.changed))pushNotification({type:'grade',kind:e.kind,title:`${e.assetName} · ${e.next.label}`,meta:`${rule.name} · ${e.previous.label} → ${e.next.label}`,go:"App.go('assets','intake')"});
}
export const actions={
  returnToModelConfiguration,gotoRoles(){UI.closeModal();router.nav('platform','roles');},
  fmFilter(k,v){mv[k]=v;UI.resetPage('functional-models');router.nav('platform','roles');},fmForm:modelForm,
  fmSave(id,test){try{const rec={...(functionalModel(id)||blankModel()),id:id||undefined,name:value('fm-name'),apiModel:value('fm-model'),baseUrl:value('fm-url'),apiKey:value('fm-key'),apiType:value('fm-type'),responseFormat:value('fm-format'),labelMap:value('fm-map'),roles:checked('fm-role'),guardStages:checked('fm-stage')};const saved=store.saveModel(rec);if(test){const result=checkFunctionalModel(saved);if(result.status!=='connected'){modelForm(saved);document.getElementById('fm-error').textContent=result.checkMessage;return;}}UI.closeModal();router.nav('platform','roles');UI.toast(test?'接口验证通过':'已保存');}catch(error){document.getElementById('fm-error').textContent=error.message;}},
  async fmTest(id){const m=functionalModel(id);if(!m)return;m.status='checking';router.nav('platform','roles');await new Promise(resolve=>setTimeout(resolve,220));try{checkFunctionalModel(id);router.nav('platform','roles');UI.toast(m.checkMessage);}catch(error){m.status='error';router.nav('platform','roles');UI.toast(error.message);}},
  roleForm(id){const m=functionalModel(id);if(!m)return;UI.modal('配置用途',`<div class="form-role-grid">${FUNCTIONAL_ROLES.map(role=>`<label class="check"><input type="checkbox" name="rf-role" value="${role}" ${m.roles.includes(role)?'checked':''}><span>${roleLabel(role)}</span></label>`).join('')}</div>`,UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('保存',{kind:'primary',onclick:`App.roleSave('${id}')`}));},
  roleSave(id){const m=functionalModel(id);if(!m)return;store.saveModel({...m,roles:checked('rf-role')});UI.closeModal();router.nav('platform','roles');},
  fmDelete(id){if(!functionalModel(id))return UI.toast('功能模型不存在');if(store.modelUsage(id).length)return UI.toast('模型正在被引用，请先调整相关配置');UI.modal('删除功能模型',`<p>删除 ${esc(functionalModel(id).name)}？</p>`,UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('删除',{kind:'danger',onclick:`App.fmDeleteConfirm('${id}')`}));},
  fmDeleteConfirm(id){try{store.deleteModel(id);UI.closeModal();router.nav('platform','roles');}catch(error){UI.toast(error.message);}},
  fmBatch(){batch=[blankModel(),blankModel(),blankModel()];renderBatch();},fmBatchAdd(){batch.push(blankModel());renderBatch();},fmBatchRemove(i){batch.splice(i,1);renderBatch();},fmBatchField(i,k,v){batch[i][k]=v;batch[i].error='';},fmBatchRole(role){if(role)batch.forEach(r=>r.roles=[role]);renderBatch();},fmBatchClose(){UI.closeModal();router.nav('platform','roles');},
  fmBatchPaste(){UI.modal('粘贴模型清单','<label class="field"><span>每行：名称、模型标识、服务地址、API Key</span><textarea id="fm-paste" rows="8" placeholder="使用制表符或逗号分隔"></textarea></label>',UI.btn('返回',{onclick:'App.fmBatchReturn()'})+UI.btn('解析',{kind:'primary',onclick:'App.fmBatchParse()'}),{wide:true});},fmBatchReturn:renderBatch,
  fmBatchParse(){const rows=value('fm-paste').trim().split(/\r?\n/).filter(Boolean).map(line=>line.split(/\t|,/));batch.push(...rows.map(([name,apiModel,baseUrl,apiKey])=>({...blankModel(),name:name||'',apiModel:apiModel||'',baseUrl:baseUrl||'',apiKey:apiKey||''})));batch=batch.filter(r=>r.name||r.apiModel||r.baseUrl);renderBatch();},
  fmBatchSave(test){let saved=0;for(const row of batch){if(!row.name&&!row.apiModel&&!row.baseUrl)continue;try{row.savedId=store.saveModel({...row,id:row.savedId});if(test){const result=checkFunctionalModel(row.savedId);if(result.status!=='connected')throw new Error(result.checkMessage);}row.error='';saved++;}catch(error){row.error=error.message;}}router.nav('platform','roles');renderBatch();UI.toast(`已处理 ${saved} 个模型`);},
  grFilter(k,v){rv[k]=v;UI.resetPage('grading-rules');router.nav('platform','grading');},grForm:ruleForm,
  grKind(kind){const r=readRule();Object.assign(r,{kind,metricKey:'asr',assetId:''});ruleForm(r.id,r);},grDirection(direction){const r=readRule();r.direction=direction;ruleForm(r.id,r);},
  grMetric(metricKey){const r=readRule(),m=GRADING_METRICS.find(item=>item.key===metricKey);Object.assign(r,{metricKey,direction:m.direction,affectsAsset:!m.operational,bounds:m.direction==='low'?[.5,.7,.9,.99]:[0,.1,.3,.6]});ruleForm(r.id,r);},
  grToggle(id){const rule=getGradeRule(id);const effects=ruleEffects({...rule,enabled:!rule.enabled});toggleGradeRule(id);notifyGradeEffects(rule,effects);router.nav('platform','grading');},
  grPreview(id){try{const r=validateGradeRule(id?getGradeRule(id):readRule());if(!id)ruleDraft=r;UI.drawer('等级预览',UI.table([{title:'资产',render:x=>esc(x.assetName)},{title:'指标',render:x=>x.value==null?'—':UI.pct(x.value)},{title:'当前等级',render:x=>UI.badge(x.previous.label,x.previous.cls)},{title:'调整后',render:x=>UI.badge(x.next.label,x.next.cls)}],ruleEffects(id?r:{...r,enabled:true}),'暂无适用的评估结果'),UI.btn('关闭',{onclick:'UI.closeDrawer()'}));}catch(error){const el=document.getElementById('gr-error');if(el)el.textContent=error.message;else UI.toast(error.message);}},
  grSave(){try{const r=validateGradeRule(readRule()),effects=ruleEffects({...r,enabled:true});saveGradeRule({...r,enabled:true});notifyGradeEffects(r,effects);UI.closeModal();UI.closeDrawer();router.nav('platform','grading');UI.toast('等级规则已更新');}catch(error){document.getElementById('gr-error').textContent=error.message;}},
};
