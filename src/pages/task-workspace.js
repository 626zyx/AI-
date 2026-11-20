/* A mounted presenter, shared by both exercise types. Store events patch only
 * changing regions; the canvas, configuration overlay and scroll roots survive. */
import * as UI from '../core/ui.js';
import { icon } from '../core/icons.js';
import { configSummary } from '../core/task-config.js';
import * as store from '../domain/store.js';
import { roundInfo } from '../domain/task-rounds.js';
import { agentMetricLabel, agentMetricDefinition, isSemanticBaseline } from '../domain/metrics.js';
import { currentTaskContent } from './task-content.js';
import { agentTaskGoalHTML, injectionAssessmentHTML, agentAssessmentText } from './agent-evidence.js';

const views=new Map();
const getTask=(id,type)=>type==='agent'?store.getAgentTask(id):store.getTask(id);
const stageNames={preparing:'准备演练环境',ready:'红队、靶标与裁判就绪',attack:'红队生成攻击',input_guard:'蓝队输入审核',target:'靶标响应',output_guard:'蓝队输出审核',judge:'裁判评估',round_complete:'本轮结束',unit_complete:'单元结束',complete:'结果汇总完成'};
const stageRoles={attack:'src',input_guard:'input_guard',target:'tgt',output_guard:'output_guard',judge:'judge',unit_complete:'judge'};
const viewOf=id=>{if(!views.has(id))views.set(id,{selected:null,follow:true,tableFollow:true});return views.get(id);};
const allUnits=t=>t.executionUnits||t.units||[];
const executionConfig=t=>t.executionSnapshot||t;
const guardPositions=t=>{const c=executionConfig(t);return c.guardId?(c.guardStages||['输入','输出']):[];};
const unitStatus=u=>u.executionStatus||'done';
const verdict=u=>unitStatus(u)==='pending'?'pending':unitStatus(u)==='running'?'running':unitStatus(u)==='stopped'?'stopped':u.verdict||(u.judgeSuccess===true?'breach':u.judgeSuccess===false?'safe':'error');
const verdictNames={pending:'待执行',running:'执行中',stopped:'已终止',breach:'已攻破',safe:'未攻破',error:'异常'};
const budget=n=>n==null?'—':String(n);
const evidence=(label,text,role='')=>`<section class="ew-evidence ${role}"><h5>${UI.esc(label)}</h5><pre>${UI.esc(text||'—')}</pre></section>`;

function selectedUnit(t,v){const units=allUnits(t);return units.find(u=>u.id===v.selected)||units.find(u=>u.id===t.replay?.activeUnitId)||units.find(u=>unitStatus(u)==='running')||units[0];}
function controlHTML(t,type){
  if(t.status==='draft')return UI.btn('继续配置',{kind:'primary',onclick:`App.editTaskConfig('${t.id}','${type}')`});
  if(t.status==='ready')return UI.btn('开始演练',{kind:'primary',onclick:`App.taskStart('${t.id}','${type}')`});
  if(t.status==='running')return UI.btn('终止演练',{kind:'danger',onclick:`App.taskStop('${t.id}','${type}')`});
  return t.status==='done'?UI.btn('查看报告',{kind:'primary',onclick:`App.taskReport('${t.id}','${type}')`}):'';
}

