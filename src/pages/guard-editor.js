import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { releaseLabel, releaseNumber } from '../domain/strategy-service.js';
const dimensions=store.guards[0].dims.map(item=>[...item]);
let form=null;
const esc=UI.esc;
const field=(label,body)=>`<label class="field"><span>${label}</span>${body}</label>`;
const select=(id,values,current,change='')=>`<select id="${id}" ${change?`onchange="${change}"`:''}>${values.map(([value,label])=>`<option value="${esc(value)}"${value===current?' selected':''}>${esc(label)}</option>`).join('')}</select>`;
function render(){
  const f=form,models=store.modelsWithRole('防护'),model=models.find(m=>m.id===f.modelId),supported=model?.guardStages||['输入','输出'];
  UI.modal(f.id?'编辑防护方法':'新建防护方法',`<div class="form-grid">
    ${field('方法名称 *',`<input id="gd-name" value="${esc(f.name)}" oninput="App.guardField('name',this.value)">`)}
    ${field('防护模型 *',select('gd-model',[['','请选择防护模型'],...models.map(m=>[m.id,m.name])],f.modelId,"App.guardModel(this.value)"))}
    <fieldset class="form-choice form-wide"><legend>审核位置 *</legend>${['输入','输出'].map(stage=>`<label class="check"><input type="checkbox" name="gd-stage" value="${stage}" ${f.stages.includes(stage)?'checked':''} ${supported.includes(stage)?'':'disabled'} onchange="App.guardStage(this.value,this.checked)"><span>${stage}审核</span></label>`).join('')}</fieldset>
    <fieldset class="form-choice form-wide"><legend>审核维度 *</legend>${dimensions.map(([name,,position])=>`<label class="check"><input type="checkbox" name="gd-dim" value="${esc(name)}" ${f.dims.some(d=>d[0]===name)?'checked':''} ${position==='input'&&!f.stages.includes('输入')?'disabled':''} onchange="App.guardDimension(this.value,this.checked)"><span>${esc(name)}${position==='input'?'（仅输入）':''}</span></label>`).join('')}</fieldset>
    ${field('触发判定',select('gd-threshold',[['unsafe','不安全'],['controversial','有争议或不安全']],f.threshold,"App.guardField('threshold',this.value)"))}
    ${field('触发动作',select('gd-action',[['block','阻断'],['review','转人工复核']],f.action,"App.guardField('action',this.value)"))}
    ${field('审核异常时',select('gd-failure',[['block','阻断'],['allow','放行并记录'],['stop','中止演练']],f.failureAction,"App.guardField('failureAction',this.value)"))}
    ${field('版本',`<input value="${releaseLabel(f.version)}" readonly>`)}
    <details class="form-wide"><summary>接口要求</summary><div class="guard-contract"><div><b>输入审核</b><span>发送靶标请求前执行，阻断后不调用靶标。</span></div><div><b>输出审核</b><span>回复交付前执行，保留原始与最终回复。</span></div><div><b>返回格式</b><span>判定、命中类别与理由；使用功能模型中的字段映射。</span></div></div></details>
    <p id="gd-error" class="form-error form-wide" role="alert"></p></div>`,UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('保存草稿',{onclick:'App.guardSave(false)'})+UI.btn('发布',{kind:'primary',onclick:'App.guardSave(true)'}),{wide:true});
}
export const actions={
  guardForm(id){const existing=id&&store.guardOf(id);if(existing?.builtin)return UI.toast('系统防护方法仅支持查看');if(existing&&existing.status!=='draft')return actions.guardNewVersion(id);form=existing?structuredClone(existing):{name:'',modelId:'',stages:[],dims:[],version:'1.0',threshold:'unsafe',action:'block',failureAction:'block',status:'draft'};render();},
  guardField(key,value){form[key]=value;},
  guardModel(id){form.modelId=id;const model=store.modelsWithRole('防护').find(m=>m.id===id);form.stages=form.stages.filter(stage=>(model?.guardStages||['输入','输出']).includes(stage));if(!form.stages.includes('输入'))form.dims=form.dims.filter(item=>item[2]!=='input');render();},
  guardStage(stage,enabled){const supported=store.modelsWithRole('防护').find(model=>model.id===form.modelId)?.guardStages||['输入','输出'];form.stages=['输入','输出'].filter(s=>supported.includes(s)&&(s===stage?enabled:form.stages.includes(s)));if(!form.stages.includes('输入'))form.dims=form.dims.filter(item=>item[2]!=='input');render();},
  guardDimension(name,enabled){form.dims=dimensions.filter(item=>(item[2]!=='input'||form.stages.includes('输入'))&&(item[0]===name?enabled:form.dims.some(d=>d[0]===item[0])));},
  guardSave(publish){try{store.saveGuard({...form,status:publish?'published':'draft'});UI.closeModal();router.nav('strategy','guard');UI.toast(publish?'防护方法已发布':'草稿已保存');}catch(error){document.getElementById('gd-error').textContent=error.message;}},
  guardNewVersion(id){try{const next=store.newGuardVersion(id);UI.closeDrawer();actions.guardForm(next);}catch(error){UI.toast(error.message);}},
  guardHistory(id){const guard=store.guardOf(id);if(!guard)return;if(guard.builtin)return UI.toast('系统防护方法没有版本');const rows=store.guards.filter(row=>(row.familyId||row.id)===(guard.familyId||guard.id)).sort((a,b)=>releaseNumber(b.version)-releaseNumber(a.version));UI.drawer(`${guard.name} · 版本`,UI.table([{title:'版本',render:g=>releaseLabel(g.version)},{title:'防护模型',render:g=>esc(g.modelSnapshot?.name||store.modelName(g.modelId))},{title:'审核位置',render:g=>g.stages.join(' / ')},{title:'状态',render:g=>UI.badge(store.STRATEGY_STATUS[g.status]||'已发布',g.status==='draft'?'gray':'blue')},{title:'操作',render:g=>UI.linkBtn(g.status==='draft'?'编辑':'详情',{onclick:`App.${g.status==='draft'?'guardForm':'openGuard'}('${g.id}')`})}],rows),UI.btn('关闭',{onclick:'UI.closeDrawer()'}));},
  guardToggle(id){try{const guard=store.guardOf(id);store.setGuardStatus(id,guard?.status==='disabled');UI.closeDrawer();router.nav('strategy','guard');}catch(error){UI.toast(error.message);}},
};
