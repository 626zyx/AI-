/* Shared list presenter: filters are UI state; tasks and lifecycle stay in store. */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { TASK_STATUS } from '../domain/constants.js';
import { editTaskConfig } from './task-wizard.js';
import { compareValues, sortDirection, toggleSort } from '../core/table-sort.js';

const views = {model:{q:'',targetId:'all',status:'all',sortKey:'createdAt',sortDesc:true},agent:{q:'',targetId:'all',status:'all',sortKey:'createdAt',sortDesc:true}};
export const taskRoute = (type, view='tasks') => type==='agent'?['agent',({tasks:'ag-tasks',detail:'ag-task-detail',report:'ag-report-detail',create:'ag-task-create'})[view]]:['exercise',({tasks:'tasks',detail:'task-detail',report:'report-detail',create:'task-create'})[view]];
const getTask = (id,type) => type==='agent'?store.getAgentTask(id):store.getTask(id);
const targetKey = (task,type) => {
  if (type !== 'model') return task.targetId;
  // Model revisions share one user-facing resource; historical aliases join the same filter.
  const id = task.configSnapshot?.targetAssetId || store.models.find(model => model.id === task.targetId)?.assetId || String(task.targetId || '').split('@')[0];
  return id.replace(/^tgt-/, 'mdl-');
};
export function openTaskPage(id,type='model'){
  if(getTask(id,type)?.status==='draft')return editTaskConfig(id,type);
  router.nav(...taskRoute(type,'detail'),id);
}
export function openTaskReport(id,type='model'){const t=getTask(id,type);if(t?.status!=='done')return UI.toast('任务完成后可查看报告');router.nav(...taskRoute(type,'report'),id);}

function operations(t,type){
  const edit=`App.editTaskConfig('${t.id}','${type}')`,start=`App.taskStart('${t.id}','${type}')`,detail=`App.taskOpen('${t.id}','${type}')`;
  const commands = t.status==='draft' ? [['编辑',edit]]
    : t.status==='ready' ? [['开始演练',start],['详情',detail]]
    : t.status==='running' ? [['终止演练',`App.taskStop('${t.id}','${type}')`],['详情',detail]]
    : [...(t.status==='done'?[['查看报告',`App.taskReport('${t.id}','${type}')`]]:[]),['详情',detail]];
  const more=[...(t.status==='ready'?[['编辑配置',edit]]:[]),['复制配置',`App.copyTaskConfig('${t.id}','${type}')`],['删除',`App.taskDelete('${t.id}','${type}')`,{danger:true}]];
  return commands.map(([label,onclick])=>UI.linkBtn(label,{onclick,danger:label==='终止演练'})).join('')+UI.moreMenu(more);
}

export function taskListPage(type='model',draftsOnly=false){
  const v=views[type];if(draftsOnly)v.status='draft';
  const all=type==='agent'?store.listAgentTasks():store.listTasks();
  if(all.some(t=>t.id===router.state().param&&t.status==='draft')){
    Object.assign(v,{q:'',targetId:'all',status:'all',sortKey:'createdAt',sortDesc:true});UI.resetPage(`tasks-${type}`);
  }
  const targets=[...new Map(all.filter(t=>t.targetId).map(t=>[targetKey(t,type),t.targetName])).entries()];
  const rows=all.filter(t=>(v.status==='all'||t.status===v.status)&&(v.targetId==='all'||targetKey(t,type)===v.targetId)&&`${t.name} ${t.targetName} ${t.id}`.toLowerCase().includes(v.q.trim().toLowerCase()));
  const date=t=>t.createdAt||t.startedAt||'';
  rows.sort((a,b)=>compareValues(v.sortKey==='createdAt'?date(a):a.finishedAt,v.sortKey==='createdAt'?date(b):b.finishedAt,v.sortDesc));
  return `${UI.pageHead('演练任务',{actions:UI.btn('新建演练任务',{kind:'primary',ico:'plus',onclick:type==='agent'?'App.newAgTask()':'App.newTask()'})})}
  ${UI.filters({search:{id:`tl-${type}-q`,label:'搜索',value:v.q,placeholder:'搜索任务或靶标',oninput:`App.taskListFilter('${type}','q',this.value)`},selects:[
    {id:`tl-${type}-target`,label:'演练对象',value:v.targetId,options:[['all','全部对象'],...targets],onchange:`App.taskListFilter('${type}','targetId',this.value)`},
    {id:`tl-${type}-status`,label:'任务状态',value:v.status,options:[['all','全部状态'],...Object.entries(TASK_STATUS).map(([k,s])=>[k,s.label])],onchange:`App.taskListFilter('${type}','status',this.value)`},
  ]})}
  ${UI.card('',UI.pagedTable(`tasks-${type}`,[
    {title:'任务名称',render:t=>`<button class="link-btn" onclick="App.taskOpen('${t.id}','${type}')">${UI.esc(t.name)}</button>`},
    {title:'演练对象',render:t=>UI.esc(t.targetName||'未选择')},
    {title:'状态',render:t=>UI.statusPill(t.status)},
    {title:'执行进度',width:'160px',render:t=>`<div class="tl-progress">${UI.progressBar(t.progress||0)}<span class="tl-sub num">${t.units?.length||0} / ${t.total||0} 单元已结束</span></div>`},
    {title:'创建时间',width:'160px',sort:{direction:sortDirection(v,'createdAt'),onclick:`App.taskListSort('${type}','createdAt')`},render:t=>UI.esc(date(t)||'—')},
    {title:'结束时间',width:'160px',sort:{direction:sortDirection(v,'finishedAt'),onclick:`App.taskListSort('${type}','finishedAt')`},render:t=>UI.esc(t.finishedAt||'—')},
    {title:'操作',width:'210px',cls:'actions',render:t=>`<div class="row-actions tl-row-actions" data-task-status="${t.status}">${operations(t,type)}</div>`},
  ],rows,'暂无匹配任务'),'',true)}`;
}

export const actions={
  taskListFilter(type,key,value){if(!['q','targetId','status'].includes(key))return;views[type][key]=value;UI.resetPage(`tasks-${type}`);router.nav(...taskRoute(type));},
  taskListSort(type,key='createdAt'){if(!['createdAt','finishedAt'].includes(key))return;toggleSort(views[type],key);router.nav(...taskRoute(type));},
  taskOpen:openTaskPage,taskReport:openTaskReport,
  async taskStart(id,type='model'){try{await store.startTask(id,type);openTaskPage(id,type);}catch(e){UI.toast(e.message);}},
  async taskStop(id,type='model'){try{await store.stopTask(id,type);UI.toast('演练已终止，已完成记录已保留');}catch(e){UI.toast(e.message);}},
  taskDelete(id,type='model') {
    const task=getTask(id,type);if(!task)return;
    UI.modal('删除演练任务',`<p>删除「${UI.esc(task.name)}」？${task.status==='running'?'当前演练将同时终止。':''}</p>`,
      UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('删除',{kind:'danger',onclick:`App.taskDeleteConfirm('${id}','${type}')`}));
  },
  async taskDeleteConfirm(id,type='model') {
    const task=getTask(id,type);if(!task)return UI.closeModal();
    try{await store.deleteTask(id,type);UI.closeModal();router.nav(...taskRoute(type));UI.toast('任务已删除');}
    catch(e){UI.toast(e.message);}
  },
};