function resultsHTML(t){
  const a=t.agg||{judged:0,breach:0,value:0},ended=t.units?.length||0,error=ended-a.judged;
  const shortMetric=agentMetricLabel(t,true),baseline=isSemanticBaseline(t);
  const definition=t.evaluationBasis==='semantic-output-review-v1'?agentMetricDefinition(t):'攻击成功率（ASR）= 攻破单元数 ÷ 有效判定单元数';
  return `<div class="ew-result-ring" role="img" aria-label="${UI.esc(agentMetricLabel(t))}${a.judged?UI.pct(a.value):'待判定'}" title="${UI.esc(definition)}">${UI.ring(a.judged?a.value:null,{size:84,label:shortMetric,color:'var(--vd-breach)',track:a.judged?'var(--vd-safe)':'var(--line)'})}</div>
    <div class="ew-result-counts"><span><i class="breach"></i>${baseline?'确认泄露':'攻破'} <b class="num">${a.breach}</b></span><span><i class="safe"></i>${baseline?'未确认泄露':'未攻破'} <b class="num">${a.judged-a.breach}</b></span><span><i class="error"></i>异常 <b class="num">${error}</b></span><span><i class="pending"></i>待完成 <b class="num">${Math.max(0,(t.total||0)-ended)}</b></span></div>`;
}
function contentHTML(t,u,v){
  const content=currentTaskContent(t,u,{selected:!!v.selected});
  return `<div class="ew-content-bubble ${content.role}"><strong>${UI.esc(content.label)}：</strong><p>${UI.esc(content.text)}</p></div>`;
}
function progressHTML(t){
  const ended=t.units?.length||0;
  const progress=t.total?Math.min(1,ended/t.total):0;
  return `<div class="ew-progress" role="progressbar" aria-label="演练进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress*100)}"><span>演练进度</span>${UI.progressBar(progress,{showText:false})}<span class="num">${ended} / ${t.total||0}<b>${UI.pct(progress,0)}</b></span></div>`;
}

function rowsHTML(t,v){
  const chosen=selectedUnit(t,v);
  const isAgent=t.objectType==='agent';
  return allUnits(t).map((u,i)=>{
    const info=u.roundInfo||roundInfo(t,u),result=verdict(u);
    const count=result==='breach'?(info.breachRound!=null?`<b class="ew-breach-round">${budget(info.breachRound)}</b>`:'—'):budget(info.completedRounds);
    const rounds=unitStatus(u)==='pending'?'—':`${count} / ${budget(info.maxRounds)}`;
    return `<tr data-unit="${UI.esc(u.id)}" class="${chosen?.id===u.id?'selected':''}"><td><button class="link-btn" data-select-unit="${UI.esc(u.id)}">${String(i+1).padStart(2,'0')}</button><span class="ew-method">${UI.esc(u.method||t.techniqueName||'—')}</span></td>${isAgent?'':`<td class="num" title="${result==='breach'?'攻破轮次':'已完成轮次'} / 轮数上限">${rounds}</td>`}<td><span class="ew-verdict ${result}">${!isAgent&&result==='running'&&info.currentRound?`第 ${info.currentRound} 轮` : verdictNames[result]}</span>${result==='running'?`<small>${UI.esc(stageNames[t.replay?.stage]||'执行中')}</small>`:''}</td></tr>`;
  }).join('')||`<tr><td colspan="${isAgent?2:3}" class="empty-cell">${t.status==='ready'?'开始演练后显示攻防单元':'暂无攻防单元'}</td></tr>`;
}

function guardEvidence(g,position){
  const check=g?.[position];if(!check)return '';
  const blocked=g.action===(position==='input'?'block_input':'block_output');
  return evidence(`蓝队${position==='input'?'输入':'输出'}审核 · ${blocked?'已拦截':'已审核'}`,[check.labelCn||check.label,...(check.categories||[])].filter(Boolean).join(' · '),'guard');
}

