/* Shared single-page method and question composition for strategies and tasks. */
import * as UI from './ui.js';
import * as store from '../domain/store.js';
import { listLibraryQuestions } from '../pages/question-library.js';
import { listResourceGroups } from '../domain/resource-groups.js';
import * as Tags from '../domain/resource-tags.js';
import { createMethodInstance, methodParameterSchema, getMethodDefaults } from '../domain/method-defaults.js';
import { openResourcePicker, listPickerResources } from './resource-picker.js';
import { renderTagFilter, normalizeTagSelection, matchesTagSelection } from './tag-filter.js';
import { renderSelectionSummary } from './selection-summary.js';
import { methodModelRoles, methodModelSelection } from '../domain/method-model-roles.js';

const e=UI.esc,copy=value=>structuredClone(value),contexts=new Map();
const call=(name,...args)=>e('App.'+name+'('+args.map(value=>JSON.stringify(value)).join(',')+')');
const methodOf=name=>store.methods.find(method=>method.name.toLowerCase()===String(name).toLowerCase());
const parameterLabel=label=>String(label).replace('预置变体','系统变体');
const methodDescription=method=>(method?.desc||'').replace('由裁判评分','获得评分').replaceAll('裁判反馈','评分反馈').replace('上游预置变体','系统变体');
const catalogMethods=()=>store.methods.filter(method=>!method.authoringId);
const canChoose=method=>method&&method.family!=='多模态'&&method.available!==false;
const availableModels=()=>listPickerResources('model').filter(model=>model.status==='connected');
const modelOf=id=>listPickerResources('model').find(model=>model.id===id||model.assetId===id);
let picker=null,methodEditor=null;
function style(){if(typeof document==='undefined'||document.getElementById('model-composer-style'))return;const link=document.createElement('link');link.id='model-composer-style';link.rel='stylesheet';link.href=new URL('../styles/model-composer.css',import.meta.url).href;document.head.append(link);}

