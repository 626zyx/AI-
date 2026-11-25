/* Model and Agent tasks share stable process and log panes. Live events patch content without losing selection or scroll. */
import * as UI from '../core/ui.js';
import { configSummary } from '../core/task-config.js';
import * as store from '../domain/store.js';
import { roundInfo } from '../domain/task-rounds.js';
import { taskMetricCards } from './task-metrics.js';
import { agentDetailUnits, agentQuestionTitle, renderAgentQuestionFlow } from './agent-question-flow.js';
import { unitTechnicalMetrics } from '../domain/unit-technical-metrics.js';
import { classificationFields } from '../domain/task-classification.js';
import { taskCanStart } from './task-list.js';

const views=new Map();
const getTask=(id,type)=>type==='agent'?store.getAgentTask(id):store.getTask(id);
const stageNames={preparing:'准备演练环境',ready:'红队、靶标与裁判就绪',attack:'红队生成攻击',input_guard:'蓝队输入审核',target:'靶标响应',output_guard:'蓝队输出审核',judge:'裁判评估',round_complete:'本轮结束',unit_complete:'单元结束',complete:'结果汇总完成'};
const viewOf=id=>{if(!views.has(id))views.set(id,{selected:null,follow:true,tableFollow:true,tab:'process',logFollow:true,logScroll:0,page:1,query:''});return views.get(id);};
const allUnits=t=>t.objectType==='agent'?agentDetailUnits(t):t.executionUnits||t.units||[];
const unitStatus=u=>u.executionStatus||'done';
const verdict=u=>unitStatus(u)==='pending'?'pending':unitStatus(u)==='running'?'running':unitStatus(u)==='stopped'?'stopped':u.verdict||(u.judgeSuccess===true?'breach':u.judgeSuccess===false?'safe':'error');
const verdictNames={pending:'待执行',running:'执行中',stopped:'已终止',breach:'已攻破',safe:'未攻破',error:'异常'};
const budget=n=>n==null?'—':String(n);
const evidence=(label,text,role='')=>`<section class="ew-evidence ${role}"><h5>${UI.esc(label)}</h5><pre>${UI.esc(text||'—')}</pre></section>`;

function selectedUnit(t,v){const units=allUnits(t);return units.find(u=>u.id===v.selected)||units.find(u=>u.id===t.replay?.activeUnitId)||units.find(u=>unitStatus(u)==='running')||units[0];}
function controlHTML(t,type){
  if(t.status==='draft')return UI.btn('继续配置',{kind:'primary',onclick:`App.editTaskConfig('${t.id}','${type}')`});
  if(t.status==='ready')return UI.btn('开始演练',{kind:'primary',onclick:`App.taskStart('${t.id}','${type}')`,disabled:!taskCanStart(t,type),title:type==='model'?'完成当前配置的最小演示验证后开始演练':'完成当前靶标的沙箱演示验证后开始演练'});
  if(t.status==='running')return UI.btn('终止演练',{kind:'danger',onclick:`App.taskStop('${t.id}','${type}')`});
  return t.status==='done'?UI.btn('查看报告',{kind:'primary',onclick:`App.taskReport('${t.id}','${type}')`}):'';
}

