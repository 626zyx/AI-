/* One-page strategy composition. Published content remains read-only. */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { configureMoreModels } from '../core/model-config-navigation.js';
import { renderModelComposer, hydrateModelComposition, serializeModelComposition, modelCompositionError } from '../core/model-composer.js';
import { createMethodInstance } from '../domain/method-defaults.js';

const st={id:null,name:'',desc:'',composition:{methods:[],banks:[]},dirty:false,routeKey:null,readOnly:false,error:''};
let pendingNavigation=null;
const edit=()=>!st.readOnly,dirty=()=>{st.dirty=true;st.error='';};
const methodOf=name=>store.methods.find(method=>method.name.toLowerCase()===String(name).toLowerCase());
function render(){router.nav('strategy','strategy-create',st.id||null,{replace:true});}
function fail(message){st.error=message;render();UI.toast(message);return false;}
function reset(id=null){
  Object.assign(st,{id:null,name:'',desc:'',composition:{methods:[],banks:[]},dirty:false,routeKey:id||'__new',readOnly:false,error:''});
  if(!id)return true;const record=store.strategies.find(row=>row.id===id);if(!record)return false;
  Object.assign(st,{id:record.id,name:record.name,desc:record.desc||'',composition:hydrateModelComposition(record),readOnly:record.status==='published'});return true;
}
export function strategyEditorPage(cur={}){
  const key=cur.param||'__new';if(st.routeKey!==key&&!reset(cur.param))return UI.pageHead('组合攻击策略')+'<div class="empty">策略不存在或已删除</div>';
  const readonly=st.readOnly?'readonly':'',basic='<section class="mc-section"><div class="mc-section-head"><h2>基本信息</h2>'+(st.readOnly?UI.badge('已发布'):'')+'</div><div class="mc-basic-fields"><label class="field"><span>策略名称 <span class="req">*</span></span><input id="se-name" maxlength="100" value="'+UI.esc(st.name)+'" placeholder="请输入策略名称" '+readonly+' oninput="App.seField(\'name\',this.value)"></label><label class="field"><span>策略描述</span><input id="se-desc" value="'+UI.esc(st.desc)+'" placeholder="选填" '+readonly+' oninput="App.seField(\'desc\',this.value)"></label></div></section>';
  const composer=renderModelComposer('strategy-editor',{value:st.composition,readOnly:st.readOnly,onChange:(value,meta={})=>{st.composition=value;if(!meta.presentationOnly)dirty();if(meta.render!==false)render();},onConfigureModels:()=>configureMoreModels(render,'返回策略配置')});
  const footer=st.readOnly?UI.btn('返回列表',{onclick:"App.go('strategy','attack')"}):UI.btn('取消',{onclick:'App.seCancel()'})+UI.btn('保存草稿',{onclick:'App.seDraft()'})+UI.btn('发布策略',{kind:'primary',onclick:'App.sePublish()'});
  return UI.pageHead(st.readOnly?'组合攻击策略详情':st.id?'编辑组合攻击策略':'新建组合攻击策略',{back:UI.backBtn().replace('App.back()','App.seCancel()')})+'<div class="strategy-composition-page">'+(st.error?'<p class="mc-error" role="alert">'+UI.esc(st.error)+'</p>':'')+basic+composer+'<footer class="mc-page-footer"><span>'+(!st.readOnly&&st.dirty?'有未保存的更改':'')+'</span><div>'+footer+'</div></footer></div>';
}
function toRecord(status){return {id:st.id,name:st.name.trim(),desc:st.desc.trim(),status,authoringMode:'custom',...serializeModelComposition(st.composition)};}
function basicError(record){if(!String(record.name||'').trim())return '请输入策略名称';if(store.strategies.some(row=>row.id!==record.id&&row.name===String(record.name).trim()))return '策略名称重复，请修改';return '';}
/** Validate a saved draft without replacing or mutating the active editor. */
export function modelStrategyPublishError(record){
  try{const basic=basicError(record);if(basic)return basic;return modelCompositionError(hydrateModelComposition(record));}catch(error){return error.message;}
}
export function publishSavedModelStrategy(id){
  const record=store.strategies.find(row=>row.id===id);if(!record||record.status!=='draft')throw Error('仅草稿策略可发布');
  const error=modelStrategyPublishError(record);if(error)throw Error(error);return store.saveStrategy({...structuredClone(record),...serializeModelComposition(hydrateModelComposition(record)),status:'published'});
}
function saveDraft(){const record=toRecord('draft'),error=basicError(record);if(error)throw Error(error);const id=store.saveStrategy(record);st.id=id;st.routeKey=id;st.dirty=false;return id;}
function done(message,id=st.id){st.dirty=false;st.routeKey=null;pendingNavigation=null;UI.closeModal();UI.closeDrawer();UI.toast(message);UI.resetPage('strategies');router.nav('strategy','attack',id);}
export function openEditor(id=null){
  if(id&&!store.strategies.some(row=>row.id===id&&row.status==='draft'))return UI.toast('仅草稿策略可编辑');
  if(router.state().sub==='strategy-create'&&(router.state().param||null)===id&&st.dirty)return render();
  return router.nav('strategy','strategy-create',id,{onCommit:()=>{reset(id);UI.closeModal();UI.closeDrawer();}});
}
router.beforeNavigate(transition=>{
  if(transition.from.sub!=='strategy-create'||!st.dirty||st.readOnly||transition.options.purpose==='configure-models')return;
  pendingNavigation=transition;UI.modal('保存策略更改','<p>当前策略还有未保存的更改。</p>',UI.btn('继续编辑',{onclick:'App.seBack()'})+UI.btn('放弃更改',{onclick:'App.seLeave(false)'})+UI.btn('保存并离开',{kind:'primary',onclick:'App.seLeave(true)'}));return false;
});
export const actions={
  newStrategy(){openEditor();},editStrategy(id){openEditor(id);},
  seField(key,value){if(edit()&&['name','desc'].includes(key)){st[key]=value;dirty();}},
  sePublish(confirmed=false){if(!edit())return;try{const record=toRecord('published'),error=modelStrategyPublishError(record);if(error)return fail(error);if(!confirmed)return UI.confirmPublication({kind:'攻击策略',name:record.name,onConfirm:()=>actions.sePublish(true)});const id=store.saveStrategy(record);done('策略已发布',id);}catch(error){fail(error.message);}},
  seDraft(){if(!edit())return;try{saveDraft();done('已保存为草稿');}catch(error){fail(error.message);}},
  seCancel(){router.nav('strategy','attack');},seBack(){pendingNavigation=null;UI.closeModal();},
  seLeave(save){try{if(save)saveDraft();else st.dirty=false;st.routeKey=null;UI.closeModal();const pending=pendingNavigation;pendingNavigation=null;pending?.proceed();}catch(error){UI.toast(error.message);}},
  seConfigureModels(){configureMoreModels(render,'返回策略配置');},
  // Legacy action callers can still update the same composition without a second UI.
  seMethod(name,on){if(!edit())return;const def=methodOf(decodeURIComponent(name));if(!def)return fail('该攻击方法不可用');st.composition.methods=st.composition.methods.filter(method=>method.name!==def.name);if(on)st.composition.methods.push(createMethodInstance(def.id));dirty();render();},
  seParam(index,label,value){if(!edit()||!(label in (st.composition.methods[index]?.params||{})))return;st.composition.methods[index].params[label]=value;dirty();render();},
  seAux(index,key,value){if(!edit()||!st.composition.methods[index]||!['generator','process'].includes(key))return;st.composition.methods[index][key]=value;dirty();render();},
  seBank(id,on){if(!edit())return;const bank=store.getBank(id);if(!bank)return fail('题库不可用');delete st.composition.questionSelection;st.composition.banks=st.composition.banks.filter(ref=>ref.bankId!==id);if(on)st.composition.banks.push({bankId:id,count:null});dirty();render();},
  seBankAll(index,all){if(!edit()||!st.composition.banks[index])return;delete st.composition.questionSelection;st.composition.banks[index].count=all?null:Math.min(20,store.getBank(st.composition.banks[index].bankId)?.items.length||1);delete st.composition.banks[index].itemIds;dirty();render();},
  seBankN(index,value){if(!edit()||!st.composition.banks[index])return;delete st.composition.questionSelection;st.composition.banks[index].count=Number(value);delete st.composition.banks[index].itemIds;dirty();render();},
};