export function listComposerQuestions(){
  return listLibraryQuestions().filter(row=>row.status==='published').flatMap(row=>{
    const version=[...row.bank.versions].reverse().find(version=>version.items?.some(item=>item.prompt===row.title));
    const bankId=row.bank.readOnly?row.bankId:version?.catalogId,bank=store.getBank(bankId);
    const item=bank?.items.find(item=>item.prompt===row.title);
    return item?[{...row,libraryBankId:row.bankId,bankId,itemId:item.id,bankName:bank.name}]:[];
  });
}
function sourceSelections(value,questions){
  if(Array.isArray(value.questionSelection?.sources))return copy(value.questionSelection.sources);
  const ids=[];
  for(const ref of value.banks||[]){
    const rows=questions.filter(row=>row.bankId===ref.bankId),selected=Array.isArray(ref.itemIds)?rows.filter(row=>ref.itemIds.includes(row.itemId)):ref.count==null||ref.all?rows:rows.slice(0,ref.count);
    ids.push(...selected.map(row=>row.id));
    if(Array.isArray(ref.itemIds))for(const id of ref.itemIds)if(!rows.some(row=>row.itemId===id))ids.push('unavailable-item:'+ref.bankId+':'+id);
    if(!selected.length)ids.push('unavailable-bank:'+ref.bankId);
  }
  return ids.length?[{id:'manual',type:'manual',name:'单独选择题目',questionIds:[...new Set(ids)]}]:[];
}
function compileSources(sources,questions){
  const selected=new Set(sources.flatMap(source=>source.questionIds||[])),banks=new Map();
  for(const row of questions)if(selected.has(row.id)){
    if(!banks.has(row.bankId))banks.set(row.bankId,{bankId:row.bankId,count:0,itemIds:[]});
    const ref=banks.get(row.bankId);if(!ref.itemIds.includes(row.itemId)){ref.itemIds.push(row.itemId);ref.count++;}
  }
  return [...banks.values()];
}
export function hydrateModelComposition(record={}){
  const methods=(record.methods||[]).map(method=>{
    const def=methodOf(method.name),input=Array.isArray(method.params)?Object.fromEntries(method.params):method.params||{};
    const roles=methodModelRoles(def),roleLabels=new Set(roles.map(role=>role.role));
    const params={...Object.fromEntries(Object.entries(input).filter(([label])=>label!=='攻击生成模型'&&!/过程裁判/.test(label)&&!roleLabels.has(label))),...Object.fromEntries((def?.params||[]).map(param=>[param.label,input[param.label]??param.value]))};
    const aux=key=>method[key]||method.aux?.[key]||listPickerResources('model').find(model=>model.name===input[key==='generator'?'攻击生成模型':'过程裁判'])?.id||'';
    const auxiliaryModels=roles.filter(role=>role.key!=='generator').map(role=>{const saved=methodModelSelection(method,role),model=modelOf(saved.id)||listPickerResources('model').find(model=>model.name===saved.name);return {role:role.role,id:model?.id||saved.id,name:model?.name||saved.name};});
    return {name:method.name,params,generator:aux('generator')||methodModelSelection(method,{key:'generator',role:'攻击生成模型'}).id,process:aux('process'),...(auxiliaryModels.length?{auxiliaryModels}:{})};
  });
  return {methods,banks:copy(record.banks||[]),...(record.questionSelection?{questionSelection:copy(record.questionSelection)}:{})};
}
export function serializeModelComposition(value){
  const questions=listComposerQuestions(),sources=sourceSelections(value,questions);
  const ids=new Set(questions.map(row=>row.id));
  if(sources.some(source=>(source.questionIds||[]).some(id=>!ids.has(id))))throw Error('部分题目已删除或不再可用，请重新选择');
  return {methods:(value.methods||[]).map((method,index)=>({name:method.name,order:index+1,params:[...Object.entries(method.params||{}),...(method.generator?[['攻击生成模型',modelOf(method.generator)?.name||method.generator]]:[]),...(method.process?[['过程裁判',modelOf(method.process)?.name||method.process]]:[])],aux:{generator:method.generator||'',process:method.process||''},...(method.auxiliaryModels?.length?{auxiliaryModels:method.auxiliaryModels.map(row=>({...row,name:modelOf(row.id)?.name||row.name||''}))}:{})})),banks:compileSources(sources,questions),questionSelection:{sources}};
}
export function modelCompositionError(value,{allowIncomplete=false}={}){
  if(!allowIncomplete&&!value.methods?.length)return '请至少选择一种攻击方法';
  for(const method of value.methods||[]){
    const def=methodOf(method.name);if(!def||def.available===false||def.family==='多模态')return '所选攻击方法不可用，请重新选择';
    for(const param of methodParameterSchema(def.id)){
      const v=method.params?.[param.label];
      if(typeof v!==param.type||param.type==='number'&&(!Number.isFinite(v)||param.integer&&!Number.isSafeInteger(v)||v<param.min||param.max!==undefined&&v>param.max)||param.type==='string'&&!v.trim()||param.options&&!param.options.includes(v))return def.name+'：'+param.label+'的配置无效';
    }
    if(def.id==='TreeAttack'&&method.params['保留分支数量']>method.params['分支数量'])return '保留分支数量不能超过分支数量';
    if(!allowIncomplete)for(const role of methodModelRoles(def)){const selected=methodModelSelection(method,role);if(!availableModels().some(model=>selected.id?model.id===selected.id||model.assetId===selected.id:model.name===selected.name))return '请为 '+def.name+' 选择可用的'+role.role;}
  }
  if(!value.questionSelection)for(const ref of value.banks||[]){const bank=store.getBank(ref.bankId);if(bank&&ref.count!=null&&!Array.isArray(ref.itemIds)&&(!Number.isSafeInteger(ref.count)||ref.count<1||ref.count>bank.items.length))return '题库选题数量无效';}
  const questions=listComposerQuestions(),ids=new Set(questions.map(row=>row.id)),sources=sourceSelections(value,questions),selected=[...new Set(sources.flatMap(source=>source.questionIds||[]))];
  if(!allowIncomplete&&!selected.length)return '请至少选择一道已发布题目';
  if(selected.some(id=>!ids.has(id)))return '部分题目已删除或不再可用，请重新选择';
  return '';
}
function changed(context,{render=true}={}){
  const questions=listComposerQuestions();context.value.questionSelection={sources:sourceSelections(context.value,questions)};context.value.banks=compileSources(context.value.questionSelection.sources,questions);
  context.onChange?.(copy(context.value),{render});
}
function section(title,body,tools=''){return '<section class="mc-section"><div class="mc-section-head"><h2>'+title+'</h2>'+tools+'</div>'+body+'</section>';}
const parameterValue=value=>typeof value==='boolean'?(value?'开启':'关闭'):typeof value==='object'?JSON.stringify(value):String(value??'—');
const ellipsis=(text,cls='mc-cell-ellipsis')=>'<span class="'+cls+'" title="'+e(text)+'">'+e(text||'—')+'</span>';
function methodParameterText(method){
  const entries=Object.entries(method.params||{}).filter(([label])=>!['攻击生成模型','过程裁判'].includes(label));
  return entries.length?entries.map(([label,value])=>parameterLabel(label)+'：'+parameterValue(value)).join('；'):'无额外参数';
}
function methodColumns(context,{selecting=false}={}){
  return [
    ...(selecting?[{title:'<input type="checkbox" aria-label="全选当前页方法" '+(picker.visible.some(canChoose)&&picker.visible.filter(canChoose).every(method=>picker.selected.has(method.name))?'checked':'')+' onchange="App.mcMethodPageSelect(this.checked)">',raw:true,width:'42px',render:method=>'<input type="checkbox" aria-label="选择 '+e(method.name)+'" '+(picker.selected.has(method.name)?'checked ':'')+(!canChoose(method)?'disabled ':'')+'onchange="'+e('App.mcMethodSelect('+JSON.stringify(method.name)+',this.checked)')+'">'}]:[]),
    {title:'名称',width:'145px',render:row=>ellipsis(row.name+(selecting&&!canChoose(row)?'（需适配）':''))},
    {title:'说明',width:'150px',render:row=>{const description=methodDescription(methodOf(row.name)||row),chars=Array.from(description);return '<span class="mc-cell-ellipsis" title="'+e(description)+'">'+e(chars.length>8?chars.slice(0,8).join('')+'...':description)+'</span>';}},
    {title:'来源',width:'64px',render:row=>(methodOf(row.name)||row).authoringId?'自建':'系统'},
    {title:'类别',width:'110px',render:row=>ellipsis((methodOf(row.name)||row).family)},
    {title:selecting?'默认参数':'参数配置',width:'230px',render:row=>ellipsis(methodParameterText(selecting?{params:getMethodDefaults(row.id).params}:row))},
    {title:'依赖模型',width:selecting?'165px':'230px',render:row=>{
      const def=methodOf(row.name)||row,roles=methodModelRoles(def);
      return ellipsis(roles.length?roles.map(role=>{if(selecting)return role.role;const selected=methodModelSelection(row,role);return role.role+'：'+(modelOf(selected.id)?.name||selected.name||'未选择');}).join('；'):'无');
    }},
    ...(!selecting&&!context.readOnly?[{title:'操作',width:'260px',render:row=>{const def=methodOf(row.name)||row,name=row.name;return '<div class="row-actions mc-method-actions">'+UI.linkBtn('调整参数',{disabled:!methodParameterSchema(def.id).length,onclick:call('mcEditMethod',context.key,name,'params',false)})+UI.linkBtn('配置模型',{disabled:!methodModelRoles(def).length,onclick:call('mcEditMethod',context.key,name,'generator',false)})+UI.linkBtn('移除',{onclick:call('mcRemoveMethod',context.key,name)})+'</div>';}}]:[]),
  ];
}
function methodsPanel(context){
  const methods=context.value.methods||[];if(!methods.length)return '<div class="mc-empty">尚未选择攻击方法</div>';
  return '<div class="mc-selected-methods">'+UI.table(methodColumns(context),methods)+'</div>';
}
function methodEditorField(param,value){
  const id='mc-edit-'+param.key,change=e('App.mcMethodEditParam('+JSON.stringify(param.label)+',this.value)');
  const control=param.options?'<select id="'+e(id)+'" onchange="'+change+'">'+param.options.map(option=>'<option value="'+e(option)+'" '+(value===option?'selected':'')+'>'+e(option)+'</option>').join('')+'</select>':param.type==='boolean'?'<select id="'+e(id)+'" onchange="'+change+'"><option value="true" '+(value?'selected':'')+'>开启</option><option value="false" '+(!value?'selected':'')+'>关闭</option></select>':'<input id="'+e(id)+'" type="'+(param.type==='number'?'number':'text')+'" value="'+e(value)+'" '+(param.min!==undefined?'min="'+param.min+'" ':'')+(param.max!==undefined?'max="'+param.max+'" ':'')+(param.type==='number'?'step="'+(param.integer?'1':'any')+'" ':'')+'oninput="'+change+'">';
  return '<label class="field"><span>'+e(parameterLabel(param.label))+'</span>'+control+'</label>';
}
function showMethodEditor(){
  const current=methodEditor;if(!current)return;const def=methodOf(current.name),value=current.value;
  const body=current.mode==='generator'?methodModelRoles(def).map(role=>{const selected=methodModelSelection(value,role);return '<label class="field"><span>'+e(role.role)+'</span><select id="mc-edit-'+e(role.key)+'" data-mc-model-role="'+e(role.key)+'" onchange="'+e('App.mcMethodEditModel('+JSON.stringify(role.key)+',this.value)')+'"><option value="">请选择'+e(role.role)+'</option>'+availableModels().map(model=>'<option value="'+e(model.id)+'" '+([model.id,model.assetId].includes(selected.id)?'selected':'')+'>'+e(model.name)+'</option>').join('')+'</select></label>';}).join('')+'<p class="mc-note">仅列出已连通的模型。</p>':methodParameterSchema(def.id).map(param=>methodEditorField(param,value.params[param.label])).join('');
  UI.drawer((current.mode==='generator'?'配置依赖模型':'调整参数')+' · '+current.name,'<div class="mc-method-config"><p class="mc-note">仅用于当前'+(current.inPicker?'组合':'策略或任务')+'，方法库默认值保持不变。</p>'+body+'<p id="mc-method-edit-error" class="mc-error" role="alert">'+e(current.error||'')+'</p></div>',UI.btn('取消',{onclick:'App.mcMethodEditCancel()'})+UI.btn('确认配置',{kind:'primary',onclick:'App.mcMethodEditSave()'}));
  document.querySelector('#drawer .drawer')?.classList.add('mc-method-config-drawer');
  document.querySelector('#drawer .modal-head .icon-btn')?.setAttribute('onclick','App.mcMethodEditCancel()');
}
export function renderModelComposer(key,{value={},readOnly=false,onChange,onConfigureModels}={}){
  style();const previous=contexts.get(key)||{},context={...previous,key,value:copy(value),readOnly,onChange,onConfigureModels};contexts.set(key,context);
  const questions=listComposerQuestions(),sources=sourceSelections(context.value,questions),selected=new Set(sources.flatMap(source=>source.questionIds||[])),known=new Set(questions.map(row=>row.id));
  const duplicate=sources.reduce((sum,source)=>sum+(source.questionIds?.length||0),0)-selected.size;
  const sourceRows=sources.length?UI.table([
    {title:'题目来源',render:source=>'<strong>'+e(source.name)+'</strong><small>'+e(source.type==='group'?'题目分组':'单独选择')+'</small>'},
    {title:'数量',width:'85px',render:source=>source.questionIds.length+' 题'},
    {title:readOnly?'查看':'操作',width:readOnly?'80px':'150px',cls:'mc-source-actions',render:source=>UI.linkBtn(readOnly?'查看':'调整',{onclick:call('mcQuestions',key,source.id)})+(!readOnly?UI.linkBtn('移除',{onclick:call('mcRemoveSource',key,source.id)}):'')},
  ],sources):'';
  const summary='<div class="mc-count"><strong>'+selected.size+' 道题目</strong>'+(!readOnly?'<span>'+(!selected.size?'可组合选择不同分组与单独题目':duplicate?'已合并 '+duplicate+' 道重复选择':'已按题目去重')+'</span>':'')+'</div>';
  const questionBody=summary+(sourceRows?'<div class="mc-sources">'+sourceRows+'</div>':'<div class="mc-empty">尚未选择题目</div>')+([...selected].some(id=>!known.has(id))?'<p class="mc-error">'+(readOnly?'部分已选题目已不可用。':'部分已选题目不可用，请调整选择。')+'</p>':'');
  return ('<div class="model-composer" data-composer="'+e(key)+'">'+section('攻击方法',methodsPanel(context),!readOnly?UI.btn('添加方法',{onclick:call('mcMethods',key)}):'')+section('题目范围',questionBody,!readOnly?UI.btn('选择题目',{onclick:call('mcQuestions',key)}):'')+'</div>').replace(/<button\b(?![^>]*\btype\s*=)/g,'<button type="button"');
}
function showMethodPicker(){
  const context=contexts.get(picker.key),query=picker.query.toLowerCase();
  const rows=catalogMethods().filter(method=>(!query||[method.name,method.desc,method.family].join(' ').toLowerCase().includes(query))&&(!picker.family||method.family===picker.family));
  const page=Math.max(1,Math.min(picker.page,Math.ceil(rows.length/UI.PAGE_SIZE)||1)),slice=rows.slice((page-1)*UI.PAGE_SIZE,page*UI.PAGE_SIZE);picker.page=page;picker.visible=slice;
  const filters='<div class="mc-picker-filters"><input id="mc-method-search" type="search" aria-label="搜索攻击方法" placeholder="搜索名称或说明" value="'+e(picker.query)+'" oninput="App.mcPickerQuery(this.value)"><select aria-label="类别" onchange="App.mcMethodFamily(this.value)"><option value="">全部类别</option>'+[...new Set(catalogMethods().map(method=>method.family))].map(family=>'<option value="'+e(family)+'" '+(picker.family===family?'selected':'')+'>'+e(family)+'</option>').join('')+'</select></div>';
  const table=UI.table(methodColumns(context,{selecting:true}),slice,'暂无匹配方法');
  UI.modal('选择攻击方法','<div class="mc-picker mc-method-picker">'+filters+'<p class="mc-note">确认选择后，可在外层列表调整参数和配置依赖模型。</p>'+table+UI.pager({page,count:Math.ceil(rows.length/UI.PAGE_SIZE)||1,total:rows.length},'App.mcPickerPage({p})')+'</div>', '<span class="mc-picker-total">已选 '+picker.selected.size+' 种</span>'+UI.btn('取消',{onclick:'App.mcPickerClose()'})+UI.btn('确认选择',{kind:'primary',onclick:'App.mcConfirmMethods()'}),{wide:true});
  document.querySelector('#modal .modal')?.classList.add('mc-method-modal');
  document.querySelector('#modal .modal-head .icon-btn')?.setAttribute('onclick','App.mcPickerClose()');
  const header=document.querySelector('#modal input[aria-label="全选当前页方法"]');if(header)header.indeterminate=slice.some(method=>canChoose(method)&&picker.selected.has(method.name))&&!slice.filter(canChoose).every(method=>picker.selected.has(method.name));
}
function allGroups(questions){
  const system=new Map();for(const row of questions)if(row.source==='system'){const id='system-question-'+row.libraryBankId;if(!system.has(id))system.set(id,{id,name:row.bankName,source:'system',memberIds:[]});system.get(id).memberIds.push(row.id);}
  return [...system.values(),...listResourceGroups('question')];
}
function pendingSources(staged=false){
  const manual=staged?picker.stagedManual:picker.manual,groups=staged?picker.stagedGroups:picker.groups;
  const sources=[];if(manual.size)sources.push({id:'manual',type:'manual',name:'单独选择题目',questionIds:[...manual]});
  for(const [id,value]of groups)if(value.ids.size)sources.push({id:'group:'+id,type:'group',groupId:id,name:value.name,questionIds:[...value.ids]});return sources;
}
const pendingIds=()=>new Set(pendingSources().flatMap(source=>source.questionIds));
const stagedIds=()=>new Set(pendingSources(true).flatMap(source=>source.questionIds));
function setQuestionSelection(id,on){
  if(!picker.questions.some(row=>row.id===id))return;
  if(picker.groupId){
    const group=allGroups(picker.questions).find(group=>group.id===picker.groupId);if(!group?.memberIds.includes(id))return;
    if(!picker.stagedGroups.has(group.id))picker.stagedGroups.set(group.id,{name:group.name,ids:new Set()});
    const ids=picker.stagedGroups.get(group.id).ids;on?ids.add(id):ids.delete(id);
  }else if(on)picker.stagedManual.add(id);else{picker.stagedManual.delete(id);for(const group of picker.stagedGroups.values())group.ids.delete(id);}
  picker.error='';
}
function setGroupSelection(id,on){
  const group=allGroups(picker.questions).find(group=>group.id===id);if(!group)return;
  if(on)picker.stagedGroups.set(id,{name:group.name,ids:new Set(group.memberIds.filter(id=>picker.questions.some(row=>row.id===id)))});else picker.stagedGroups.delete(id);
  picker.error='';
}
function showQuestionPicker(){
  const context=contexts.get(picker.key),readOnly=context.readOnly,questions=picker.questions,groups=allGroups(questions),query=picker.query.toLowerCase(),group=groups.find(group=>group.id===picker.groupId);
  const tabs='<div class="mc-picker-tabs" role="tablist">'+[['all','全部题目'],['groups','题目分组']].map(([id,label])=>'<button role="tab" class="'+(picker.tab===id?'active':'')+'" aria-selected="'+(picker.tab===id)+'" onclick="'+call('mcQuestionTab',id)+'">'+label+'</button>').join('')+'</div>';
  const ids=pendingIds(),staged=stagedIds(),current=readOnly?ids:picker.groupId?picker.stagedGroups.get(picker.groupId)?.ids||new Set():staged;
  picker.tagSelection=normalizeTagSelection(picker.tagSelection||{});
  const groupsView=picker.tab==='groups'&&!picker.groupId;
  const filtered=groupsView?groups.filter(group=>(!readOnly||picker.groups.get(group.id)?.ids.size)&&(!query||group.name.toLowerCase().includes(query))):questions.filter(row=>(!readOnly||ids.has(row.id))&&(!picker.groupId||(readOnly?picker.groups.get(picker.groupId)?.ids.has(row.id):group?.memberIds.includes(row.id)))&&(!query||[row.title,row.questionId,...Object.values(row.tagNames).flat()].join(' ').toLowerCase().includes(query))&&(readOnly||(!picker.source||row.source===picker.source)&&matchesTagSelection(row.tagIds,picker.tagSelection)));
  const rows=filtered.filter(row=>!picker.onlySelected||(groupsView?(picker.groups.get(row.id)?.ids.size||0)>0:ids.has(row.id)));
  const page=Math.max(1,Math.min(picker.page,Math.ceil(rows.length/UI.PAGE_SIZE)||1)),slice=rows.slice((page-1)*UI.PAGE_SIZE,page*UI.PAGE_SIZE);picker.page=page;picker.visible=slice;picker.filtered=filtered;
  const breadcrumbs=picker.groupId?'<div class="mc-picker-back">'+UI.linkBtn('返回分组',{onclick:"App.mcQuestionGroup('')"})+'<strong>'+e(group?.name||'已删除分组')+'</strong></div>':'';
  const tagFilter=!readOnly?renderTagFilter('mc-question-tags',{getSelection:()=>picker?.tagSelection||{},onChange:selection=>{if(picker?.type!=='questions')return;picker.tagSelection=selection;picker.page=1;showQuestionPicker();}}):'';
  const filters='<div class="mc-picker-filters mc-question-filters"><input id="mc-question-search" type="search" aria-label="搜索题目或分组" placeholder="'+(groupsView?'搜索分组名称':'搜索题目、编号或标签')+'" value="'+e(picker.query)+'" oninput="App.mcPickerQuery(this.value)">'+(!readOnly&&!groupsView?'<select aria-label="题目来源" onchange="App.mcQuestionSource(this.value)"><option value="">全部来源</option><option value="system" '+(picker.source==='system'?'selected':'')+'>系统</option><option value="custom" '+(picker.source==='custom'?'selected':'')+'>自建</option></select>'+tagFilter:'')+'</div>';
  const filteredIds=new Set(groupsView?filtered.flatMap(row=>row.memberIds.filter(id=>questions.some(question=>question.id===id))):filtered.map(row=>row.id));
  const visibleSelected=[...filteredIds].filter(id=>ids.has(id)).length;
  const summary=readOnly?'':renderSelectionSummary({count:ids.size,visibleCount:visibleSelected,stagedCount:staged.size,onAdd:'App.mcQuestionAddStaged()',onClearStaged:'App.mcQuestionClearStaged()',onlySelected:!!picker.onlySelected,onOnlySelected:'App.mcQuestionOnlySelected(this.checked)',onClear:'App.mcQuestionClear()',clearLabel:'清空已选',onSelectFiltered:'App.mcQuestionSelectFiltered()',filteredCount:filteredIds.size,notice:picker.notice||'勾选后点击“加入已选”，可分批加入'});
  let columns=groupsView?[
    {title:'选择',width:'50px',render:group=>{const available=group.memberIds.filter(id=>questions.some(row=>row.id===id)),chosen=(readOnly?picker.groups:picker.stagedGroups).get(group.id)?.ids||new Set();return '<input type="checkbox" data-mc-group="'+e(group.id)+'" aria-label="选择分组 '+e(group.name)+'" '+(available.length&&available.every(id=>chosen.has(id))?'checked':'')+' '+(readOnly||!available.length?'disabled':'')+' onchange="'+e('App.mcGroupSelect('+JSON.stringify(group.id)+',this.checked)')+'">';}},
    {title:'分组名称',render:group=>UI.linkBtn(group.name,{onclick:call('mcQuestionGroup',group.id)})},
    {title:readOnly?'题目数量':'已加入 / 总题目',width:'150px',render:group=>readOnly?(picker.groups.get(group.id)?.ids.size||0):(picker.groups.get(group.id)?.ids.size||0)+' / '+group.memberIds.filter(id=>questions.some(row=>row.id===id)).length},
    {title:'本次待加入',width:'100px',render:group=>picker.stagedGroups.get(group.id)?.ids.size||0},
    {title:'来源',width:'85px',render:group=>group.source==='system'?'系统':'自建'},
    {title:'操作',width:'180px',render:group=>'<div class="row-actions">'+UI.linkBtn('选择部分',{onclick:call('mcQuestionGroup',group.id)})+UI.linkBtn('移除分组',{disabled:readOnly||!picker.groups.get(group.id)?.ids.size,onclick:call('mcQuestionRemoveGroup',group.id)})+'</div>'},
  ]:[
    {title:readOnly?'选择':'<input type="checkbox" aria-label="全选当前页题目" '+(slice.length&&slice.every(row=>current.has(row.id))?'checked':'')+' onchange="App.mcQuestionPageSelect(this.checked)">',raw:!readOnly,width:'42px',render:row=>'<input type="checkbox" aria-label="选择题目 '+e(row.questionId)+'" '+(current.has(row.id)?'checked':'')+' '+(readOnly?'disabled':'')+' onchange="'+e('App.mcQuestionSelect('+JSON.stringify(row.id)+',this.checked)')+'">'},
    {title:'题目',width:'250px',render:row=>'<div class="mc-question-title" title="'+e(row.title)+'">'+e(row.title)+'</div>'},
    {title:'编号',width:'110px',render:row=>e(row.questionId)},
    {title:'业务类型',width:'100px',render:row=>UI.tagList(row.tagNames.business)},
    {title:'风险场景',width:'145px',render:row=>UI.tagList(row.tagNames.risk)},
    {title:'其他标签',width:'155px',render:row=>{const text=Tags.listTagDimensions().filter(d=>!d.system&&(row.tagNames[d.id]||[]).length).map(d=>d.name+'：'+row.tagNames[d.id].join('、')).join('；');return '<span class="mc-other-tags" title="'+e(text)+'">'+e(text||'—')+'</span>';}},
    {title:'来源',width:'65px',render:row=>row.source==='system'?'系统':'自建'},
    {title:'入选状态',width:'110px',render:row=>ids.has(row.id)?staged.has(row.id)?'已加入 · 本次暂选':'已加入':staged.has(row.id)?'待加入':'—'},
    {title:'操作',width:'100px',render:row=>UI.linkBtn('移除已选',{disabled:readOnly||!ids.has(row.id),onclick:call('mcQuestionRemove',row.id)})},
  ];
  if(readOnly)columns=columns.filter(column=>!['选择','本次待加入','入选状态','操作'].includes(column.title));
  const missing=[...ids].filter(id=>!questions.some(row=>row.id===id));
  const unavailable=missing.length?'<p class="mc-error">'+missing.length+' 道已选题目不可用。'+(!readOnly?UI.linkBtn('移除不可用题目',{onclick:'App.mcRemoveUnavailable()'}):'')+'</p>':'';
  UI.modal(readOnly?'已选题目':'选择题目','<div class="mc-picker mc-question-picker">'+tabs+breadcrumbs+summary+filters+unavailable+UI.table(columns,slice,'暂无匹配内容')+UI.pager({page,count:Math.ceil(rows.length/UI.PAGE_SIZE)||1,total:rows.length},'App.mcPickerPage({p})')+'<p class="mc-error" role="alert">'+e(picker.error||'')+'</p></div>','<span class="mc-picker-total">'+(readOnly?'共 ':'已选 ')+ids.size+' 道'+(readOnly?'':' · 自动去重')+'</span>'+UI.btn(readOnly?'关闭':'取消',{onclick:'App.mcPickerClose()'})+(!readOnly?UI.btn('确认选择',{kind:'primary',disabled:staged.size>0,onclick:'App.mcConfirmQuestions()'}):''),{wide:true});
  document.querySelector('#modal .modal')?.classList.add('mc-question-modal');
  document.querySelector('#modal .modal-head .icon-btn')?.setAttribute('onclick','App.mcPickerClose()');
  const header=document.querySelector('#modal input[aria-label="全选当前页题目"]');if(header)header.indeterminate=slice.some(row=>current.has(row.id))&&!slice.every(row=>current.has(row.id));
  document.querySelectorAll('#modal [data-mc-group]').forEach(node=>{const members=groups.find(group=>group.id===node.dataset.mcGroup)?.memberIds||[],chosen=(readOnly?picker.groups:picker.stagedGroups).get(node.dataset.mcGroup)?.ids||new Set();node.indeterminate=members.some(id=>chosen.has(id))&&!members.every(id=>chosen.has(id));});
}

