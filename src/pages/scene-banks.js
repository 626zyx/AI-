/* 环境库按环境展示；发布题与草稿使用同一领域接口。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import { getAgentQuestions, getAgentQuestion, deleteAgentQuestion, exportAgentQuestionsZip } from '../domain/agent-environments.js';
import { RISK_LABEL } from '../domain/constants.js';
const view = { q:'', source:'', business:'', risk:'', status:'published' };
const selected = new Set();
let pageRows = [], pendingDelete = [];
const arg = value => encodeURIComponent(value).replace(/'/g, '%27');
const refresh = () => router.nav('strategy', 'scenebanks');
const selection = () => [...selected].map(getAgentQuestion).filter(Boolean);
function filteredRows() {
  const query = view.q.trim().toLowerCase();
  return getAgentQuestions({status:'all'}).filter(q => (!view.status || q.status === view.status)
    && (!view.source || q.source === view.source) && (!view.business || q.business === view.business)
    && (!view.risk || q.riskLabels.includes(view.risk))
    && (!query || `${q.title} ${q.taskId} ${q.business} ${q.riskLabels.map(label => RISK_LABEL[label]?.label || label).join(' ')}`.toLowerCase().includes(query)));
}
function renderTable(rows) {
  const pg = UI.paginate('agent-environments', rows); pageRows = pg.slice;
  const all = pageRows.length > 0 && pageRows.every(q => selected.has(q.id));
  const columns = [
    { title:`<input type="checkbox" aria-label="全选当前页" ${all?'checked':''} ${pageRows.length?'':'disabled'} onchange="App.sbSelectPage(this.checked)">`, raw:true, width:'42px', render:q=>`<input type="checkbox" aria-label="选择 ${UI.esc(q.title)}" ${selected.has(q.id)?'checked':''} onchange="App.sbSelect('${q.id}',this.checked)">` },
    { title:'环境名称', width:'340px', render:q=>`<button class="link-btn ae-title" onclick="App.aeOpen('${q.id}')">${UI.esc(q.title)}</button><div class="faint text-support mono">${UI.esc(q.taskId)}</div>` },
    { title:'来源', width:'72px', render:q=>UI.badge(q.source==='system'?'系统':'自建',q.source==='system'?'blue':'gray') },
    { title:'业务类型', width:'135px', render:q=>UI.esc(q.business) },
    { title:'风险场景', width:'190px', render:q=>`<div class="ae-risk-summary" title="${UI.esc(q.riskLabels.map(label=>RISK_LABEL[label]?.label||label).join('、'))}">${UI.esc(q.riskLabels.slice(0,2).map(label=>RISK_LABEL[label]?.label||label).join('、'))}${q.riskLabels.length>2?` 等${q.riskLabels.length}项`:''}</div>` },
    { title:'状态', width:'85px', render:q=>UI.badge(q.status==='draft'?'草稿':'已发布',q.status==='draft'?'gray':'green') },
    { title:'更新时间', width:'110px', render:q=>UI.esc(q.updatedAt?new Date(q.updatedAt).toLocaleDateString('zh-CN'):'—') },
    { title:'操作', width:'130px', render:q=>`<div class="row-actions">${UI.linkBtn(q.status==='draft'?'编辑':'查看',{onclick:`App.aeOpen('${q.id}')`})}${UI.moreMenu([['复制为草稿',`App.aeCopy('${q.id}')`],['导出 ZIP',`App.aeExport('${q.id}')`],...(q.source==='custom'?[['删除',`App.aeDelete('${q.id}')`]]:[])])}</div>` },
  ];
  return UI.table(columns,pg.slice,view.status==='draft'?'暂无匹配草稿，可导入文件包或生成草稿':'暂无匹配环境')+UI.pager(pg,"UI.setPage('agent-environments',{p})");
}
export function sceneBanksPage() {
  const allQuestions=getAgentQuestions({status:'all'});
  for(const id of selected)if(!allQuestions.some(q=>q.id===id))selected.delete(id);
  const rows=filteredRows(),picked=selection(),customCount=picked.filter(q=>q.source==='custom').length;
  const businesses=[...new Set(allQuestions.map(q=>q.business))];
  const filter=(key,label,options)=>({label,id:`sb-${key}`,value:view[key],options,onchange:`App.sbFilter('${key}',this.value)`});
  const filters=UI.filters({search:{label:'搜索',id:'sb-q',value:view.q,placeholder:'搜索环境、编号或风险',oninput:'App.sbSearch(this.value)'},selects:[
    filter('source','来源',[['','全部来源'],['system','系统'],['custom','自建']]),
    filter('business','业务类型',[['','全部业务'],...businesses.map(b=>[b,b])]),
    filter('risk','风险场景',[['','全部风险'],...Object.entries(RISK_LABEL).map(([id,value])=>[id,value.label])]),
    filter('status','状态',[['','全部状态'],['published','已发布'],['draft','草稿']]),
  ]});
  const batch=`<div class="ae-batch-toolbar"><div class="ae-selection"><span>已选 <strong>${picked.length}</strong> 个环境${picked.length?`（自建 ${customCount}，系统 ${picked.length-customCount}）`:''}</span>${UI.linkBtn('选择全部筛选结果',{onclick:'App.sbSelectMatching()'})}${UI.linkBtn('清空选择',{onclick:'App.sbClearSelection()'})}</div><div class="row-actions">${UI.btn('批量导出',{disabled:!picked.length,onclick:'App.sbExportSelected()'})}${UI.btn('批量删除',{disabled:!customCount,onclick:'App.sbDeleteSelected()'})}</div></div>`;
  const tools=UI.btn('导入环境',{onclick:'App.aeImportDialog()'})+UI.btn('自动生成环境',{kind:'primary',ico:'plus',onclick:'App.aeGenerateDialog()'});
  return UI.pageHead('环境库',{actions:tools})+`<div class="ae-library"><section><div class="ae-list-toolbar">${filters}</div>${batch}<div class="ae-library-table">${UI.card('',renderTable(rows),'',true)}</div></section></div>`;
}
export const actions = {
  sbSearch(value){const active=document.getElementById('sb-q'),position=active?.selectionStart;view.q=value;UI.resetPage('agent-environments');refresh();const input=document.getElementById('sb-q');if(input&&active){input.focus();if(position!=null)input.setSelectionRange(position,position);}},
  sbFilter(key,value){if(!['source','business','risk','status'].includes(key))return;view[key]=value;UI.resetPage('agent-environments');refresh();},
  sbCategory(value){view.business='';view.status=value==='draft'?'draft':'published';UI.resetPage('agent-environments');refresh();},
  sbSelect(id,checked){if(!getAgentQuestion(id))return;checked?selected.add(id):selected.delete(id);refresh();},
  sbSelectPage(checked){pageRows.forEach(q=>checked?selected.add(q.id):selected.delete(q.id));refresh();},
  sbSelectMatching(){filteredRows().forEach(q=>selected.add(q.id));refresh();},
  sbClearSelection(){selected.clear();refresh();},
  sbExportSelected(){try{const questions=selection();if(!questions.length)return UI.toast('请先选择环境');const bytes=exportAgentQuestionsZip(questions.map(q=>q.id)),url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'})),link=document.createElement('a');link.href=url;link.download=`Agent环境-${questions.length}个环境.zip`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);UI.toast(`已导出${questions.length}个环境的ZIP文件包，每个环境独立目录`);}catch(error){UI.toast(error.message);}},
  sbDeleteSelected(){const rows=selection(),custom=rows.filter(q=>q.source==='custom');if(!custom.length)return UI.toast('系统环境不可删除，请选择自建环境');pendingDelete=custom.map(q=>q.id);const skipped=rows.length-custom.length;UI.modal('批量删除自建环境',`<p>确认删除所选的 ${custom.length} 个自建环境？</p>${skipped?`<p>已自动排除 ${skipped} 个系统环境，它们会继续保留。</p>`:''}<ul class="ae-delete-preview">${custom.map(q=>`<li>${UI.esc(q.title)}</li>`).join('')}</ul>`,UI.btn('取消',{onclick:'App.sbDeleteCancel()'})+UI.btn('确认删除',{kind:'danger',onclick:'App.sbDeleteConfirm()'}));},
  sbDeleteCancel(){pendingDelete=[];UI.closeModal();},
  sbDeleteConfirm(){const ids=pendingDelete.filter(id=>getAgentQuestion(id)?.source==='custom');pendingDelete=[];ids.forEach(id=>{deleteAgentQuestion(id);selected.delete(id);});UI.closeModal();UI.resetPage('agent-environments');refresh();UI.toast(`已删除${ids.length}个自建环境`);},
  openSceneBank(id){const question=getAgentQuestion(id)||getAgentQuestions({bankId:id})[0];if(question)router.nav('strategy','authoring',question.id);},
  sbExport(id){globalThis.App?.aeExport(getAgentQuestion(id)?.id||getAgentQuestions({bankId:id})[0]?.id);},
};
