/* Read-only posture: switch between risk scenarios and resource distribution. */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import { welcomeUnifiedPosture } from '../domain/welcome-posture.js';

const state = { chart: 'radar', mode: 'resources' };
const pct = value => value == null ? '—' : UI.pct(value);
const num = value => Number(value || 0).toLocaleString('zh-CN');
const kindName = kind => kind === 'model' ? '模型' : '智能体';
const resourceName = kind => ({question:'题目',environment:'环境',method:'方法',attacker:'攻击者'}[kind] || '资源');
const short = (value, max=12) => String(value).length > max ? `${String(value).slice(0,max-1)}…` : String(value);
const refresh = () => router.nav('home','home',null,{replace:true});
const marker = kind => `<i class="wo-symbol ${kind}" aria-hidden="true"></i>`;
const postureLegend = () => `<div class="wo-legend"><span>${marker('model')}模型</span><span>${marker('agent')}智能体</span></div>`;
export const postureControls = () => `<div class="wo-view-switch" role="group" aria-label="演练态势视图">${[['radar','风险场景'],['quadrant','资源象限']].map(([key,name])=>`<button class="${state.chart===key?'active':''}" aria-pressed="${state.chart===key}" onclick="App.woChart('${key}')">${name}</button>`).join('')}</div>`;

const labelAliases = {'欺诈、虚假信息与恶意操纵':'欺诈与恶意操纵','网络攻击与系统滥用':'网络与系统滥用','隐私、数据与秘密泄露':'隐私与数据泄露','内部运营与治理信息':'内部运营信息','安全弱点与防御信息':'安全防御信息','法律与合规信息':'法律合规信息','法律合规与调查材料':'法律合规材料','知识产权与未公开战略':'知识产权与战略','认证凭据与访问秘密':'凭据与访问秘密'};
const axisName = axis => labelAliases[axis.name] || short(axis.name,10);
function radar(data) {
  const width=640, height=400, cx=320, cy=200, radius=150;
  const risks=Array.from({length:6},(_,index)=>data.riskSeries[index]||{id:`risk-missing-${index}`,name:'暂无风险场景',asr:null});
  const business=Array.from({length:4},(_,index)=>data.businessSeries[index]||{id:`business-missing-${index}`,name:'暂无业务类型',asr:null,kinds:[]});
  // Both classifications occupy peer spokes on the same percentage web.
  const slots=[['risk',0],['business',0],['risk',1],['business',1],['risk',2],['risk',3],['business',2],['risk',4],['business',3],['risk',5]];
  const position=(slot,scale=1)=>{const angle=(-90+slot*36)*Math.PI/180;return [cx+Math.cos(angle)*radius*scale,cy+Math.sin(angle)*radius*scale];};
  const pointFor=(dimension,index,scale)=>position(slots.findIndex(([type,i])=>type===dimension&&i===index),scale);
  const webPath=(points,curve=.91)=>points.map((point,index)=>{
    const next=points[(index+1)%points.length];
    const control=[cx+((point[0]+next[0])/2-cx)*curve,cy+((point[1]+next[1])/2-cy)*curve];
    return `${index?'':'M '+point.join(' ')} Q ${control.join(' ')} ${next.join(' ')}`;
  }).join(' ')+' Z';
  const contour=(rows,dimension,cls)=>{
    if(!rows.some(row=>row.asr!=null))return '';
    if(rows.every(row=>row.asr!=null))return `<path class="${cls}" d="${webPath(rows.map((row,index)=>pointFor(dimension,index,row.asr)),.96)}"/>`;
    return rows.map((row,index)=>{
      const next=rows[(index+1)%rows.length];if(row.asr==null||next.asr==null)return '';
      const from=pointFor(dimension,index,row.asr),to=pointFor(dimension,(index+1)%rows.length,next.asr);
      return `<path class="${cls} is-partial" d="M ${from.join(' ')} Q ${(from[0]+to[0])/2} ${(from[1]+to[1])/2} ${to.join(' ')}"/>`;
    }).join('');
  };
  const dot=(row,index,dimension)=>{
    if(row.asr==null)return '';
    const [x,y]=pointFor(dimension,index,row.asr),cls=dimension==='risk'?'wo-radar-dot':'wo-business-dot';
    return `<circle class="${cls}" cx="${x}" cy="${y}" r="4.2"/>`;
  };
  // Labels have their own evenly spaced positions; the percentage web stays circular.
  const labelPositions=[[320,20],[492,66],[558,145],[558,255],[492,334],[320,380],[148,334],[82,255],[82,145],[148,66]];
  const labels=(rows,dimension)=>rows.map((row,index)=>{
    const slot=slots.findIndex(([type,i])=>type===dimension&&i===index),[x,y]=labelPositions[slot];
    const label=dimension==='risk'?axisName(row):row.name;
    return `<div class="${dimension==='risk'?'wo-axis-label':'wo-business-label'} ${row.asr==null?'is-empty':''}" style="left:${x/width*100}%;top:${y/height*100}%" aria-label="${dimension==='risk'?'风险场景':'业务类型'}：${UI.esc(row.name)}，ASR ${pct(row.asr)}" title="${UI.esc(row.name)} · ${row.breach||0}/${row.judged||0} 有效判定"><span>${UI.esc(label)}</span><b>${pct(row.asr)}</b></div>`;
  }).join('');
  return `<section class="wo-chart wo-radar-card" aria-label="业务类型与风险场景"><header><h3 title="两类标签独立汇总ASR，共用0–100%刻度。各取重点标签，未标注业务不归入任何业务类型。">业务类型与风险场景</h3><div class="wo-dimension-legend"><span class="risk">风险场景</span><span class="business">业务类型</span></div></header><div class="wo-radar-stage"><svg class="wo-radar" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="风险场景与业务类型并列分布，蓝色为风险场景，紫色为业务类型，两类通用标签独立汇总ASR，缺失值不补零">${[1,.8,.6,.4,.2].map((scale,index)=>`<path class="wo-radar-grid ring-${index}" d="${webPath(slots.map((_,slot)=>position(slot,scale)))}"/>`).join('')}${slots.map((_,slot)=>{const end=position(slot);return `<line class="wo-radar-spoke" x1="${cx}" y1="${cy}" x2="${end[0]}" y2="${end[1]}"/>`;}).join('')}${[.2,.4,.6,.8,1].map(scale=>`<text class="wo-radar-tick" x="${cx+6}" y="${cy-radius*scale+3}">${scale*100}%</text>`).join('')}${contour(risks,'risk','wo-radar-area')}${contour(business,'business','wo-business-area')}${risks.map((row,index)=>dot(row,index,'risk')).join('')}${business.map((row,index)=>dot(row,index,'business')).join('')}</svg>${labels(risks,'risk')}${labels(business,'business')}</div></section>`;
}

