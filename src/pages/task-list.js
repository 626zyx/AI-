/* Shared list presenter: filters are UI state; tasks and lifecycle stay in store. */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { TASK_STATUS } from '../domain/constants.js';
import { editTaskConfig } from './task-wizard.js';
import { compareValues, sortDirection, toggleSort } from '../core/table-sort.js';
import { buildModelConfiguration } from '../domain/task-configuration.js';

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

export function taskListConfiguration(task,type=task.objectType||'model'){
  const config={...task,...task.configSnapshot};
  let attack;
  if(type==='agent'){
    const baseline=config.exerciseMode==='baseline'||config.technique==='baseline';
    const count=config.questionIds?.length??config.taskIdSnapshot?.length??config.questionSnapshots?.length??config.total??0;
    attack=`${baseline?'基础安全演练':`攻击者：${config.attackTemplateName||config.techniqueName||'未选择'}`} · ${count} 个环境`;
  }else{
    const count=config.bankCount??config.modelQuestionSnapshots?.length??config.banks?.reduce((sum,bank)=>sum+(bank.itemIds?.length??bank.count??0),0)??0;
    attack=[config.attackMode!=='custom'?config.strategyName:'',`${config.methods?.length||0} 种攻击方法`,`${count} 道题目`].filter(Boolean).join(' · ');
  }
  const guard=config.guardEnabled===false||!config.guardId?'—':[config.guardName||'防护策略',(config.guardStages||[]).join('/')].filter(Boolean).join(' · ');
  return {attack,guard};
}
const summaryCell=value=>`<span class="tl-config-summary" title="${UI.esc(value)}">${UI.esc(value)}</span>`;

export function taskCanStart(t,type='model'){
  if(!t||!['draft','ready'].includes(t.status)||!String(t.name||'').trim())return false;
  try{
    const input={...t,...t.configSnapshot};
    if(type==='agent')store.agentConfigurationOf(input,{draft:false});
    else buildModelConfiguration({...input,modelPreflightRequired:true},{models:store.models,strategies:store.strategies,banks:store.banks,guards:store.guards,methods:store.methods},{draft:false});
    return true;
  }catch{return false;}
}
function operations(t,type){
  const edit=`App.editTaskConfig('${t.id}','${type}')`,start=`App.taskStart('${t.id}','${type}')`,detail=`App.taskOpen('${t.id}','${type}')`;
  const editable=['draft','ready'].includes(t.status);
  const more=[
    ['终止演练',`App.taskStop('${t.id}','${type}')`,{danger:true,disabled:t.status!=='running'}],
    ['查看报告',`App.taskReport('${t.id}','${type}')`,{disabled:t.status!=='done',title:'任务完成后可查看报告'}],
    ['复制',`App.copyTaskConfig('${t.id}','${type}')`],
    ['删除',`App.taskDelete('${t.id}','${type}')`,{danger:true}],
  ];
  return UI.linkBtn('开始演练',{onclick:start,disabled:!taskCanStart(t,type),title:['draft','ready'].includes(t.status)?'完成任务配置和最小验证后开始演练':'任务已开始'})+UI.linkBtn('详情',{onclick:detail,disabled:t.status==='draft',title:t.status==='draft'?'草稿请通过编辑配置查看':''})+
    UI.linkBtn('编辑配置',{onclick:edit,disabled:!editable,title:!editable?'已开始的任务配置只读':''})+UI.moreMenu(more);
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
  const sortDate=t=>{const value=v.sortKey==='createdAt'?date(t):t.finishedAt;return value?Date.parse(value):null;};
  rows.sort((a,b)=>compareValues(sortDate(a),sortDate(b),v.sortDesc));
  return `${UI.pageHead('演练任务',{actions:UI.btn('新建演练任务',{kind:'primary',ico:'plus',onclick:type==='agent'?'App.newAgTask()':'App.newTask()'})})}
  ${UI.filters({search:{id:`tl-${type}-q`,label:'搜索',value:v.q,placeholder:'搜索任务或靶标',oninput:`App.taskListFilter('${type}','q',this.value)`},selects:[
    {id:`tl-${type}-target`,label:'演练对象',value:v.targetId,options:[['all','全部对象'],...targets],onchange:`App.taskListFilter('${type}','targetId',this.value)`},
    {id:`tl-${type}-status`,label:'任务状态',value:v.status,options:[['all','全部状态'],...Object.entries(TASK_STATUS).map(([k,s])=>[k,s.label])],onchange:`App.taskListFilter('${type}','status',this.value)`},
  ]})}
  ${UI.card('',`<div class="tl-task-table">${UI.pagedTable(`tasks-${type}`,[
    {title:'任务名称',width:'220px',render:t=>`<button class="link-btn tl-task-name" title="${UI.esc(t.name)}" onclick="App.taskOpen('${t.id}','${type}')">${UI.esc(t.name)}</button>`},
    {title:'演练对象',width:'170px',render:t=>summaryCell(t.targetName||'未选择')},
    {title:'任务配置',width:'340px',render:t=>summaryCell(taskListConfiguration(t,type).attack)},
    ...(type==='model'?[{title:'防护配置',width:'220px',render:t=>summaryCell(taskListConfiguration(t,type).guard)}]:[]),
    {title:'状态',width:'100px',render:t=>UI.statusPill(t.status)},
    {title:'完成 / 总单元',width:'170px',render:t=>`<div class="tl-progress${t.status==='running'?' is-running':t.status==='done'?' is-done':''}" role="progressbar" aria-label="${UI.esc(t.name)}执行进度" aria-valuemin="0" aria-valuemax="${t.total||0}" aria-valuenow="${t.units?.length||0}"><span class="tl-progress-count"><strong class="num">${t.units?.length||0} / ${t.total||0}</strong> 单元</span>${UI.progressBar(t.progress||0,{showText:false})}</div>`},
    {title:'创建时间',width:'160px',sort:{direction:sortDirection(v,'createdAt'),onclick:`App.taskListSort('${type}','createdAt')`},render:t=>UI.esc(date(t)?new Date(date(t)).toLocaleString('sv-SE',{hour12:false}):'—')},
    {title:'结束时间',width:'160px',sort:{direction:sortDirection(v,'finishedAt'),onclick:`App.taskListSort('${type}','finishedAt')`},render:t=>UI.esc(t.finishedAt||'—')},
    {title:'操作',width:'290px',cls:'actions',render:t=>`<div class="row-actions tl-row-actions" data-task-status="${t.status}">${operations(t,type)}</div>`},
  ],rows,'暂无匹配任务')}</div>`,'',true)}`;
}

export const actions={
  taskListFilter(type,key,value){if(!['q','targetId','status'].includes(key))return;views[type][key]=value;UI.resetPage(`tasks-${type}`);router.nav(...taskRoute(type));},
  taskListSort(type,key='createdAt'){if(!['createdAt','finishedAt'].includes(key))return;toggleSort(views[type],key);router.nav(...taskRoute(type));},
  taskOpen:openTaskPage,taskReport:openTaskReport,
  async taskStart(id,type='model'){try{const task=getTask(id,type);if(!taskCanStart(task,type))throw Error(type==='model'?'请编辑任务配置并完成最小验证后再开始演练':'请先完成任务配置和靶标验证');if(task.status==='draft')await store.saveTask({...task,...task.configSnapshot,id,name:task.name,description:task.description,objectType:type});await store.startTask(id,type);openTaskPage(id,type);}catch(e){UI.toast(e.message);}},
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