function progressHTML(t){
  const units=allUnits(t),total=Math.max(Number(t.total)||0,units.length);
  const running=units.filter(u=>unitStatus(u)==='running');
  const errors=units.filter(u=>unitStatus(u)==='error'||unitStatus(u)==='done'&&verdict(u)==='error').length;
  const completed=units.filter(u=>unitStatus(u)==='done'&&verdict(u)!=='error').length;
  const ended=completed+errors,progress=total?Math.min(1,ended/total):0;
  const state=t.status==='error'?'error':t.status==='done'?'done':t.status==='running'?'running':'idle';
  const active=running.map(u=>`#${String(units.indexOf(u)+1).padStart(2,'0')}`).join('、');
  return `<div class="ew-progress-summary is-${state}"><div class="ew-progress-heading"><strong>演练进度</strong><div class="ew-unit-counts"><span>总单元 <b class="num">${total}</b></span><span class="is-running">进行中 <b class="num">${running.length}</b></span><span class="is-done">已完成 <b class="num">${completed}</b></span><span class="is-error">异常 <b class="num">${errors}</b></span></div></div><div class="ew-progress" role="progressbar" aria-label="演练进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress*100)}">${UI.progressBar(progress,{showText:false})}<span class="num">${ended} / ${total}<b>${UI.pct(progress,0)}</b></span></div><div class="ew-current-units">当前执行单元：<span class="num">${active||'—'}</span></div></div>`;
}
const metricsHTML=t=>taskMetricCards(t,{leading:`<div data-ew-progress>${progressHTML(t)}</div>`});
const duration=value=>value==null?'—':`${value.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})} s`;
const tokens=value=>value==null?'—':value.toLocaleString('zh-CN',{maximumFractionDigits:0});

function unitPage(t,v){
  const units=allUnits(t),query=(v.query||'').trim().toLowerCase();
  const rows=units.map((unit,index)=>({unit,index})).filter(({unit})=>!query||`${agentQuestionTitle(unit)} ${unit.target||unit.goal||''} ${unit.method||''}`.toLowerCase().includes(query));
  if(v.tableFollow&&!v.selected&&t.status==='running'){
    const current=selectedUnit(t,v),index=rows.findIndex(row=>row.unit.id===current?.id);
    if(index>=0)v.page=Math.floor(index/UI.PAGE_SIZE)+1;
  }
  const count=Math.max(1,Math.ceil(rows.length/UI.PAGE_SIZE));v.page=Math.max(1,Math.min(v.page||1,count));
  return {rows:rows.slice((v.page-1)*UI.PAGE_SIZE,v.page*UI.PAGE_SIZE),page:v.page,count,total:rows.length};
}
function unitPagerHTML(t,v){
  const pg=unitPage(t,v),button=(label,page,disabled)=>`<button type="button" class="pg-btn" data-ew-page="${page}" aria-label="${label}" title="${label}" ${disabled?'disabled':''}>${label}</button>`;
  return `<div class="pager"><span class="muted text-support num">共 ${pg.total} 条 · 每页 ${UI.PAGE_SIZE} 条</span>${button('首页',1,pg.page===1)}${button('上一页',pg.page-1,pg.page===1)}<span class="num text-support">${pg.page} / ${pg.count}</span>${button('下一页',pg.page+1,pg.page===pg.count)}${button('末页',pg.count,pg.page===pg.count)}</div>`;
}
function rowsHTML(t,v){
  const chosen=selectedUnit(t,v);
  const isAgent=t.objectType==='agent';
  return unitPage(t,v).rows.map(({unit:u,index:i})=>{
    const info=u.roundInfo||roundInfo(t,u),result=verdict(u);
    const measured=unitTechnicalMetrics(t,u);
    const technical=`<td class="num ew-unit-duration" data-metric-source="${measured.durationSource}" title="${measured.durationSource==='demo'?'演示数据：按任务总量分配或补全':'已记录的单元耗时'}">${duration(measured.durationSeconds)}</td><td class="num ew-unit-tokens" data-metric-source="${measured.tokenSource}" title="${measured.tokenSource==='demo'?'演示数据：按任务总量分配或补全':'已记录的单元 Token 用量'}">${tokens(measured.totalTokens)}</td>`;
    if(isAgent){
      return `<tr data-unit="${UI.esc(u.id)}" class="${chosen?.id===u.id?'selected':''}"><td class="num">${String(i+1).padStart(2,'0')}</td><td><button class="link-btn ew-question-select" title="${UI.esc(agentQuestionTitle(u))}" data-select-unit="${UI.esc(u.id)}"><strong>${UI.esc(agentQuestionTitle(u))}</strong></button></td><td class="ew-unit-result"><span class="ew-verdict ${result}">${UI.esc(verdictNames[result])}</span></td>${technical}</tr>`;
    }
    const count=result==='breach'?(info.breachRound!=null?`<b class="ew-breach-round">${budget(info.breachRound)}</b>`:'—'):budget(info.completedRounds);
    const rounds=unitStatus(u)==='pending'?'—':`${count} / ${budget(info.maxRounds)}`;
    const question=u.target||u.goal||t.configSnapshot?.modelQuestionSnapshots?.[i%Math.max(1,t.bankCount||0)]?.prompt||'待加载题目';
    return `<tr data-unit="${UI.esc(u.id)}" class="${chosen?.id===u.id?'selected':''}"><td class="num">${String(i+1).padStart(2,'0')}</td><td><button class="link-btn ew-question-select" title="${UI.esc(question)}" data-select-unit="${UI.esc(u.id)}">${UI.esc(question)}</button></td><td><span class="ew-unit-method" title="${UI.esc(u.method||'—')}">${UI.esc(u.method||'—')}</span></td><td class="num" title="${result==='breach'?'攻破轮次':'已完成轮次'} / 轮数上限">${rounds}</td><td><span class="ew-verdict ${result}">${result==='running'&&info.currentRound?`第 ${info.currentRound} 轮` : verdictNames[result]}</span>${result==='running'?`<small>${UI.esc(stageNames[t.replay?.stage]||'执行中')}</small>`:''}</td>${technical}</tr>`;
  }).join('')||`<tr><td colspan="${isAgent?5:7}" class="empty-cell">${v.query?'没有匹配的执行单元':t.status==='ready'?'开始演练后显示攻防单元':'暂无攻防单元'}</td></tr>`;
}