function pointGroups(rows) {
  const grouped=new Map();
  for(const row of rows.filter(row=>row.judged>0&&row.asr!=null)){
    const key=`${row.kind}:${row.judged}:${row.asr}`;
    const group=grouped.get(key)||{kind:row.kind,judged:row.judged,asr:row.asr,rows:[]};
    group.rows.push(row);grouped.set(key,group);
  }
  return [...grouped.values()];
}
function quadrant(data) {
  const groups=pointGroups(data.rows),valid=data.rows.filter(row=>row.asr!=null&&row.judged>0);
  const max=Math.max(1,...valid.map(row=>row.judged));
  const step=10**Math.floor(Math.log10(max));
  const xMax=Math.ceil(max*1.15/step)*step;
  const xMean=valid.length?valid.reduce((s,r)=>s+r.judged,0)/valid.length:0;
  const yMean=valid.length?valid.reduce((s,r)=>s+r.asr,0)/valid.length:0;
  const unknown=data.rows.length-valid.length;
  const placements=new Map();
  for(const group of groups){
    const used=new Set([...placements].filter(([other])=>other.judged===group.judged&&Math.abs(other.asr-group.asr)<.14).map(([,offset])=>offset));
    placements.set(group,[0,20,-20,40,-40].find(offset=>!used.has(offset))??0);
  }
  return `<section class="wo-chart wo-quadrant-card" aria-label="资源关注象限"><header><div><h3>资源关注象限</h3></div>${postureLegend()}</header><div class="wo-resource-tabs" role="group" aria-label="象限资源类型">${[['resources','题目与环境'],['methods','方法与攻击者']].map(([key,name])=>`<button aria-pressed="${state.mode===key}" class="${state.mode===key?'active':''}" onclick="App.woMode('${key}')">${name}</button>`).join('')}</div><div class="wo-quadrant-stage"><span class="wo-y-title">资源 ASR</span><div class="wo-quad-body"><div class="wo-y-labels">${[100,75,50,25,0].map(tick=>`<span style="bottom:${tick}%">${tick}%</span>`).join('')}</div><div class="wo-quad-plot" role="group" aria-label="模型与智能体资源共同分布，横轴有效判定量，纵轴资源ASR">${valid.length?`<div class="wo-quad-area" style="left:${xMean/xMax*100}%;bottom:${yMean*100}%"></div><span class="wo-quad-region top-left">小样本关注</span><span class="wo-quad-region top-right">优先关注</span><span class="wo-quad-region bottom-left">待扩展验证</span><span class="wo-quad-region bottom-right">持续观察</span>${[0,25,50,75,100].map(tick=>`<i class="wo-grid h" style="bottom:${tick}%"></i><i class="wo-grid v" style="left:${tick}%"></i>`).join('')}<i class="wo-mean h" style="bottom:${yMean*100}%" title="资源 ASR 算术均值 ${pct(yMean)}"></i><i class="wo-mean v" style="left:${xMean/xMax*100}%" title="有效判定量算术均值 ${xMean.toFixed(1)}"></i>${groups.map((group,index)=>{const label=group.rows.length>1?`${group.rows.length} 个同坐标${resourceName(group.rows[0].resourceKind)}`:group.rows[0].name;const tooltip=`${kindName(group.kind)} · ${label} · ASR ${pct(group.asr)} · 每个资源有效判定 ${group.judged}`;const offset=placements.get(group);return `<span class="wo-point-anchor ${group.kind}" style="left:${group.judged/xMax*100}%;bottom:${group.asr*100}%">${offset?`<i class="wo-point-leader" style="left:${Math.min(0,offset)}px;width:${Math.abs(offset)}px"></i><i class="wo-exact-point"></i>`:''}<span class="wo-quad-point ${group.kind}" style="left:0;bottom:0;--offset:${offset}px" title="${UI.esc(tooltip)}" aria-label="${UI.esc(tooltip)}">${marker(group.kind)}${group.rows.length>1?`<b>${group.rows.length}</b>`:''}<span class="wo-point-tooltip">${UI.esc(label)}<strong>${pct(group.asr)} · ${group.judged} 次判定</strong></span></span></span>`;}).join('')}`:'<div class="wo-quad-empty">暂无有效判定<br><small>完成演练后展示资源分布</small></div>'}</div></div><div class="wo-x-labels">${[0,1,2,3,4].map(i=>`<span>${(xMax*i/4).toLocaleString('zh-CN',{maximumFractionDigits:1})}</span>`).join('')}</div><div class="wo-x-title">有效判定量 <span>每个资源</span></div></div><footer>${unknown?`${unknown} 个资源无有效判定 · `:''}虚线：资源均值 · 数字：资源数</footer></section>`;
}

