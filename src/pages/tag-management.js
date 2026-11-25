import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as Tags from '../domain/resource-tags.js';

const e=UI.esc,dimensions=()=>Tags.listTagDimensions().map(row=>row.id);
const call=(name,...args)=>e('App.'+name+'('+args.map(value=>JSON.stringify(value)).join(',')+')');
const value=id=>document.getElementById(id)?.value?.trim()||'';
const view={dimension:'all',query:'',selected:new Set()};
let labelEditor=null,pendingDelete=null,resourceEditor=null;
const refresh=()=>router.nav('platform','tags');
const pageKey=()=>`tag-management-${view.dimension}`;
const usageFingerprint=usage=>JSON.stringify({tags:usage.tags.map(row=>[row.id,row.name]).sort(),resources:usage.resources.map(row=>[row.kind,row.id]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))});
function tagRows(){
  const allDimensions=Tags.listTagDimensions();if(view.dimension!=='all'&&!allDimensions.some(row=>row.id===view.dimension))view.dimension='all';
  const all=allDimensions.flatMap(dimension=>Tags.listTags(dimension.id)),live=new Set(all.map(row=>row.id));for(const id of view.selected)if(!live.has(id))view.selected.delete(id);
  const query=view.query.trim().toLowerCase();
  const matched=all.filter(tag=>(view.dimension==='all'||tag.dimension===view.dimension)&&(!query||tag.name.toLowerCase().includes(query))).sort((left,right)=>(Date.parse(right.createdAt)||0)-(Date.parse(left.createdAt)||0));
  return {allDimensions,rows:matched};
}