export const actions={
  mcFocus(key,name){actions.mcEditMethod(key,name,'params',false);},
  mcParam(key,index,label,value){const context=contexts.get(key),method=context?.value.methods[index];if(!method||context.readOnly)return;const param=methodParameterSchema(methodOf(method.name).id).find(param=>param.label===label);if(!param)return;method.params[label]=param.type==='number'?Number(value):param.type==='boolean'?value==='true':value;changed(context,{render:false});},
  mcRemoveMethod(key,name){const context=contexts.get(key);if(!context||context.readOnly)return;context.value.methods=context.value.methods.filter(method=>method.name!==name);changed(context);},
  mcGenerator(key,index){const context=contexts.get(key),method=context?.value.methods[index];if(!method||context.readOnly)return;openResourcePicker({kind:'model',value:method.generator,title:'选择攻击生成模型',onSelect:resource=>{method.generator=resource.id;changed(context);}});},
  mcMethods(key){const context=contexts.get(key);if(!context||context.readOnly)return;picker={type:'methods',key,query:'',family:'',page:1,selected:new Set(context.value.methods.map(method=>method.name)),configs:new Map(context.value.methods.map(method=>[method.name,copy(method)]))};showMethodPicker();},
  mcMethodSelect(name,on){if(picker?.type!=='methods'||!canChoose(methodOf(name)))return;if(on){picker.selected.add(name);if(!picker.configs.has(name))picker.configs.set(name,createMethodInstance(methodOf(name).id));}else picker.selected.delete(name);showMethodPicker();},
  mcMethodPageSelect(on){if(picker?.type!=='methods')return;for(const method of picker.visible.filter(canChoose)){if(on){picker.selected.add(method.name);if(!picker.configs.has(method.name))picker.configs.set(method.name,createMethodInstance(method.id));}else picker.selected.delete(method.name);}showMethodPicker();},
  mcEditMethod(key,name,mode='params',inPicker=false){const context=contexts.get(key),def=methodOf(name),method=inPicker?picker?.type==='methods'&&picker.key===key&&picker.selected.has(name)&&picker.configs.get(name):context?.value.methods.find(method=>method.name===name);if(!context||context.readOnly||!def||!method||mode==='generator'&&!methodModelRoles(def).length||mode==='params'&&!methodParameterSchema(def.id).length)return;methodEditor={key,name,mode,inPicker,value:copy(method),error:''};showMethodEditor();},
  mcMethodEditParam(label,value){if(!methodEditor)return;const param=methodParameterSchema(methodOf(methodEditor.name).id).find(param=>param.label===label);if(!param)return;methodEditor.value.params[label]=param.type==='number'?Number(value):param.type==='boolean'?value==='true':value;},
  mcMethodEditGenerator(id){if(methodEditor)methodEditor.value.generator=id;},
  mcMethodEditModel(key,id){if(!methodEditor)return;const role=methodModelRoles(methodOf(methodEditor.name)).find(role=>role.key===key);if(!role)return;if(key==='generator')methodEditor.value.generator=id;else{methodEditor.value.auxiliaryModels=(methodEditor.value.auxiliaryModels||[]).filter(row=>row.role!==role.role);methodEditor.value.auxiliaryModels.push({role:role.role,id,name:modelOf(id)?.name||''});}},
  mcMethodEditCancel(){methodEditor=null;UI.closeDrawer();},
  mcMethodEditSave(){if(!methodEditor)return;const current=methodEditor,context=contexts.get(current.key);if(!context||context.readOnly)return;const error=modelCompositionError({methods:[current.value],banks:[]},{allowIncomplete:true});if(error){current.error=error;document.getElementById('mc-method-edit-error').textContent=error;return;}if(current.mode==='generator')for(const role of methodModelRoles(methodOf(current.name))){const selected=methodModelSelection(current.value,role);if(selected.id&&!availableModels().some(model=>model.id===selected.id||model.assetId===selected.id)){current.error='请选择已连通的'+role.role;document.getElementById('mc-method-edit-error').textContent=current.error;return;}}if(current.inPicker){if(picker?.type!=='methods'||picker.key!==current.key||!picker.selected.has(current.name))return;picker.configs.set(current.name,copy(current.value));methodEditor=null;UI.closeDrawer();showMethodPicker();}else{const index=context.value.methods.findIndex(method=>method.name===current.name);if(index<0)return;context.value.methods[index]=copy(current.value);methodEditor=null;UI.closeDrawer();changed(context);}},
  mcMethodFamily(value){if(picker?.type!=='methods')return;picker.family=value;picker.page=1;showMethodPicker();},
  mcConfirmMethods(){if(picker?.type!=='methods')return;const context=contexts.get(picker.key);if(context.readOnly)return;context.value.methods=[...picker.selected].map(name=>copy(picker.configs.get(name)||createMethodInstance(methodOf(name).id)));picker=null;UI.closeModal();changed(context);},
  mcQuestions(key,sourceId){const context=contexts.get(key);if(!context)return;const questions=listComposerQuestions(),sources=sourceSelections(context.value,questions),source=sources.find(source=>source.id===sourceId);picker={type:'questions',key,questions,query:'',source:'',page:1,tab:source?.type==='group'?'groups':'all',groupId:source?.groupId||'',manual:new Set(),groups:new Map(),stagedManual:new Set(),stagedGroups:new Map(),tagSelection:{},onlySelected:false,notice:'',error:''};for(const source of sources){if(source.type==='group')picker.groups.set(source.groupId,{name:source.name,ids:new Set(source.questionIds)});else for(const id of source.questionIds||[])picker.manual.add(id);}showQuestionPicker();},
  mcQuestionTab(tab){if(picker?.type!=='questions')return;picker.tab=tab;picker.groupId='';picker.query='';picker.page=1;showQuestionPicker();},
  mcQuestionGroup(id){if(picker?.type!=='questions')return;picker.tab='groups';picker.groupId=id;picker.query='';picker.page=1;showQuestionPicker();},
  mcQuestionSource(value){if(picker?.type!=='questions')return;picker.source=value;picker.page=1;showQuestionPicker();},
  mcQuestionTag(dimension,value){if(picker?.type!=='questions'||!Tags.listTagDimensions().some(d=>d.id===dimension))return;picker.tagSelection[dimension]=value?[value]:[];picker.page=1;showQuestionPicker();},
  mcQuestionOnlySelected(on){if(picker?.type!=='questions')return;picker.onlySelected=on;picker.page=1;showQuestionPicker();},
  mcQuestionClear(){if(picker?.type!=='questions'||contexts.get(picker.key).readOnly)return;picker.manual.clear();picker.groups.clear();picker.onlySelected=false;picker.notice='已清空已选题目，本次待加入保留';showQuestionPicker();},
  mcQuestionClearStaged(){if(picker?.type!=='questions'||contexts.get(picker.key).readOnly)return;picker.stagedManual.clear();picker.stagedGroups.clear();picker.error='';picker.notice='已清空本次待加入，已选题目保留';showQuestionPicker();},
  mcQuestionAddStaged(){if(picker?.type!=='questions'||contexts.get(picker.key).readOnly)return;const before=pendingIds(),sources=pendingSources(true),staged=stagedIds();if(!staged.size)return;const added=[...staged].filter(id=>!before.has(id)).length,duplicates=sources.reduce((sum,source)=>sum+source.questionIds.length,0)-added;for(const id of picker.stagedManual)picker.manual.add(id);for(const [id,value]of picker.stagedGroups){if(!picker.groups.has(id))picker.groups.set(id,{name:value.name,ids:new Set()});for(const member of value.ids)picker.groups.get(id).ids.add(member);}picker.stagedManual.clear();picker.stagedGroups.clear();picker.error='';picker.notice='本次新增 '+added+' 道，已去重 '+duplicates+' 道';showQuestionPicker();},
  mcQuestionRemove(id){if(picker?.type!=='questions'||contexts.get(picker.key).readOnly)return;picker.manual.delete(id);picker.stagedManual.delete(id);for(const group of [...picker.groups.values(),...picker.stagedGroups.values()])group.ids.delete(id);picker.notice='已移除该题目，其他选择保留';showQuestionPicker();},
  mcQuestionRemoveGroup(id){if(picker?.type!=='questions'||contexts.get(picker.key).readOnly)return;picker.groups.delete(id);picker.notice='已移除该分组，其他分组与单独选择保留';showQuestionPicker();},
  mcQuestionSelectFiltered(){if(picker?.type!=='questions'||contexts.get(picker.key).readOnly)return;const groupsView=picker.tab==='groups'&&!picker.groupId;for(const row of picker.filtered||[])groupsView?setGroupSelection(row.id,true):setQuestionSelection(row.id,true);picker.notice='已暂选当前筛选结果，点击“加入已选”后生效';showQuestionPicker();},
  mcRemoveUnavailable(){if(picker?.type!=='questions'||contexts.get(picker.key).readOnly)return;const ids=new Set(picker.questions.map(row=>row.id));picker.manual=new Set([...picker.manual].filter(id=>ids.has(id)));picker.stagedManual=new Set([...picker.stagedManual].filter(id=>ids.has(id)));for(const group of [...picker.groups.values(),...picker.stagedGroups.values()])group.ids=new Set([...group.ids].filter(id=>ids.has(id)));showQuestionPicker();},
  mcGroupSelect(id,on){if(picker?.type!=='questions'||contexts.get(picker.key).readOnly)return;setGroupSelection(id,on);picker.notice='勾选后点击“加入已选”，重复题目会自动去重';showQuestionPicker();},
  mcQuestionSelect(id,on){if(picker?.type!=='questions'||contexts.get(picker.key).readOnly)return;setQuestionSelection(id,on);picker.notice='勾选后点击“加入已选”，重复题目会自动去重';showQuestionPicker();},
  mcQuestionPageSelect(on){if(picker?.type!=='questions'||contexts.get(picker.key).readOnly)return;for(const row of picker.visible)setQuestionSelection(row.id,on);picker.notice=on?'已暂选当前页，跨页暂选保留':'已取消当前页暂选，其他页暂选保留';showQuestionPicker();},
  mcConfirmQuestions(){if(picker?.type!=='questions')return;const context=contexts.get(picker.key);if(context.readOnly)return;if(stagedIds().size){picker.error='还有暂选题目，请先点击“加入已选”或清空待加入后再确认。';showQuestionPicker();return;}context.value.questionSelection={sources:pendingSources()};picker=null;UI.closeModal();changed(context);},
  mcRemoveSource(key,id){const context=contexts.get(key);if(!context||context.readOnly)return;context.value.questionSelection={sources:sourceSelections(context.value,listComposerQuestions()).filter(source=>source.id!==id)};changed(context);},
  mcPickerQuery(query){if(!picker)return;picker.query=query;picker.page=1;picker.type==='methods'?showMethodPicker():showQuestionPicker();const input=document.getElementById(picker.type==='methods'?'mc-method-search':'mc-question-search');input?.focus();input?.setSelectionRange(query.length,query.length);},
  mcPickerPage(page){if(!picker)return;picker.page=page;picker.type==='methods'?showMethodPicker():showQuestionPicker();},
  mcPickerClose(){picker=null;methodEditor=null;UI.closeDrawer();UI.closeModal();},
};