function guardEvidence(g,position){
  const check=g?.[position];if(!check)return '';
  const blocked=g.action===(position==='input'?'block_input':'block_output');
  return evidence(`蓝队${position==='input'?'输入':'输出'}审核 · ${blocked?'已拦截':'已审核'}`,[check.labelCn||check.label,...(check.categories||[])].filter(Boolean).join(' · '),'guard');
}

function modelRoundHTML(t,h,info){
  const red=(h.prompt?evidence('攻击内容',h.prompt,'attack'):'')+(h.steps||[]).map(s=>evidence(s.label||'提示变换',s.prompt,'attack')).join('');
  const inputBlocked=h.guard?.action==='block_input',outputBlocked=h.guard?.action==='block_output';
  const targetResponse=outputBlocked?h.guard?.originalResponse:(h.guard?.originalResponse??h.response);
  const target=inputBlocked?'<div class="ew-blocked">输入已拦截，未调用靶标</div>':outputBlocked&&targetResponse==null?evidence('靶标响应','原始靶标响应未记录','target'):targetResponse!=null?evidence('靶标响应',targetResponse,'target'):'';
  const blue=guardEvidence(h.guard,'input')+target+guardEvidence(h.guard,'output')+((inputBlocked||outputBlocked)&&h.response?evidence('最终返回',h.response,'guard'):'');
  const hasBlue=!!h.guard||!!(t.configSnapshot?.guardId||t.guardId);
  const result=inputBlocked?'输入已拦截':outputBlocked?'输出已拦截':h.guard?.action==='pass'?'审核已放行':'等待审核记录';
  const body=hasBlue?`<div class="ew-duel" aria-label="本轮红蓝对抗"><section class="ew-duel-lane ew-duel-red" aria-label="红队攻击"><header><span class="ew-duel-role">红队</span><h5>攻击生成</h5></header><div class="ew-duel-content">${red||'<p class="ew-duel-pending">等待攻击内容</p>'}</div></section><section class="ew-duel-lane ew-duel-blue" aria-label="蓝队防护"><header><span class="ew-duel-role">蓝队</span><h5>防护与响应</h5><span class="ew-duel-outcome">${result}</span></header><div class="ew-duel-content">${blue||'<p class="ew-duel-pending">等待防护与靶标执行记录</p>'}</div></section></div>`:red+target;
  return `<article class="ew-round ${info.breachRound===h.round?'breached':''}"><h4>第 ${h.round} 轮 ${info.breachRound===h.round?'<span>已攻破</span>':''}</h4>${body}${h.judgeReason||h.judge?.reason?evidence('本轮判定',h.judgeReason||h.judge.reason,'judge'):''}</article>`;
}