function processHTML(t,u){
  if(!u)return '<div class="ew-empty">暂无攻防单元</div>';
  const status=unitStatus(u),info=u.roundInfo||roundInfo(t,u);
  if(t.objectType==='agent'){
    const baseline=executionConfig(t).technique==='baseline';
    const result=verdict(u);
    const resultMark=['breach','safe'].includes(result)?`<span class="ew-verdict-mark ${result}">${icon(result==='breach'?'stError':'stDone',16)}${UI.verdictText({key:result,label:verdictNames[result]})}</span>`:`<span>${UI.esc(verdictNames[result])}</span>`;
    const heading=`<div class="ew-process-summary">${baseline?'':`<span>${UI.esc(t.techniqueName||'业务场景')}</span>`}${resultMark}</div>`;
    const goal=`<section class="ew-evidence"><h5>题目目标</h5>${agentTaskGoalHTML(u)}</section>`;
    if(status==='pending')return heading+goal+'<div class="ew-empty">待执行</div>';
    const attack=!baseline&&u.attack?.summary?(status==='done'?`<section class="ew-evidence attack"><h5>攻击配置与交付</h5>${injectionAssessmentHTML(u)}</section>`:evidence('攻击配置',agentAssessmentText(u.attack.summary),'attack')):'';
    const assessment=status==='done'?evidence('靶标完成度',agentAssessmentText(u.completion),'target')+evidence('抵御情况',agentAssessmentText(u.resistance),'target')+evidence('判定理由',agentAssessmentText(u.judgeRationale),'judge'):'';
    return heading+goal+attack+assessment;
  }
  const heading=`<div class="ew-process-summary">${verdict(u)==='breach'?`<b>攻破轮：${budget(info.breachRound)}</b>`:''}<span>${UI.esc(u.method||t.techniqueName||'业务场景')}</span><span>轮次 ${status==='pending'?'—':`${budget(info.completedRounds)} / ${budget(info.maxRounds)}`}</span></div>`;
  const target=evidence(t.objectType==='agent'?'业务目标':'测试题目',u.target||u.goal);
  if(status==='pending')return heading+target+'<div class="ew-empty">待执行</div>';
  const rounds=(u.history||[]).map(h=>`<article class="ew-round ${info.breachRound===h.round?'breached':''}"><h4>第 ${h.round} 轮 ${info.breachRound===h.round?'<span>已攻破</span>':''}</h4>${h.prompt?evidence('红队攻击',h.prompt,'attack'):''}${(h.steps||[]).map(s=>evidence(s.label||'提示变换',s.prompt,'attack')).join('')}${guardEvidence(h.guard,'input')}${h.guard?.action==='block_input'?'<div class="ew-blocked">输入被蓝队拦截，未进入靶标</div>':h.response||h.guard?.originalResponse?evidence('靶标响应',h.guard?.originalResponse||h.response,'target'):''}${guardEvidence(h.guard,'output')}${h.guard?.action==='block_output'&&h.response?evidence('最终返回',h.response,'guard'):''}${h.judgeReason||h.judge?.reason?evidence('本轮判定',h.judgeReason||h.judge.reason,'judge'):''}</article>`).join('');
  return heading+target+rounds+(status==='done'?evidence('单元最终判定',u.judgeReason,'judge'):'')+(status==='stopped'?'<div class="ew-blocked">本单元未完成，未计入有效判定。</div>':'');
}

function logsHTML(t,type){
  const lines=t.executionMode==='replay'?store.taskEvents(t.id,type):(type==='agent'?store.agentLogLines(t.id):store.logLines(t.id));
  return lines.slice(-100).map(l=>`<div><time>${UI.esc(l.time||l.sourceTime||'')}</time><span>${UI.esc(l.text||'')}</span></div>`).join('')||'<div><span>配置已保存，等待启动演练。</span></div>';
}
const fallbackHTML=t=>`<div class="ew-flow-fallback"><span>${icon('layers',24)}红队</span>${guardPositions(t).includes('输入')?`<i>→</i><span>${icon('shield',24)}蓝队 · 输入</span>`:''}<i>→</i><span>${icon('cpu',24)}靶标</span>${guardPositions(t).includes('输出')?`<i>→</i><span>${icon('shield',24)}蓝队 · 输出</span>`:''}<i>→</i><span>${icon('check',24)}裁判</span></div>`;