export function tagManagementPage(){
  const {allDimensions,rows}=tagRows();
  const filters=UI.filters({search:{label:'搜索',id:'tm-query',value:view.query,placeholder:'搜索标签名称',oninput:'App.tmSearch(this.value)'},selects:[{label:'标签维度',id:'tm-dimension',value:view.dimension,options:[['all','全部维度'],...allDimensions.map(dimension=>[dimension.id,dimension.name])],onchange:'App.tmTab(this.value)'}],extra:'<div class="tm-manage-entry">'+UI.linkBtn('管理维度',{onclick:'App.tmManageDimensions()'})+'</div>',right:'<div class="row-actions">'+UI.btn('批量删除',{disabled:!view.selected.size,onclick:'App.tmDeleteSelected()'})+UI.btn('新增标签',{kind:'primary',ico:'plus',onclick:'App.tmEdit()'})+'</div>'});
  const pg=UI.paginate(pageKey(),rows);
  const checkedCount=pg.slice.filter(tag=>view.selected.has(tag.id)).length,allChecked=pg.slice.length>0&&checkedCount===pg.slice.length;
  const table=UI.table([
    {title:'<input id="tm-page-select" type="checkbox" aria-label="全选当前页标签" '+(allChecked?'checked ':'')+(!pg.slice.length?'disabled ':'')+'onchange="App.tmSelectPage(this.checked)">',raw:true,width:'42px',render:tag=>'<input type="checkbox" aria-label="选择标签 '+e(tag.name)+'" '+(view.selected.has(tag.id)?'checked ':'')+'onchange="'+e('App.tmSelect('+JSON.stringify(tag.id)+',this.checked)')+'">'},
    {title:'标签名称',render:tag=>e(tag.name)},
    {title:'维度',width:'130px',render:tag=>e(allDimensions.find(row=>row.id===tag.dimension)?.name)},
    {title:'来源',width:'90px',render:tag=>tag.preset?'系统':'自建'},
    {title:'关联题目',width:'100px',render:tag=>'<span class="num">'+tag.questionCount+'</span>'},
    {title:'关联环境',width:'100px',render:tag=>'<span class="num">'+tag.environmentCount+'</span>'},
    {title:'操作',width:'150px',render:tag=>'<div class="row-actions">'+UI.linkBtn('编辑',{onclick:call('tmEdit',tag.id)})+UI.linkBtn('删除',{danger:true,onclick:call('tmDelete',tag.id)})+'</div>'},
  ],pg.slice,'暂无匹配标签')+UI.pager(pg,`UI.setPage('${pageKey()}',{p})`);
  const ownerDocument=globalThis.document;queueMicrotask(()=>{const checkbox=ownerDocument?.getElementById('tm-page-select');if(checkbox)checkbox.indeterminate=checkedCount>0&&!allChecked;});
  const selection=view.selected.size?'<div class="tm-selected-count" role="status">已选 <b>'+view.selected.size+'</b> 个标签'+UI.linkBtn('清空选择',{onclick:'App.tmClearSelection()'})+'</div>':'';
  return UI.pageHead('标签管理')+'<section class="tm-library">'+filters+selection+UI.card('',table,'',true)+'</section>';
}
function editLabel(id){
  const tag=id?Tags.getTag(id):null;if(id&&!tag)return UI.toast('标签不存在或已删除');
  labelEditor={id:tag?.id||null,dimension:tag?.dimension||(view.dimension==='all'?'':view.dimension),dimensionName:'',name:tag?.name||'',error:''};renderLabelEditor();
  document.getElementById('tm-name')?.focus();
}
function renderLabelEditor(){
  const current=labelEditor;if(!current)return;const allDimensions=Tags.listTagDimensions();
  const dimensionField=current.id?'<div class="field"><label>所属维度</label><div class="tm-readonly">'+e(allDimensions.find(row=>row.id===current.dimension)?.name)+'</div></div>':'<div class="field"><label for="tm-editor-dimension">所属维度</label><select id="tm-editor-dimension" onchange="App.tmEditorDimension(this.value)"><option value="">请选择维度</option>'+allDimensions.map(row=>'<option value="'+e(row.id)+'" '+(row.id===current.dimension?'selected':'')+'>'+e(row.name)+'</option>').join('')+'<option value="new" '+(current.dimension==='new'?'selected':'')+'>+ 新增维度</option></select></div>';
  const newDimension=current.dimension==='new'?'<div class="field"><label for="tm-new-dimension">维度名称</label><input id="tm-new-dimension" maxlength="60" value="'+e(current.dimensionName)+'" placeholder="例如：应用领域" oninput="App.tmDimensionName(this.value)"></div>':'';
  const name=current.id?'<div class="field"><label for="tm-name">标签名称</label><input id="tm-name" maxlength="60" value="'+e(current.name)+'" placeholder="请输入标签名称" oninput="App.tmName(this.value)" onkeydown="App.tmEditorKey(event)"></div>':'<div class="field"><label for="tm-name">标签名称</label><textarea id="tm-name" rows="8" placeholder="每行一个标签，例如：&#10;金融服务&#10;客户支持" oninput="App.tmName(this.value)" onkeydown="App.tmEditorKey(event)">'+e(current.name)+'</textarea><p id="tm-batch-preview" class="tm-batch-preview" aria-live="polite"></p></div>';
  UI.drawer(current.id?'编辑标签':'新增标签','<form class="tm-form" onsubmit="event.preventDefault();App.tmSave()">'+dimensionField+newDimension+name+'<p id="tm-error" class="tm-error" role="alert">'+e(current.error)+'</p></form>',UI.btn('取消',{onclick:'App.tmCancelEdit()'})+UI.btn('保存标签',{kind:'primary',onclick:'App.tmSave()'}));
  updateBatchPreview();
}
const batchInput=()=>({text:labelEditor.name,...(labelEditor.dimension==='new'?{dimensionName:labelEditor.dimensionName}:{dimensionId:labelEditor.dimension})});
function updateBatchPreview(){
  const target=document.getElementById('tm-batch-preview');if(!target||!labelEditor||labelEditor.id)return;
  try{const preview=Tags.previewTagBatch(batchInput());target.textContent=!preview.inputCount?'每行一个标签，同一维度下的重复项会自动跳过。':`可新增 ${preview.newCount} 个标签；将跳过 ${preview.skippedCount} 个重复项（已存在 ${preview.existingCount} 个，本次重复 ${preview.duplicateCount} 个）${preview.invalidCount?`；${preview.invalidCount} 行名称超过 60 个字符，需修改后保存`:''}`;}
  catch(error){target.textContent=error.message;}
}
function renderDimensionManager(){
  labelEditor=null;
  const rows=Tags.listTagDimensions().map(row=>({...row,...Tags.getTagDimensionUsage(row.id)}));
  UI.drawer('管理维度','<div class="tm-dimension-manager"><p class="tm-help">业务类型和风险场景用于题目分类与报告分析，是必需维度。自定义维度可以整体删除。</p>'+UI.table([
    {title:'维度名称',render:row=>e(row.name)},
    {title:'标签数量',width:'90px',render:row=>row.tagCount},
    {title:'操作',width:'110px',render:row=>UI.linkBtn('删除维度',{danger:true,disabled:row.system,onclick:call('tmDeleteDimension',row.id),title:row.system?'必需维度不能删除':'删除维度及其标签'})},
  ],rows)+'</div>',UI.btn('关闭',{onclick:'App.tmCloseDimensions()'}));
}
function confirmRemoval(request,changed=false){
  try{
    const usage=request.type==='dimension'?Tags.getTagDimensionUsage(request.id):Tags.getTagsDeletionImpact(request.ids);
    if(request.type==='dimension'&&usage.dimension.system)return UI.toast('业务类型和风险场景是必需维度，不能删除');
    if(labelEditor?.id&&request.ids?.includes(labelEditor.id)&&document.querySelector('#drawer.open #tm-name'))return UI.toast('请先保存或取消当前编辑');
    pendingDelete={...request,fingerprint:usageFingerprint(usage)};
    const title=request.type==='dimension'?'删除维度':usage.tagCount>1?'批量删除标签':'删除标签';
    const intro=request.type==='dimension'?'确认删除“'+e(usage.dimension.name)+'”维度及其全部 <strong>'+usage.tagCount+'</strong> 个标签？':'确认删除 '+(usage.tagCount===1?'“'+e(usage.tags[0].name)+'”':'选中的 <strong>'+usage.tagCount+'</strong> 个标签')+'？';
    UI.modal(title,'<div class="tm-delete-impact"><p>'+intro+'</p><p>已绑定 <strong>'+usage.questionCount+'</strong> 道题目、<strong>'+usage.environmentCount+'</strong> 个环境（各类资源去重统计）。删除后将解除这些标签关联；资源正文、发布状态和分组成员保持不变。</p><p>运行中及已完成任务的历史分类按任务快照保留。</p>'+(changed?'<p class="tm-error">关联资源已变化，请按最新使用数量确认。</p>':'')+'</div>',UI.btn('取消',{onclick:'App.tmCancelDelete()'})+UI.btn(request.type==='dimension'?'删除维度':'删除标签',{kind:'danger',onclick:'App.tmConfirmDelete()'}));
  }catch(error){UI.toast(error.message);}
}