function processHTML(t,u){
  if(!u)return '<div class="ew-empty">暂无攻防单元</div>';
  const status=unitStatus(u),info=u.roundInfo||roundInfo(t,u);
  const classification=classificationFields(u).length?'<div class="ew-process-summary" aria-label="任务分类快照">'+classificationFields(u).map(d=>'<span>'+UI.esc(d.name)+'：'+UI.esc(d.labels.join('、')||'未打标签')+'</span>').join('')+'</div>':'';
  if(t.objectType==='agent'){
    return classification+renderAgentQuestionFlow(t,u,allUnits(t).findIndex(row=>row.id===u.id));
  }
  const heading=`<div class="ew-process-summary">${verdict(u)==='breach'?`<b>攻破轮：${budget(info.breachRound)}</b>`:''}<span>${UI.esc(u.method||t.techniqueName||'业务场景')}</span><span>轮次 ${status==='pending'?'—':`${budget(info.completedRounds)} / ${budget(info.maxRounds)}`}</span></div>`;
  const target=classification+evidence(t.objectType==='agent'?'业务目标':'测试题目',u.target||u.goal);
  if(status==='pending')return heading+target+'<div class="ew-empty">待执行</div>';
  const rounds=(u.history||[]).map(h=>modelRoundHTML(t,h,info)).join('');
  return heading+target+rounds+(status==='done'?evidence('单元最终判定',u.judgeReason,'judge'):'')+(status==='stopped'?'<div class="ew-blocked">本单元未完成，未计入有效判定。</div>':'');
}