export function taskWorkspacePage(cur,type='model'){
  const t=getTask(cur.param,type);if(!t)return UI.pageHead('任务详情')+'<div class="empty">任务不存在</div>';
  const v=viewOf(t.id),u=selectedUnit(t,v);
  return `<div class="ew-workspace" data-workspace-task="${UI.esc(t.id)}" data-workspace-type="${type}">
    ${UI.backBtn()}${UI.pageHead(t.name,{extra:`<span data-ew-status>${UI.statusPill(t.status)}</span>`})}${configSummary(t,type)}
    <section class="ew-execution" aria-label="演练进程">
      <header class="ew-execution-heading"><h2>演练进程</h2><div class="row-actions" data-ew-controls>${controlHTML(t,type)}</div></header>
      <div class="ew-grid">
      <section class="ew-board" aria-label="核心进程">
        <div class="ew-canvas-progress" data-ew-progress>${progressHTML(t)}</div>
        <div class="ew-canvas-body">
          <div class="ew-canvas-overview"><div class="ew-content" data-ew-content aria-label="当前模块内容">${contentHTML(t,u,v)}</div><div class="ew-results" data-ew-results>${resultsHTML(t)}</div></div>
          <div class="ew-scene" data-ew-scene aria-label="攻防角色与阶段">${fallbackHTML(t)}</div>
        </div>
      </section>
      <section class="ew-details" aria-label="攻防明细">
        <header class="ew-heading"><h3>攻防明细</h3><div class="ew-follow-controls"><span class="muted" data-ew-process-state>${v.selected?'已锁定':'自动跟随'}</span><button class="link-btn" data-ew-follow ${v.selected||!v.follow?'':'hidden'}>跟随实时</button></div></header>
        <div class="ew-details-grid">
          <section class="ew-unit-panel" aria-label="攻防记录"><div class="ew-table-scroll" data-ew-table><table class="ew-table"><thead><tr><th>序号 / 方法</th>${type==='agent'?'':'<th title="已完成轮次 / 轮数上限">轮次</th>'}<th>状态</th></tr></thead><tbody data-ew-rows>${rowsHTML(t,v)}</tbody></table></div></section>
          <section class="ew-process-panel" aria-label="单元记录"><div class="ew-process-scroll" data-ew-process>${processHTML(t,u)}</div></section>
        </div>
      </section>
        <section class="ew-log-panel" aria-label="运行日志"><header class="ew-heading"><h3>运行日志</h3></header><div class="ew-log-scroll" data-ew-log>${logsHTML(t,type)}</div></section>
      </div>
    </section>
  </div>`;
}

