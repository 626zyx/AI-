import { recordedQuestionTiming } from './agent-recorded-performance.js';
import { taskTechnicalMetrics } from './recorded-technical-metrics.js';

const measured=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const first=(...values)=>values.map(measured).find(value=>value!==null)??null;

const hash=value=>[...String(value)].reduce((result,char)=>(result*31+char.charCodeAt(0))>>>0,17);
const sourceUnits=task=>task.executionUnits?.length?task.executionUnits:task.units||[];
const finished=(task,unit)=>unit.executionStatus?['done','error'].includes(unit.executionStatus):task.status==='done'||(task.units||[]).includes(unit);
const sources=metrics=>({...metrics,durationSource:metrics.durationSeconds==null?'missing':'recorded',tokenSource:metrics.totalTokens==null?'missing':'recorded'});

function recordedUnitMetrics(task,unit) {
  if(unit.executionStatus&&unit.executionStatus!=='done'&&unit.executionStatus!=='error')return sources({durationSeconds:null,totalTokens:null});
  const milliseconds=first(unit.durationMs,unit.duration_ms,unit.telemetry?.durationMs);
  const timing=task.objectType==='agent'?recordedQuestionTiming(task,unit):null;
  const durationSeconds=first(unit.durationSeconds,unit.duration_seconds,unit.wallSeconds,unit.wall_seconds,unit.timing?.wall_seconds,unit.timing?.wallSeconds,unit.telemetry?.durationSeconds,milliseconds===null?null:milliseconds/1000,timing?.wall);
  const totalTokens=first(unit.totalTokens,unit.total_tokens,unit.tokenUsage?.totalTokens,unit.tokenUsage?.total_tokens,unit.usage?.total_tokens,unit.usage?.totalTokens,unit.telemetry?.totalTokens);
  return sources({durationSeconds,totalTokens});
}

/** Completed-unit preview values are deterministic. Allocated totals remain labelled demo. */
export function taskUnitTechnicalMetrics(task={}, {recordedOnly=false}={}) {
  const units=sourceUnits(task),raw=taskTechnicalMetrics(task);
  const rows=units.map((unit,index)=>({unit,index,...recordedUnitMetrics(task,unit)}));
  if(recordedOnly)return rows;
  const completed=rows.filter(row=>finished(task,row.unit));
  const taskKey=task.sourceTaskId||task.id||task.name||'demo';
  const rowSeed=row=>hash(`${taskKey}:${row.unit.id||row.unit.sceneTaskId||row.index}`);
  for(const [key,sourceKey,total,scale] of [
    ['durationSeconds','durationSource',raw.kind==='model'||raw.timing.knownUnits>=completed.length?raw.timing.totalSeconds:null,100],
    ['totalTokens','tokenSource',raw.tokens.total,1],
  ]){
    const missing=completed.filter(row=>row[key]==null);
    if(!missing.length)continue;
    const known=completed.reduce((sum,row)=>sum+(row[key]??0),0);
    if(total!=null&&total>=known){
      const remainder=Math.floor((total-known)*scale),weights=missing.map(row=>65+rowSeed(row)%71),weightSum=weights.reduce((sum,value)=>sum+value,0);
      let allocated=0;
      missing.forEach((row,index)=>{
        const amount=Math.floor(remainder*weights[index]/weightSum);
        row[key]=index===missing.length-1?Math.round((total-known-allocated/scale)*1000)/1000:amount/scale;
        row[sourceKey]='demo';allocated+=amount;
      });
    }else{
      for(const row of missing){
        const seed=rowSeed(row),agent=raw.kind==='agent';
        row[key]=key==='durationSeconds'?(agent?280+seed%400:18+seed%48)+(seed%100)/100:(agent?18000+seed%12000:2400+seed%3000);
        row[sourceKey]='demo';
      }
    }
  }
  return rows;
}

export function unitTechnicalMetrics(task={},unit={},options={}) {
  if(unit.executionStatus&&!['done','error'].includes(unit.executionStatus))return recordedUnitMetrics(task,unit);
  const rows=taskUnitTechnicalMetrics(task,options);
  const row=rows.find(row=>row.unit===unit)||rows.find(row=>unit.id&&row.unit.id===unit.id);
  if(row){const {unit:ignored,index,...metrics}=row;return metrics;}
  if(finished(task,unit)){
    const [fallback]=taskUnitTechnicalMetrics({...task,executionUnits:[],units:[unit]},options);
    const {unit:ignored,index,...metrics}=fallback;return metrics;
  }
  return recordedUnitMetrics(task,unit);
}