function logsHTML(t,type){
  const lines=t.executionMode==='replay'?store.taskEvents(t.id,type):(type==='agent'?store.agentLogLines(t.id):store.logLines(t.id));
  return lines.slice(-100).map(l=>`<div><time>${UI.esc(l.time||l.sourceTime||'')}</time><span>${UI.esc(l.text||'')}</span></div>`).join('')||'<div><span>配置已保存，等待启动演练。</span></div>';
}
export function taskWorkspacePage(cur,type='model'){
  const t=getTask(cur.param,type);if(!t)return UI.pageHead('任务详情')+'<div class="empty">任务不存在</div>';
  const v=viewOf(t.id),u=selectedUnit(t,v);
  return `<div class="ew-workspace ew-with-telemetry" data-workspace-task="${UI.esc(t.id)}" data-workspace-type="${type}">
    ${UI.backBtn()}${UI.pageHead(t.name,{extra:`<span data-ew-status>${UI.statusPill(t.status)}</span>`})}${configSummary(t,type)}
    <section class="ew-task-metrics" data-ew-metrics aria-label="任务指标">${metricsHTML(t)}</section>
    <section class="ew-execution" aria-label="任务执行记录">
      <header class="ew-execution-heading"><nav class="ew-tabs" role="tablist" aria-label="执行记录视图">
        <button id="ew-process-tab" type="button" role="tab" data-ew-tab="process" aria-controls="ew-process-pane" aria-selected="${v.tab==='process'}" tabindex="${v.tab==='process'?0:-1}">演练进程</button>
        <button id="ew-log-tab" type="button" role="tab" data-ew-tab="log" aria-controls="ew-log-pane" aria-selected="${v.tab==='log'}" tabindex="${v.tab==='log'?0:-1}">运行日志</button>
      </nav><div class="row-actions" data-ew-controls>${controlHTML(t,type)}</div></header>
      <section id="ew-process-pane" class="ew-process-pane" role="tabpanel" aria-labelledby="ew-process-tab" data-ew-pane="process" ${v.tab==='process'?'':'hidden'}>
        <div class="ew-process-toolbar"><div class="ew-follow-controls"><span class="muted" data-ew-process-state>${v.selected?'已锁定':'自动跟随'}</span><button class="link-btn" data-ew-follow ${v.selected||!v.follow?'':'hidden'}>跟随实时</button></div></div>
        <div class="ew-details-grid">
          <section class="ew-unit-panel" aria-label="${type==='agent'?'环境列表':'题目列表'}">${type==='agent'?`<label class="ew-question-search"><input type="search" data-ew-question-search placeholder="搜索环境" aria-label="搜索环境" value="${UI.esc(v.query||'')}"></label>`:''}<div class="ew-table-scroll" data-ew-table><table class="ew-table ew-unit-telemetry"><thead><tr>${type==='agent'?'<th>序号</th><th>环境</th><th>攻破结果</th>':'<th>序号</th><th>题目</th><th>方法</th><th title="已完成轮次 / 轮数上限">轮次</th><th>状态</th>'}<th>耗时</th><th>Token</th></tr></thead><tbody data-ew-rows>${rowsHTML(t,v)}</tbody></table></div><div class="ew-unit-pagination" data-ew-pager>${unitPagerHTML(t,v)}</div></section>
          <section class="ew-process-panel" aria-label="具体流程"><div class="ew-process-scroll" data-ew-process>${processHTML(t,u)}</div></section>
        </div>
      </section>
      <section id="ew-log-pane" class="ew-log-panel" role="tabpanel" aria-labelledby="ew-log-tab" data-ew-pane="log" ${v.tab==='log'?'':'hidden'}><div class="ew-log-scroll" data-ew-log>${logsHTML(t,type)}</div></section>
    </section>
  </div>`;
}