export function mountTaskWorkspace(host=document){
  const root=host.querySelector('[data-workspace-task]');if(!root)return ()=>{};
  const id=root.dataset.workspaceTask,type=root.dataset.workspaceType,v=viewOf(id),q=s=>root.querySelector(s);
  let disposed=false,scene=null,sceneUnit=null,sceneEvent=null,autoScroll=false;
  const patch=(selector,html)=>{const el=q(selector);if(el.innerHTML!==html)el.innerHTML=html;};
  function fitContent(){
    const bubble=q('.ew-content-bubble'),heading=bubble.querySelector('strong'),body=bubble.querySelector('p');
    const style=getComputedStyle(bubble),textStyle=getComputedStyle(body);
    const available=bubble.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-heading.offsetHeight-parseFloat(getComputedStyle(heading).marginBottom);
    const lines=Math.max(1,Math.floor(available/(parseFloat(textStyle.lineHeight)||17)));
    q('[data-ew-content]').style.setProperty('--content-lines',String(lines));
  }
  const contentObserver=typeof ResizeObserver==='undefined'?null:new ResizeObserver(fitContent);
  contentObserver?.observe(q('[data-ew-content]'));
  function sceneUpdate(t,u){
    if(!scene)return;
    const key=`${u?.id||t.id}:${v.selected?'history':t.replay?.cursor??'snapshot'}`;if(key===sceneEvent)return;sceneEvent=key;
    if(type==='model'){
      const config=executionConfig(t);
      if(sceneUnit!==(u?.id||t.id)){scene.reset({target:config.targetName,guard:guardPositions(t)});sceneUnit=u?.id||t.id;}
      if(!u||['draft','ready'].includes(t.status))return;
      const phase=v.selected||t.status==='done'?'unit_complete':t.replay?.stage;
      const role=stageRoles[phase];if(role)scene.focus(role);
      if(!v.selected&&t.status==='running'){
        if(phase===(guardPositions(t).includes('输入')?'input_guard':'attack'))scene.attack(u.history?.at(-1)?.guard?.action==='block_input');
        if(phase==='target'&&!guardPositions(t).includes('输出'))scene.reply();
        if(phase==='output_guard')scene.reply(u.history?.at(-1)?.guard?.action==='block_output');
        if(phase==='unit_complete'&&['breach','safe'].includes(verdict(u)))scene.judge(verdict(u));
      }
    }else{
      const version=`${u?.id||t.id}:${u?.attack?.surfaces?.length||0}:${u?.outputFiles?.length||0}`;
      if(sceneUnit!==version){scene.load({target:t.targetName,technique:t.technique,injected:(u?.attack?.surfaces||[]).map(s=>s.path),outputs:(u?.outputFiles||[]).map(f=>f.path||f.name).filter(Boolean),steps:[],verdict:u?.verdict});sceneUnit=version;}
      if(!u||['draft','ready'].includes(t.status))return;
    }
  }
  function update(){
    if(disposed||!root.isConnected)return;
    const t=getTask(id,type);if(!t)return;const u=selectedUnit(t,v);
    const process=q('[data-ew-process]'),list=q('[data-ew-table]'),logs=q('[data-ew-log]');
    const scroll={process:process.scrollTop,list:list.scrollTop,logs:logs.scrollTop,logEnd:logs.scrollHeight-logs.scrollTop-logs.clientHeight<25};
    patch('[data-ew-status]',UI.statusPill(t.status));patch('[data-ew-controls]',controlHTML(t,type));patch('[data-ew-results]',resultsHTML(t));
    patch('[data-ew-rows]',rowsHTML(t,v));patch('[data-ew-process]',processHTML(t,u));patch('[data-ew-log]',logsHTML(t,type));patch('[data-ew-content]',contentHTML(t,u,v));
    patch('[data-ew-progress]',progressHTML(t));
    fitContent();
    q('[data-ew-process-state]').textContent=v.selected?'已锁定':['done','stopped','error'].includes(t.status)?'历史证据':v.follow?'自动跟随':'暂停滚动';
    q('[data-ew-follow]').hidden=(!v.selected&&v.follow&&v.tableFollow)||t.status!=='running';
    autoScroll=true;
    process.scrollTop=v.follow&&!v.selected&&t.status==='running'?process.scrollHeight:scroll.process;
    list.scrollTop=scroll.list;
    if(v.tableFollow&&!v.selected&&t.status==='running'){
      const row=list.querySelector('tr.selected');if(row){const y=row.offsetTop;if(y<list.scrollTop||y+row.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=Math.max(0,y-list.clientHeight/3);}
    }
    logs.scrollTop=scroll.logEnd?logs.scrollHeight:scroll.logs;
    requestAnimationFrame(()=>autoScroll=false);sceneUpdate(t,u);
  }
  const unsubscribe=store.subscribeTasks(event=>{if(event.taskId===id)update();});
  const click=e=>{
    const row=e.target.closest('[data-select-unit]');
    if(row){v.selected=row.dataset.selectUnit;v.follow=false;v.tableFollow=false;update();q('[data-ew-process]').scrollTop=0;}
    if(e.target.closest('[data-ew-follow]')){v.selected=null;v.follow=true;v.tableFollow=true;update();}
  };
  const isLive=()=>getTask(id,type)?.status==='running';
  const pauseProcess=()=>{if(autoScroll||v.selected||!isLive())return;const el=q('[data-ew-process]');v.follow=el.scrollHeight-el.scrollTop-el.clientHeight<20;q('[data-ew-follow]').hidden=v.follow&&v.tableFollow;q('[data-ew-process-state]').textContent=v.follow?'自动跟随':'暂停滚动';};
  const pauseList=()=>{if(!isLive())return;v.tableFollow=false;q('[data-ew-follow]').hidden=false;};
  root.addEventListener('click',click);q('[data-ew-process]').addEventListener('scroll',pauseProcess);q('[data-ew-table]').addEventListener('wheel',pauseList,{passive:true});q('[data-ew-table]').addEventListener('touchmove',pauseList,{passive:true});
  update();
  if(typeof WebGLRenderingContext!=='undefined'){
    import('../core/scene3d.js').then(mod=>{if(disposed||!root.isConnected)return;try{const options={appearance:'light',compact:true,autoRotate:false};scene=type==='agent'?mod.createAgentScene(q('[data-ew-scene]'),options):mod.createModelScene(q('[data-ew-scene]'),options);q('.ew-flow-fallback').hidden=true;update();}catch{q('.ew-flow-fallback').hidden=false;}}).catch(()=>{});
  }
  return ()=>{disposed=true;unsubscribe();contentObserver?.disconnect();scene?.dispose();root.removeEventListener('click',click);q('[data-ew-process]').removeEventListener('scroll',pauseProcess);q('[data-ew-table]').removeEventListener('wheel',pauseList);q('[data-ew-table]').removeEventListener('touchmove',pauseList);};
}
