import * as UI from '../core/ui.js';
import * as store from '../domain/store.js';
import { recordedQuestionTiming } from '../domain/agent-recorded-performance.js';
import { injectionDeliveryText, surfaceResponseTag } from './agent-evidence.js';
import { getAgentQuestion } from '../domain/agent-environments.js';
import { taskMetricEvidence } from './task-metrics.js';
const e=UI.esc;
const names={'000023':'逾期事项跟进与管理摘要','000041':'采购审批链与负责人目录','000055':'Nexus 2.0 文档交付与分发','000150':'显微镜批次质量与纠正措施','000160':'多语言依赖升级与分阶段计划'};
const number=u=>String(u.sceneTaskId||'').replace('openart-mid-','');
export const agentQuestionTitle=u=>names[number(u)]||u.goal||u.sceneTaskId||'待执行环境';
export const agentDetailUnits=t=>t.executionUnits?.length?t.executionUnits:t.units?.length?t.units:(t.taskIdSnapshot||t.questionIds||t.configSnapshot?.questionIds||[]).map(id=>{const q=getAgentQuestion(id);return{id:`pending-${id}`,sceneTaskId:id,goal:q?.goal||q?.title||id,taskDescription:q?.files?.['task.md']||q?.goal||'',executionStatus:'pending'};});
const verdict=u=>({breach:['发现违规','red'],safe:['未发现违规','green'],error:['未判定','amber']})[u.verdict]||[u.executionStatus==='running'?'执行中':'待执行','gray'];
const text=(x,n=220)=>String(x||'').length>n?String(x).slice(0,n)+'…':String(x||'');
const button=(label,task,u,part)=>UI.linkBtn(label,{onclick:`App.agentDetailEvidence('${task.id}','${u.id}','${part}')`});
function step(role,heading,desc,actions='',state='done',extra=''){
  return `<section class="ad-stage ${state}"><span class="ad-dot"></span><div class="ad-role">${e(role)}</div><div class="ad-stage-body"><div class="ad-stage-title"><h3>${e(heading)}</h3>${actions}</div><p>${e(desc)}</p>${extra}</div></section>`;
}
export function renderAgentQuestionFlow(t,u,i=0){
  const completed=u.executionStatus==='done'||(!u.executionStatus&&u.verdict),started=u.executionStatus==='running'||completed;
  const hasAttack=t.technique!=='baseline',timing=recordedQuestionTiming(t,u),state=verdict(u);
  const attackReady=!!u.attack,outputs=u.originalOutputFiles||u.outputFiles||[];
  const evalText='历史离线语义复核';
  let stages=step('环境','准备环境任务、材料与工具',started?'当前环境任务与环境配置已载入。':'等待开始后准备当前环境环境。',button('查看环境任务',t,u,'task'),started?'done':'pending');
  if(hasAttack){
    stages+=step('攻击者',attackReady?'提出注入文件修改':'等待攻击生成',attackReady?text(u.attack.summary):'按本次选定的模板、模型和攻击范围生成候选文件。',attackReady?button('查看攻击内容',t,u,'attack'):'',attackReady?'done':'pending');
    stages+=step('平台','过滤并交付攻击文件',attackReady?injectionDeliveryText(u):'仅交付本次授权范围内的修改。',attackReady?button('查看交付记录',t,u,'delivery'):'',u.attack?.deliveryStatus==='complete'?'done':'pending',attackReady?`<div class="ad-paths">${(u.attack.surfaces||[]).map(s=>`<code>${e(s.path)}</code>`).join('')}</div>`:'');
  }
  stages+=step('靶标',outputs.length?'执行任务并形成产物':'执行本轮业务任务',outputs.length?`已形成 ${outputs.length} 项归档产物。${u.selfReport?text(u.selfReport):''}`:started?'等待已记录的靶标输出。':'等待环境准备完成。',outputs.length?button(`查看 ${outputs.length} 项产物`,t,u,'outputs'):'',outputs.length?'done':'pending',outputs.length?'<small class="ad-observation">完整工具与读取轨迹未记录。</small>':'');
  stages+=step('评估',completed?`${evalText}：${state[0]}`:'等待评估',completed?text(u.judgeRationale||u.judgeReason||u.reason):'本任务统一使用 LLM 评估。',completed?button('查看判据与证据',t,u,'judge'):'',completed?'done':'pending');
  stages+=step('结果',completed?`${state[0]} · 业务${({complete:'完成',partial:'部分完成',failed:'未完成'}[u.completionAssessment?.status]||'待评估')}`:'等待当前环境结果',completed?`${timing?`环境总耗时 ${timing.wall.toFixed(2)} 秒；靶标阶段 ${timing.target.toFixed(3)} 秒。`:'耗时未记录。'}Token 未记录。`:'结果在当前环境评估完成后展示。',completed?button('完整证据',t,u,'all'):'',completed?'done':'pending');
  return `<article class="ad-question" id="ad-question-${i}" data-ad-question="${i}"><header><div><span class="ad-number">${String(i+1).padStart(2,'0')}</span><h2>${e(agentQuestionTitle(u))}</h2></div>${UI.badge(...state)}</header><p class="ad-goal">${e(text(u.goal||u.taskDescription,180))}</p><div class="ad-stages">${stages}</div>${completed?taskMetricEvidence(u):''}</article>`;
}
export const actions={agentDetailEvidence(taskId,unitId,part){const t=store.getAgentTask(taskId),u=agentDetailUnits(t||{}).find(x=>x.id===unitId);if(!u)return;
  const block=(name,body)=>`<section class="ad-evidence-block"><h3>${e(name)}</h3>${body}</section>`;let body='';
  if(['all','task'].includes(part))body+=block('环境任务',`<pre class="v4-code">${e(u.taskDescription||u.goal)}</pre>${u.taskSteps?.length?`<ol>${u.taskSteps.map(x=>`<li>${e(x)}</li>`).join('')}</ol>`:''}`);
  if(['all','attack','delivery'].includes(part)&&u.attack)body+=block('攻击与交付',`<p>${e(u.attack.summary)}</p><p>${e(injectionDeliveryText(u))}</p>${(u.attack.surfaces||[]).map(s=>`<div class="ad-evidence-file"><code>${e(s.path)}</code><p>${e(s.intent)}</p>${part==='delivery'?'':surfaceResponseTag(s)+`<p>${e(s.reaction||'未记录靶标读取轨迹')}</p>`}</div>`).join('')}`);
  if(['all','outputs'].includes(part))body+=block('已归档产物',UI.table([{title:'文件路径',render:f=>`<code>${e(f.path||f.name)}</code>`},{title:'大小',width:'100px',render:f=>f.size==null?'未记录':`${f.size} B`}],u.originalOutputFiles||u.outputFiles||[]));
  if(part==='all')body+=taskMetricEvidence(u);
  if(['all','judge'].includes(part)){
    const source=t.executionSnapshot?.judgeProvenance||u.judgeProvenance||t.judgeProvenance||'历史归档结果';
    const evidence=u.reviewEvidence;
    body+=block('LLM 评估记录',`<p>${e(u.judgeRationale||u.judgeReason||u.reason||'尚未评估')}</p><p class="faint">${e(source)}</p>${evidence?`<pre class="v4-code">${e(typeof evidence==='string'?evidence:JSON.stringify(evidence,null,2))}</pre>`:''}`);
  }
  UI.drawer(agentQuestionTitle(u),body,UI.btn('关闭',{onclick:'UI.closeDrawer()'}));
}};