export function mountTaskWorkspace(host=document){
  const root=host.querySelector('[data-workspace-task]');if(!root)return ()=>{};
  const id=root.dataset.workspaceTask,type=root.dataset.workspaceType,v=viewOf(id),q=s=>root.querySelector(s);
  let disposed=false,autoScroll=false;
  const patch=(selector,html)=>{const el=q(selector);if(el&&el.innerHTML!==html)el.innerHTML=html;};
  function selectTab(tab,focus=false){
    v.tab=tab;
    root.querySelectorAll('[data-ew-tab]').forEach(button=>{const active=button.dataset.ewTab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(active&&focus)button.focus();});
    root.querySelectorAll('[data-ew-pane]').forEach(pane=>pane.hidden=pane.dataset.ewPane!==tab);
    if(tab==='log'){const logs=q('[data-ew-log]');logs.scrollTop=v.logFollow?logs.scrollHeight:v.logScroll;}
  }
  function update(){
    if(disposed||!root.isConnected)return;
    const t=getTask(id,type);if(!t)return;const u=selectedUnit(t,v);
    const process=q('[data-ew-process]'),list=q('[data-ew-table]'),logs=q('[data-ew-log]');
    const scroll={process:process.scrollTop,list:list.scrollTop};
    const expanded=[...root.querySelectorAll('[data-ew-metrics] details[open][data-metric-range]')].map(node=>node.dataset.metricRange);
    patch('[data-ew-status]',UI.statusPill(t.status));patch('[data-ew-controls]',controlHTML(t,type));
    patch('[data-ew-metrics]',metricsHTML(t));
    root.querySelectorAll('[data-ew-metrics] details[data-metric-range]').forEach(node=>node.open=expanded.includes(node.dataset.metricRange));
    patch('[data-ew-rows]',rowsHTML(t,v));patch('[data-ew-pager]',unitPagerHTML(t,v));patch('[data-ew-process]',processHTML(t,u));patch('[data-ew-log]',logsHTML(t,type));
    q('[data-ew-process-state]').textContent=v.selected?'已锁定':['done','stopped','error'].includes(t.status)?'历史证据':v.follow?'自动跟随':'暂停滚动';
    q('[data-ew-follow]').hidden=(!v.selected&&v.follow&&v.tableFollow)||t.status!=='running';
    autoScroll=true;
    process.scrollTop=v.follow&&!v.selected&&t.status==='running'&&v.tab==='process'?process.scrollHeight:scroll.process;
    list.scrollTop=scroll.list;
    if(v.tableFollow&&!v.selected&&t.status==='running'&&v.tab==='process'){
      const row=list.querySelector('tr.selected');if(row){const y=row.offsetTop;if(y<list.scrollTop||y+row.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=Math.max(0,y-list.clientHeight/3);}
    }
    if(v.tab==='log')logs.scrollTop=v.logFollow?logs.scrollHeight:v.logScroll;
    requestAnimationFrame(()=>autoScroll=false);
  }
  const unsubscribe=store.subscribeTasks(event=>{if(event.taskId===id)update();});
  function filterQuestions(){v.query=q('[data-ew-question-search]')?.value||'';v.page=1;v.tableFollow=false;update();q('[data-ew-table]').scrollTop=0;}
  const click=e=>{
    const page=e.target.closest('[data-ew-page]');if(page&&!page.disabled){v.page=Number(page.dataset.ewPage);v.tableFollow=false;update();q('[data-ew-table]').scrollTop=0;return;}
    const tab=e.target.closest('[data-ew-tab]');if(tab){selectTab(tab.dataset.ewTab);return;}
    const row=e.target.closest('[data-select-unit]');
    if(row){v.selected=row.dataset.selectUnit;v.follow=false;v.tableFollow=false;update();q('[data-ew-process]').scrollTop=0;}
    if(e.target.closest('[data-ew-follow]')){v.selected=null;v.follow=true;v.tableFollow=true;update();}
  };
  const keydown=e=>{if(!e.target.matches('[data-ew-tab]')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();selectTab(e.key==='Home'?'process':e.key==='End'?'log':v.tab==='process'?'log':'process',true);};
  const isLive=()=>getTask(id,type)?.status==='running';
  const pauseProcess=()=>{if(autoScroll||v.selected||!isLive())return;const el=q('[data-ew-process]');v.follow=el.scrollHeight-el.scrollTop-el.clientHeight<20;q('[data-ew-follow]').hidden=v.follow&&v.tableFollow;q('[data-ew-process-state]').textContent=v.follow?'自动跟随':'暂停滚动';};
  const pauseList=()=>{if(!isLive())return;v.tableFollow=false;q('[data-ew-follow]').hidden=false;};
  const logScroll=()=>{if(autoScroll||v.tab!=='log')return;const el=q('[data-ew-log]');v.logScroll=el.scrollTop;v.logFollow=el.scrollHeight-el.scrollTop-el.clientHeight<25;};
  root.addEventListener('click',click);root.addEventListener('keydown',keydown);q('[data-ew-question-search]')?.addEventListener('input',filterQuestions);q('[data-ew-process]').addEventListener('scroll',pauseProcess);q('[data-ew-table]').addEventListener('wheel',pauseList,{passive:true});q('[data-ew-table]').addEventListener('touchmove',pauseList,{passive:true});q('[data-ew-log]').addEventListener('scroll',logScroll);
  selectTab(v.tab);update();
  return ()=>{disposed=true;unsubscribe();root.removeEventListener('click',click);root.removeEventListener('keydown',keydown);q('[data-ew-question-search]')?.removeEventListener('input',filterQuestions);q('[data-ew-process]').removeEventListener('scroll',pauseProcess);q('[data-ew-table]').removeEventListener('wheel',pauseList);q('[data-ew-table]').removeEventListener('touchmove',pauseList);q('[data-ew-log]').removeEventListener('scroll',logScroll);};
}
