/* 环境库按环境展示；发布题与草稿使用同一领域接口。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import { getAgentQuestions, getAgentQuestion, deleteAgentQuestion, exportAgentQuestionsZip, agentQuestionPublishReadiness, publishAgentQuestion } from '../domain/agent-environments.js';
import { RISK_LABEL } from '../domain/constants.js';
import { resourceGroupsPanel, resourceGroupActions } from './question-library.js';
import * as Tags from '../domain/resource-tags.js';
import { openResourceTagEditor } from './tag-management.js';
import { agentEnvironmentActions } from './agent-environment-editor.js';
import { renderTagFilter, matchesTagSelection, normalizeTagSelection, actions as tagFilterActions } from '../core/tag-filter.js';
const view = { q:'', source:'', status:'', tagSelection:{} };
let activeTab = 'all';
const selected = new Set();
let pageRows = [], pendingDelete = [], pendingPublish = [];
const arg = value => encodeURIComponent(value).replace(/'/g, '%27');
const refresh = () => router.nav('strategy', 'scenebanks');
const selection = () => [...selected].map(getAgentQuestion).filter(Boolean);
const publishError = q => q.source !== 'custom' || q.status !== 'draft' ? '仅自建草稿可发布' : agentQuestionPublishReadiness(q.id).errors.join('；');
export function registerEnvironmentTags() {
  const rows=getAgentQuestions({status:'all'}).reverse().sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0));
  Tags.registerResourceSeeds('environment',rows.map(q=>({id:q.id,title:q.title,seeds:{business:q.business?[q.business]:[],risk:q.riskLabels.map(label=>RISK_LABEL[label]?.label||label)}})),{replace:true});
  return rows;
}
const tagText = (question,dimension) => question.classification.names[dimension].join('、') || '—';
const cellText = (value,cls='') => `<span class="ae-cell-text ${cls}" title="${UI.esc(value)}">${UI.esc(value)}</span>`;
const otherTagText = (question,dimensions) => dimensions.filter(d=>!d.system&&(question.classification.names[d.id]||[]).length).map(d=>d.name+'：'+question.classification.names[d.id].join('、')).join('；')||'—';
function classifiedRows(questions = registerEnvironmentTags()) {
  const tagsById = new Map(Tags.getResourcesTags('environment',questions.map(q=>q.id)).map(tags=>[tags.id,tags]));
  return questions.map(q=>({...q,classification:tagsById.get(q.id)}));
}
function filteredRows(questions = registerEnvironmentTags()) {
  const query = view.q.trim().toLowerCase();
  return classifiedRows(questions).filter(q => {
    const tags=q.classification,names=tags.names;
    return (!view.status || q.status===view.status)&&(!view.source||q.source===view.source)
      && matchesTagSelection(tags,view.tagSelection)
      && (!query||`${q.title} ${q.taskId} ${Object.values(names).flat().join(' ')}`.toLowerCase().includes(query));
  });
}
function renderTable(rows, dimensions) {
  const pg = UI.paginate('agent-environments', rows); pageRows = pg.slice;
  const all = pageRows.length > 0 && pageRows.every(q => selected.has(q.id));
  const columns = [
    { title:`<input type="checkbox" aria-label="全选当前页" ${all?'checked':''} ${pageRows.length?'':'disabled'} onchange="App.sbSelectPage(this.checked)">`, raw:true, width:'42px', render:q=>`<input type="checkbox" aria-label="选择 ${UI.esc(q.title)}" ${selected.has(q.id)?'checked':''} onchange="App.sbSelect('${q.id}',this.checked)">` },
    { title:'环境名称', width:'260px', cls:'ae-title-cell', render:q=>`<button class="link-btn ae-title" title="${UI.esc(q.title)}" onclick="App.aeOpen('${q.id}')">${UI.esc(q.title)}</button>` },
    { title:'环境编号', width:'160px', render:q=>cellText(q.taskId) },
    { title:'来源', width:'72px', render:q=>UI.badge(q.source==='system'?'系统':'自建',q.source==='system'?'blue':'gray') },
    { title:'业务类型', width:'135px', render:q=>cellText(tagText(q,'business'),'ae-managed-tags') },
    { title:'风险场景', width:'190px', render:q=>cellText(tagText(q,'risk'),'ae-managed-tags') },
    { title:'其他标签',width:'180px',render:q=>cellText(otherTagText(q,dimensions)) },
    { title:'状态', width:'85px', render:q=>UI.badge(q.status==='draft'?'草稿':'已发布',q.status==='draft'?'gray':'green') },
    { title:'更新时间', width:'110px', render:q=>UI.esc(q.updatedAt?new Date(q.updatedAt).toLocaleDateString('zh-CN'):'—') },
    { title:'操作', width:'235px', render:q=>`<div class="row-actions">${UI.linkBtn('发布',{onclick:`App.sbPublish('${q.id}')`,disabled:Boolean(publishError(q)),title:publishError(q)})}${UI.linkBtn('详情',{onclick:`App.aeOpen('${q.id}')`})}${UI.linkBtn('编辑',{onclick:`App.aeOpen('${q.id}')`,disabled:q.status!=='draft'||q.source!=='custom'})}${UI.moreMenu([['编辑标签',`App.sbEditTags('${q.id}')`],['复制为草稿',`App.aeCopy('${q.id}')`],['导出 ZIP',`App.aeExport('${q.id}')`],['删除',`App.aeDelete('${q.id}')`,{danger:true,disabled:q.source!=='custom'}]])}</div>` },
  ];
  return UI.table(columns,pg.slice,view.status==='draft'?'暂无匹配草稿，可导入文件包或生成草稿':'暂无匹配环境')+UI.pager(pg,"UI.setPage('agent-environments',{p})");
}
export function sceneBanksPage() {
  const allQuestions=registerEnvironmentTags();
  if(allQuestions.some(row=>row.id===router.state().param)){Object.assign(view,{q:'',source:'',status:'',tagSelection:{}});activeTab='all';UI.resetPage('agent-environments');}
  const tabs='<div class="ql-tabs" role="tablist" aria-label="环境库视图">'+[['all','全部环境'],['groups','环境分组']].map(([id,label])=>`<button role="tab" aria-selected="${activeTab===id}" class="${activeTab===id?'active':''}" onclick="App.sbTab('${id}')">${label}</button>`).join('')+'</div>';
  if(activeTab==='groups')return UI.pageHead('环境库')+tabs+resourceGroupsPanel('environment',{
    resources:()=>classifiedRows().map(q=>({...q,business:tagText(q,'business')})),refresh,
    systemGroups:()=>{const groups=new Map();for(const q of getAgentQuestions())if(q.source==='system'){if(!groups.has(q.bankId))groups.set(q.bankId,{id:'system-environment-'+q.bankId,kind:'environment',name:q.business,source:'system',description:'',memberIds:[],updatedAt:q.updatedAt});groups.get(q.bankId).memberIds.push(q.id);}return[...groups.values()];},
  });
  const dimensions=Tags.listTagDimensions(),normalized=normalizeTagSelection(view.tagSelection);
  if(JSON.stringify(normalized)!==JSON.stringify(view.tagSelection)){view.tagSelection=normalized;UI.resetPage('agent-environments');}
  for(const id of selected)if(!allQuestions.some(q=>q.id===id))selected.delete(id);
  const rows=filteredRows(allQuestions,dimensions),picked=selection(),customCount=picked.filter(q=>q.source==='custom').length,draftCount=picked.filter(q=>q.source==='custom'&&q.status==='draft').length;
  const filter=(key,label,options)=>({label,id:`sb-${key}`,value:view[key],options,onchange:`App.sbFilter('${key}',this.value)`});
  const batchMenu='<span class="dd ae-batch-menu"><button class="btn w-md" type="button" aria-haspopup="menu" aria-expanded="false" '+(!picked.length?'disabled ':'')+'onclick="UI.toggleMenu(event,this)">批量操作</button><span class="dd-menu" role="menu" hidden><button type="button" role="menuitem" onclick="UI.closeMenus();App.sbExportSelected()">批量导出</button><button type="button" role="menuitem" '+(!customCount?'disabled ':'')+'onclick="UI.closeMenus();App.sbDeleteSelected()">批量删除</button></span></span>';
  const tools=batchMenu+'<span class="dd ae-create-menu"><button class="btn w-md primary" type="button" aria-haspopup="menu" aria-expanded="false" onclick="UI.toggleMenu(event,this)">新建环境</button><span class="dd-menu" role="menu" hidden>'+[['上传文件','App.aeImportDialog()'],['自动生成','App.aeGenerateDialog()'],['编辑环境','App.aeCreate(true)']].map(([label,handler])=>'<button type="button" role="menuitem" onclick="UI.closeMenus();'+handler+'">'+label+'</button>').join('')+'</span></span>';
  const filters=UI.filters({search:{label:'搜索',id:'sb-q',value:view.q,placeholder:'搜索环境、编号或风险',oninput:'App.sbSearch(this.value)'},selects:[
    filter('source','来源',[['','全部来源'],['system','系统'],['custom','自建']]),
  ],extra:renderTagFilter('environment-library',{getSelection:()=>view.tagSelection,onChange(selection){view.tagSelection=selection;UI.resetPage('agent-environments');refresh();}})+'<label class="filter"><span>状态</span><select id="sb-status" onchange="App.sbFilter(\'status\',this.value)">'+[['','全部状态'],['published','已发布'],['draft','草稿']].map(([value,label])=>'<option value="'+value+'" '+(view.status===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label>',right:tools});
  const batch=picked.length?`<div class="ae-batch-toolbar"><div class="ae-selection"><span>已选 <strong>${picked.length}</strong> 个环境（自建 ${customCount}，系统 ${picked.length-customCount}）</span>${UI.linkBtn('选择全部筛选结果',{onclick:'App.sbSelectMatching()'})}${UI.linkBtn('清空选择',{onclick:'App.sbClearSelection()'})}</div></div>`:'';
  return UI.pageHead('环境库')+tabs+`<div class="ae-library"><section><div class="ae-list-toolbar">${filters}</div>${batch}<div class="ae-library-table">${UI.card('',renderTable(rows,dimensions),'',true)}</div></section></div>`;
}
function publishPreview(records) {
  const drafts=records.filter(q=>q.source==='custom'&&q.status==='draft');
  if(!drafts.length)return UI.toast('请选择自建草稿');
  pendingPublish=drafts.map(q=>q.id);
  const rows=drafts.map(q=>({...q,...agentQuestionPublishReadiness(q.id)})),ready=rows.filter(q=>q.ready).length;
  const skipped=records.length-drafts.length;
  UI.modal('确认发布环境',`<p>待发布 ${drafts.length} 个自建草稿，其中 ${ready} 个已通过当前内容的验证。</p>${skipped?`<p class="ai-help">已排除 ${skipped} 个系统或已发布环境。</p>`:''}<p class="ai-help">仅发布已完成可运行性检查与基本对照测试的环境，其余请先进入编辑器验证。</p><p class="ai-help">发布后环境文件及评估配置不可编辑；需要修改时可复制为草稿，分类标签仍可调整。</p><div class="ae-publish-preview">${UI.table([
    {title:'环境名称',render:q=>UI.esc(q.title)},
    {title:'验证结果',render:q=>q.ready?UI.badge('已通过（本地模拟）','green'):`<span class="ai-error">${UI.esc(q.errors.join('；'))}</span>`},
    {title:'操作',width:'85px',render:q=>UI.linkBtn('去验证',{onclick:`App.sbVerify('${q.id}')`,disabled:q.ready})},
  ],rows)}</div>`,UI.btn('取消',{onclick:'App.sbPublishCancel()'})+UI.btn(`发布已通过的 ${ready} 个`,{kind:'primary',disabled:!ready,onclick:'App.sbPublishConfirm()'}),{wide:true});
}
export const actions = {
  ...resourceGroupActions,
  ...tagFilterActions,
  sbTab(tab){if(!['all','groups'].includes(tab))return;activeTab=tab;refresh();},
  sbSearch(value){const active=document.getElementById('sb-q'),position=active?.selectionStart;view.q=value;UI.resetPage('agent-environments');refresh();const input=document.getElementById('sb-q');if(input&&active){input.focus();if(position!=null)input.setSelectionRange(position,position);}},
  sbFilter(key,value){if(!['source','business','risk','status'].includes(key))return;if(['business','risk'].includes(key))view.tagSelection={...view.tagSelection,[key]:value?[value]:[]};else view[key]=value;UI.resetPage('agent-environments');refresh();},
  sbDimensionFilter(dimension,value){if(!Tags.listTagDimensions().some(d=>d.id===dimension&&!d.system))return;view.tagSelection={...view.tagSelection,[dimension]:value?[value]:[]};UI.resetPage('agent-environments');refresh();},
  sbCategory(value){delete view.tagSelection.business;view.status=value==='draft'?'draft':'published';UI.resetPage('agent-environments');refresh();},
  sbSelect(id,checked){if(!getAgentQuestion(id))return;checked?selected.add(id):selected.delete(id);refresh();},
  sbSelectPage(checked){pageRows.forEach(q=>checked?selected.add(q.id):selected.delete(q.id));refresh();},
  sbSelectMatching(){filteredRows().forEach(q=>selected.add(q.id));refresh();},
  sbClearSelection(){selected.clear();refresh();},
  sbEditTags(id){try{registerEnvironmentTags();const question=getAgentQuestion(id);if(question)openResourceTagEditor('environment',[question],{onSave:refresh});}catch(error){UI.toast(error.message);}},
  sbEditSelectedTags(){try{registerEnvironmentTags();const records=selection();if(!records.length)return UI.toast('请先选择环境');openResourceTagEditor('environment',records,{onSave:refresh});}catch(error){UI.toast(error.message);}},
  sbPublish(id){const question=getAgentQuestion(id);if(!question||question.source!=='custom'||question.status!=='draft')return UI.toast('仅自建草稿可发布');if(!agentQuestionPublishReadiness(id).ready)return actions.sbVerify(id);publishPreview([question]);},
  sbPublishSelected(){publishPreview(selection());},
  sbPublishCancel(){pendingPublish=[];UI.closeModal();},
  sbVerify(id){const question=getAgentQuestion(id);if(!question||question.source!=='custom'||question.status!=='draft')return;pendingPublish=[];UI.closeModal();agentEnvironmentActions.aeOpen(id);agentEnvironmentActions.aeEditorView('validation');},
  sbPublishConfirm(){
    const ids=[...pendingPublish];pendingPublish=[];if(!ids.length)return;
    const results=ids.map(id=>{const question=getAgentQuestion(id);try{const readiness=agentQuestionPublishReadiness(id);if(!readiness.ready)throw Error(readiness.errors.join('；'));publishAgentQuestion(id);selected.delete(id);return{id,title:question.title,passed:true,reason:'已发布'};}catch(error){return{id,title:question?.title||id,passed:false,reason:error.message};}});
    const passed=results.filter(row=>row.passed).length;refresh();
    UI.modal('环境发布结果',`<p>已发布 ${passed} 个，未发布 ${results.length-passed} 个。</p><div class="ae-publish-preview">${UI.table([
      {title:'环境名称',render:row=>UI.esc(row.title)},
      {title:'结果',render:row=>row.passed?UI.badge('已发布','green'):`<span class="ai-error">${UI.esc(row.reason)}</span>`},
      {title:'操作',width:'85px',render:row=>UI.linkBtn('去验证',{onclick:`App.sbVerify('${row.id}')`,disabled:row.passed||getAgentQuestion(row.id)?.status!=='draft'})},
    ],results)}</div>`,UI.btn('关闭',{onclick:'UI.closeModal()'}),{wide:true});
  },
  sbExportSelected(){try{const questions=selection();if(!questions.length)return UI.toast('请先选择环境');const bytes=exportAgentQuestionsZip(questions.map(q=>q.id)),url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'})),link=document.createElement('a');link.href=url;link.download=`Agent环境-${questions.length}个环境.zip`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);UI.toast(`已导出${questions.length}个环境的ZIP文件包，每个环境独立目录`);}catch(error){UI.toast(error.message);}},
  sbDeleteSelected(){const rows=selection(),custom=rows.filter(q=>q.source==='custom');if(!custom.length)return UI.toast('系统环境不可删除，请选择自建环境');pendingDelete=custom.map(q=>q.id);const skipped=rows.length-custom.length;UI.modal('批量删除自建环境',`<p>确认删除所选的 ${custom.length} 个自建环境？</p>${skipped?`<p>已自动排除 ${skipped} 个系统环境，它们会继续保留。</p>`:''}<div class="ae-delete-preview">${UI.table([{title:'环境名称',render:q=>UI.esc(q.title)}],custom)}</div>`,UI.btn('取消',{onclick:'App.sbDeleteCancel()'})+UI.btn('确认删除',{kind:'danger',onclick:'App.sbDeleteConfirm()'}));},
  sbDeleteCancel(){pendingDelete=[];UI.closeModal();},
  sbDeleteConfirm(){const ids=pendingDelete.filter(id=>getAgentQuestion(id)?.source==='custom');pendingDelete=[];ids.forEach(id=>{deleteAgentQuestion(id);selected.delete(id);});UI.closeModal();UI.resetPage('agent-environments');refresh();UI.toast(`已删除${ids.length}个自建环境`);},
  openSceneBank(id){const question=getAgentQuestion(id)||getAgentQuestions({bankId:id})[0];if(question)router.nav('strategy','authoring',question.id);},
  sbExport(id){globalThis.App?.aeExport(getAgentQuestion(id)?.id||getAgentQuestions({bankId:id})[0]?.id);},
};