function highlights(data) {
  // Presentation-only customer-service example, requested for the demo. It never
  // enters task totals, classification coverage, radar series or overall ASR.
  const customerExample={name:'客户服务',asr:.25,breach:5,judged:20,simulated:true};
  return `<div class="wo-highlights" aria-label="重点关注">${[['business','业务关注'],['risk','风险关注'],['method','攻击方法关注']].map(([kind,title])=>{
    const observed=data.highlights[kind],row=kind==='business'&&observed.asr==null?customerExample:observed,empty=row.asr==null;
    const note=empty?(kind==='business'&&row.units===0?'暂无演练':'暂无有效判定'):`${row.breach}/${row.judged} 判定${row.simulated?' · 模拟':''}`;
    return `<div class="wo-highlight ${kind}${empty?' is-empty':''}" title="${UI.esc(row.simulated?'客户服务模拟示例，不计入统计':row.sourceName||row.name)}"><small>${title}</small><span>${UI.esc(row.name)}</span><div><strong>${pct(row.asr)}</strong><em>${note}</em></div></div>`;
  }).join('')}</div>`;
}
function summary(data) {
  const counts=data.counts;
  const items=state.chart==='radar'
    ? [['业务类型',counts.businessTypes,''],['风险场景',counts.riskScenarios,'']]
    : [['已演练资源',counts.resources,`题目 ${counts.model} · 环境 ${counts.agent}`],['方法与攻击者',counts.methods,`模型 ${counts.modelMethods} · 智能体 ${counts.agentMethods}`]];
  const tip=state.chart==='radar'?'所选时间内实际完成演练涉及的分类；共享标签去重，未标注不计入。':'';
  return `<div class="wo-summary"><div><span title="模型和智能体的各次有效完成任务ASR等权平均">整体平均 ASR</span><strong class="wb-danger">${pct(data.overallAsr)}</strong></div>${items.map(([name,value,detail])=>`<div title="${tip}"><span>${name}</span><b>${num(value)}</b>${detail?`<small>${detail}</small>`:''}</div>`).join('')}</div>`;
}
export function unifiedPosture(dashboard) {
  const data=welcomeUnifiedPosture(dashboard,{mode:state.mode});
  return `<div class="wo-overview">${summary(data)}<div class="wo-charts">${state.chart==='radar'?radar(data):quadrant(data)}</div>${highlights(data)}</div>`;
}

export const postureActions={
  woChart(chart){if(!['radar','quadrant'].includes(chart)||state.chart===chart)return;state.chart=chart;refresh();},
  woMode(mode){if(!['resources','methods'].includes(mode)||state.mode===mode)return;state.mode=mode;refresh();},
};