/** Resources are {id,title,seeds:{business:[names],risk:[names]}}. */
export function openResourceTagEditor(kind,resources,{onSave}={}){
  if(!['question','environment'].includes(kind)||!Array.isArray(resources)||!resources.length)return UI.toast('请先选择需要修改标签的资源');
  const unique=[...new Map(resources.map(resource=>[resource.id,resource])).values()];
  try{
    const selections=Tags.getResourcesTags(kind,unique.map(resource=>resource.id)),multiple=unique.length>1,ids=dimensions();
    resourceEditor={kind,resources:unique.map(resource=>({id:resource.id,title:resource.title||resource.name||resource.id})),onSave,multiple,
      selected:Object.fromEntries(ids.map(dimension=>[dimension,new Set(selections[0][dimension].filter(id=>selections.every(selection=>selection[dimension].includes(id))))])),
      apply:Object.fromEntries(ids.map(dimension=>[dimension,!multiple])),query:Object.fromEntries(ids.map(id=>[id,''])),activeDimension:ids[0],pickerOpen:false,pickerBackup:null,error:''};
    renderResourceEditor();
  }catch(error){UI.toast(error.message);}
}
function renderResourceEditor(){
  const current=resourceEditor;if(!current)return;
  const label=current.kind==='question'?'题目':'环境';
  const summary=current.multiple?'<p class="tm-help">已选 '+current.resources.length+' 个'+label+'。仅替换明确勾选的维度，其他维度保留每个资源原有标签。</p>':'<p class="tm-resource-title">'+e(current.resources[0].title)+'</p>';
  const allDimensions=Tags.listTagDimensions();
  for(const {id}of allDimensions)if(!current.selected[id]){current.selected[id]=new Set();current.apply[id]=!current.multiple;current.query[id]='';}
  if(!allDimensions.some(row=>row.id===current.activeDimension))current.activeDimension=allDimensions[0]?.id;
  const required=id=>['business','risk'].includes(id),catalog=new Map(allDimensions.map(row=>[row.id,Tags.listTags(row.id,current.kind)]));
  const chosenNames=dimension=>[...current.selected[dimension]].map(id=>catalog.get(dimension).find(tag=>tag.id===id)?.name||'已删除标签');
  const summaries=allDimensions.filter(row=>required(row.id)||current.selected[row.id].size||current.multiple&&current.apply[row.id]).map(row=>'<span><b>'+e(row.name)+'：</b>'+e(current.multiple&&!current.apply[row.id]?'保留原标签':chosenNames(row.id).join('、')||(required(row.id)?'未选择':'清空此维度'))+'</span>').join('');
  const trigger='<button id="tm-resource-trigger" class="tm-resource-trigger dropdown-trigger" type="button" aria-expanded="'+current.pickerOpen+'" aria-controls="tm-resource-picker" onclick="App.tmToggleResourcePicker()"><span>'+(current.pickerOpen?'收起标签选择':'选择标签')+'</span></button>';
  let picker='';
  if(current.pickerOpen){
    const active=allDimensions.find(row=>row.id===current.activeDimension),dimension=active.id,enabled=current.apply[dimension],query=current.query[dimension].trim().toLowerCase();
    const tabs=allDimensions.map(row=>'<button type="button" role="tab" id="tm-dimension-tab-'+e(row.id)+'" aria-selected="'+(row.id===dimension)+'" aria-controls="tm-resource-values" class="tm-resource-dimension '+(row.id===dimension?'active':'')+'" onclick="'+call('tmResourceDimension',row.id)+'"><span>'+e(row.name)+(required(row.id)?'<em aria-label="必选"> *</em>':'')+'</span><small>'+e(current.multiple&&!current.apply[row.id]?'保留':current.selected[row.id].size?'已选 '+current.selected[row.id].size:'未选择')+'</small></button>').join('');
    const tags=catalog.get(dimension).filter(tag=>!query||tag.name.toLowerCase().includes(query));
    const heading=current.multiple?'<label class="tm-apply"><input id="tm-apply-'+e(dimension)+'" type="checkbox" '+(enabled?'checked':'')+' onchange="'+e('App.tmApplyDimension('+JSON.stringify(dimension)+',this.checked)')+'">替换'+e(active.name)+'</label>':'<strong>'+e(active.name)+(required(dimension)?' <span class="tm-required">*</span>':'')+'</strong>';
    const options=tags.length?tags.map(tag=>'<label class="tm-option '+(!enabled?'disabled':'')+'"><input id="tm-resource-tag-'+e(tag.id)+'" type="checkbox" '+(current.selected[dimension].has(tag.id)?'checked ':'')+(!enabled?'disabled ':'')+'onchange="'+e('App.tmSelectTag('+JSON.stringify(dimension)+','+JSON.stringify(tag.id)+',this.checked)')+'"><span>'+e(tag.name)+'</span></label>').join(''):'<p class="tm-empty">暂无匹配标签，可在标签管理中添加。</p>';
    const note=!enabled?'未勾选替换，保留每个资源原有标签。':current.multiple?'将用本维度的所选标签替换全部 '+current.resources.length+' 个'+label+'的对应标签。':required(dimension)?'请至少选择一个标签。':'可选择多个标签，也可留空。';
    picker='<div id="tm-resource-picker" class="tm-resource-picker" onkeydown="App.tmResourcePickerKey(event)"><div class="tm-resource-columns"><nav class="tm-resource-dimensions" role="tablist" aria-orientation="vertical" aria-label="标签维度">'+tabs+'</nav><section id="tm-resource-values" class="tm-resource-values" role="tabpanel" aria-labelledby="tm-dimension-tab-'+e(dimension)+'" data-tag-dimension="'+e(dimension)+'"><div class="tm-dimension-head">'+heading+UI.linkBtn('清空',{disabled:!enabled,onclick:call('tmClearDimension',dimension)})+'</div><input id="tm-resource-query-'+e(dimension)+'" type="search" aria-label="搜索'+e(active.name)+'标签" placeholder="搜索标签" value="'+e(current.query[dimension])+'" oninput="'+e('App.tmTagQuery('+JSON.stringify(dimension)+',this.value)')+'"><div class="tm-options">'+options+'</div><p class="tm-selection-note">'+note+'</p></section></div><div class="tm-resource-picker-footer"><span>可切换维度继续多选</span>'+UI.linkBtn('取消选择',{onclick:'App.tmCancelResourcePicker()'})+UI.btn('确认选择',{kind:'primary',onclick:'App.tmConfirmResourcePicker()'})+'</div></div>';
  }
  UI.drawer(current.multiple?'批量修改标签':'修改标签','<div class="tm-resource-editor">'+summary+'<div class="tm-resource-selector"><label>标签 <span class="tm-required">*</span></label>'+trigger+picker+'<p class="tm-help">业务类型与风险场景必选，其他维度可选。</p><div class="tm-resource-summary" aria-label="已选标签">'+summaries+'</div></div><p id="tm-resource-error" class="tm-error" role="alert">'+e(current.error)+'</p></div>',UI.btn('取消',{onclick:'App.tmCloseResourceEditor()'})+UI.btn('保存标签',{kind:'primary',disabled:current.pickerOpen||!allDimensions.some(dimension=>current.apply[dimension.id]),onclick:'App.tmSaveResourceTags()'}));
}
export const actions={
  tmScope(kind){if(!['question','environment'].includes(kind))return;view.dimension='all';view.query='';view.selected.clear();UI.resetPage(pageKey());refresh();},
  tmTab(dimension){if(dimension!=='all'&&!dimensions().includes(dimension))return;view.dimension=dimension;view.query='';UI.resetPage(pageKey());refresh();},
  tmSearch(query){labelEditor=null;view.query=query;UI.resetPage(pageKey());refresh();const input=document.getElementById('tm-query');input?.focus();input?.setSelectionRange(query.length,query.length);},
  tmSelect(id,checked){if(!Tags.getTag(id))return;checked?view.selected.add(id):view.selected.delete(id);refresh();},
  tmSelectPage(checked){const {rows}=tagRows();for(const tag of UI.paginate(pageKey(),rows).slice)checked?view.selected.add(tag.id):view.selected.delete(tag.id);refresh();},
  tmClearSelection(){view.selected.clear();refresh();},
  tmManageDimensions:renderDimensionManager,
  tmCloseDimensions(){UI.closeDrawer();},
  tmDeleteDimension(id){confirmRemoval({type:'dimension',id});},
  tmDeleteSelected(){tagRows();if(!view.selected.size)return UI.toast('请先选择标签');confirmRemoval({type:'tags',ids:[...view.selected]});},
  tmEdit:editLabel,
  tmEditorDimension(dimension){if(!labelEditor||labelEditor.id)return;labelEditor.dimension=dimension;labelEditor.error='';renderLabelEditor();},
  tmDimensionName(name){if(labelEditor){labelEditor.dimensionName=name;updateBatchPreview();}},
  tmName(name){if(labelEditor){labelEditor.name=name;labelEditor.error='';const target=document.getElementById('tm-error');if(target)target.textContent='';updateBatchPreview();}},
  tmEditorKey(event){if(event.key==='Enter'&&labelEditor?.id){event.preventDefault();actions.tmSave();}else if(event.key==='Escape'){event.preventDefault();actions.tmCancelEdit();}},
  tmCancelEdit(){labelEditor=null;UI.closeDrawer();},
  tmSave(){if(!labelEditor)return;try{
    const current=labelEditor;let message='标签已保存';
    if(current.id)Tags.renameTag(current.id,value('tm-name'));
    else{current.name=value('tm-name');if(current.dimension==='new')current.dimensionName=value('tm-new-dimension');const result=Tags.createTagsWithDimension(batchInput());message=`已新增 ${result.createdCount} 个标签，跳过 ${result.skippedCount} 个重复项`;view.dimension='all';view.query='';UI.resetPage(pageKey());}
    labelEditor=null;UI.closeDrawer();refresh();UI.toast(message);
  }catch(error){if(labelEditor)labelEditor.error=error.message;const target=document.getElementById('tm-error');if(target)target.textContent=error.message;}},
  tmDelete(id){confirmRemoval({type:'tags',ids:[id]});},
  tmCancelDelete(){pendingDelete=null;UI.closeModal();},
  tmConfirmDelete(){if(!pendingDelete)return;try{
    const current=pendingDelete,usage=current.type==='dimension'?Tags.getTagDimensionUsage(current.id):Tags.getTagsDeletionImpact(current.ids);
    if(usageFingerprint(usage)!==current.fingerprint)return confirmRemoval(current,true);
    if(current.type==='dimension')Tags.deleteTagDimension(current.id);else Tags.deleteTags(current.ids);
    for(const tag of usage.tags)view.selected.delete(tag.id);
    if(current.type==='dimension'&&view.dimension===current.id){view.dimension='all';UI.resetPage(pageKey());}
    pendingDelete=null;UI.closeModal();if(current.type==='dimension')UI.closeDrawer();refresh();UI.toast(current.type==='dimension'?'维度、标签及其关联已移除':'标签及其关联已移除');
  }catch(error){UI.toast(error.message);}},
  tmToggleResourcePicker(){if(!resourceEditor)return;if(resourceEditor.pickerOpen)return actions.tmConfirmResourcePicker();resourceEditor.pickerBackup={selected:Object.fromEntries(Object.entries(resourceEditor.selected).map(([id,values])=>[id,new Set(values)])),apply:{...resourceEditor.apply}};resourceEditor.pickerOpen=true;resourceEditor.error='';renderResourceEditor();},
  tmConfirmResourcePicker(){if(!resourceEditor)return;resourceEditor.pickerOpen=false;resourceEditor.pickerBackup=null;renderResourceEditor();document.getElementById('tm-resource-trigger')?.focus();},
  tmCancelResourcePicker(){if(!resourceEditor)return;if(resourceEditor.pickerBackup){resourceEditor.selected=resourceEditor.pickerBackup.selected;resourceEditor.apply=resourceEditor.pickerBackup.apply;}resourceEditor.pickerBackup=null;resourceEditor.pickerOpen=false;resourceEditor.error='';renderResourceEditor();document.getElementById('tm-resource-trigger')?.focus();},
  tmResourcePickerKey(event){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();actions.tmCancelResourcePicker();}},
  tmResourceDimension(dimension){if(!resourceEditor||!dimensions().includes(dimension))return;resourceEditor.activeDimension=dimension;renderResourceEditor();document.getElementById('tm-dimension-tab-'+dimension)?.focus();},
  tmApplyDimension(dimension,checked){if(!resourceEditor||!dimensions().includes(dimension))return;resourceEditor.apply[dimension]=Boolean(checked);resourceEditor.error='';renderResourceEditor();document.getElementById('tm-apply-'+dimension)?.focus();},
  tmSelectTag(dimension,id,checked){if(!resourceEditor?.apply[dimension]||!Tags.listTags(dimension,resourceEditor.kind).some(tag=>tag.id===id))return;checked?resourceEditor.selected[dimension].add(id):resourceEditor.selected[dimension].delete(id);resourceEditor.error='';renderResourceEditor();document.getElementById('tm-resource-tag-'+id)?.focus();},
  tmClearDimension(dimension){if(!resourceEditor?.apply[dimension])return;resourceEditor.selected[dimension].clear();resourceEditor.error='';renderResourceEditor();},
  tmTagQuery(dimension,query){if(!resourceEditor||!dimensions().includes(dimension))return;resourceEditor.query[dimension]=query;renderResourceEditor();const input=document.getElementById('tm-resource-query-'+dimension);input?.focus();input?.setSelectionRange(query.length,query.length);},
  tmCloseResourceEditor(){resourceEditor=null;UI.closeDrawer();},
  tmSaveResourceTags(){if(!resourceEditor)return;try{
    const current=resourceEditor;if(current.pickerOpen)throw Error('请先确认标签选择');
    const ids=current.resources.map(resource=>resource.id),existing=Tags.getResourcesTags(current.kind,ids),selection=Object.fromEntries(dimensions().filter(dimension=>current.apply[dimension]).map(dimension=>[dimension,[...current.selected[dimension]]]));
    for(const dimension of ['business','risk']){const missing=existing.filter(row=>!(selection[dimension]??row[dimension]).length);if(missing.length)throw Error((current.multiple?missing.length+' 个资源缺少':'请选择')+Tags.TAG_DIMENSIONS[dimension]+(current.multiple?'，请在该维度勾选替换并选择至少一个标签':'，至少选择一个标签'));}
    const saved=Tags.saveResourcesTags(current.kind,ids,selection);resourceEditor=null;UI.closeDrawer();current.onSave?.(saved);UI.toast('标签已更新');
  }catch(error){if(resourceEditor){resourceEditor.error=error.message;document.getElementById('tm-resource-error').textContent=error.message;}else UI.toast(error.message);}},
};
