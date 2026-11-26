/* Read-only posture: switch between risk scenarios and resource distribution. */
import * as UI from '../core/ui.js';
import { welcomeUnifiedPosture } from '../domain/welcome-posture.js';

const pct = value => value == null ? '—' : UI.pct(value);
const num = value => Number(value || 0).toLocaleString('zh-CN');
const kindName = kind => kind === 'model' ? '模型' : '智能体';
const short = (value, max=12) => String(value).length > max ? `${String(value).slice(0,max-1)}…` : String(value);
const labelAliases = {'欺诈、虚假信息与恶意操纵':'欺诈与恶意操纵','网络攻击与系统滥用':'网络与系统滥用','隐私、数据与秘密泄露':'隐私与数据泄露','内部运营与治理信息':'内部运营信息泄露','安全弱点与防御信息':'安全防御信息','法律与合规信息':'法律合规信息','法律合规与调查材料':'法律合规材料','知识产权与未公开战略':'知识产权与战略','认证凭据与访问秘密':'凭据与访问秘密'};
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
    const emphasis = ['内部运营信息泄露', '软件工程'].includes(label) ? ' is-priority' : '';
    return `<div class="${dimension==='risk'?'wo-axis-label':'wo-business-label'}${emphasis} ${row.asr==null?'is-empty':''}" style="left:${x/width*100}%;top:${y/height*100}%" aria-label="${dimension==='risk'?'风险场景':'业务类型'}：${UI.esc(labelAliases[row.name] || row.name)}，ASR ${pct(row.asr)}" title="${UI.esc(row.name)} · ${row.breach||0}/${row.judged||0} 有效判定"><span>${UI.esc(label)}</span><b>${pct(row.asr)}</b></div>`;
  }).join('');
  return `<section class="wo-chart wo-radar-card" aria-label="业务类型与风险场景"><header><h3 title="两类标签独立汇总ASR，共用0–100%刻度。各取重点标签，未标注业务不归入任何业务类型。">业务类型与风险场景</h3><div class="wo-dimension-legend"><span class="risk">风险场景</span><span class="business">业务类型</span></div></header><div class="wo-radar-stage"><svg class="wo-radar" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="风险场景与业务类型并列分布，蓝色为风险场景，紫色为业务类型，两类通用标签独立汇总ASR，缺失值不补零">${[1,.8,.6,.4,.2].map((scale,index)=>`<path class="wo-radar-grid ring-${index}" d="${webPath(slots.map((_,slot)=>position(slot,scale)))}"/>`).join('')}${slots.map((_,slot)=>{const end=position(slot);return `<line class="wo-radar-spoke" x1="${cx}" y1="${cy}" x2="${end[0]}" y2="${end[1]}"/>`;}).join('')}${[.2,.4,.6,.8,1].map(scale=>`<text class="wo-radar-tick" x="${cx+6}" y="${cy-radius*scale+3}">${scale*100}%</text>`).join('')}${contour(risks,'risk','wo-radar-area')}${contour(business,'business','wo-business-area')}${risks.map((row,index)=>dot(row,index,'risk')).join('')}${business.map((row,index)=>dot(row,index,'business')).join('')}</svg>${labels(risks,'risk')}${labels(business,'business')}</div></section>`;
}

function methodChart(data) {
  const rows = data.rows.map(row => {
    const label = UI.esc(row.name);
    return `<div class="wo-bar-row ${row.kind}" title="${kindName(row.kind)} · ${label} · ${row.breach}/${row.judged}">
      <span class="wo-bar-name">${label}</span><strong>${pct(row.asr)}</strong>
      <span class="wo-bar-track"><i style="width:${100*(row.asr??0)}%"></i></span><small>${row.breach}/${row.judged}</small>
    </div>`;
  }).join('');
  return `<section class="wo-bars"><header><h3>攻击方法表现</h3></header>
    <div class="wo-bar-caption">ASR<span>攻破数 / 有效判定数</span></div>
    <div class="wo-bar-list" tabindex="0">${rows || '暂无演练结果'}</div></section>`;
}

function highlights(data) {
  const business = data.allBusinessSeries.find(row => row.name === '软件工程');
  const risk = data.allRiskSeries.find(row => row.name === '内部运营与治理信息');
  // Display examples only; these do not feed dashboard totals or chart series.
  const items = [
    ['business', '业务类型', '软件工程', business?.asr, business?.breach, business?.judged],
    ['risk', '风险场景', '内部运营信息泄露', risk?.asr, risk?.breach, risk?.judged],
    ['method', '模型攻击方法', 'PAIR', .50, 30, 60],
    ['attacker', 'Agent 攻击方法', '间接提示注入', .30, 3, 10],
  ];
  return `<aside class="wo-highlights" aria-label="优先关注"><header class="wo-priority-heading"><h3>优先关注</h3></header><div class="wo-priority-list">${items.map(([kind,title,name,asr,breach,judged])=>`<article class="wo-highlight ${kind}"><small>${title}</small><span>${name}</span><div><strong>${pct(asr)}</strong><em>${judged ? `${breach}/${judged}` : '—'}</em></div></article>`).join('')}</div></aside>`;
}
function summary(data) {
  const counts=data.counts;
  const items = [
    ['业务类型', counts.businessTypes, '种'], ['风险场景', counts.riskScenarios, '类'],
    ['已演练资源', counts.resources, '项'],
    ['方法与攻击者', counts.methods, '种']
  ];
  return `<div class="wo-summary"><div><span>整体平均 ASR</span><strong class="wb-danger">${pct(data.overallAsr)}</strong></div>${items.map(([name,value,unit])=>`<div><span>${name}</span><b>${num(value)}</b><span class="wo-count-unit">${unit}</span></div>`).join('')}</div>`;
}
export function unifiedPosture(dashboard) {
  const data=welcomeUnifiedPosture(dashboard,{mode:'methods'});
  return `<div class="wo-overview"><div class="wo-analysis">${summary(data)}<div class="wo-charts">${radar(data)}${methodChart(data)}</div></div>${highlights(data)}</div>`;
}
