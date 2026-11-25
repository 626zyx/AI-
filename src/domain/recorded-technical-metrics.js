/* Technical measurements come from archived telemetry, never replay clocks or limits. */
import { logs as modelLogs } from '../data/logs.js';
import { recordedPerformance } from './agent-recorded-performance.js';

const cache=new Map();
const usagePattern=/\[TOKEN USAGE\] Model: (.*?) \| Input: (\d+) \| Output: (\d+) \| Total: (\d+)/;
const timePattern=/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}),(\d{3})/;
const emptyTokens=()=>({total:null,input:null,output:null,calls:0,minInput:null,maxInput:null,minOutput:null,maxOutput:null,minTotal:null,maxTotal:null,unitMin:null,unitMax:null,knownUnits:null,complete:false});
const emptyTiming=totalUnits=>({totalSeconds:null,totalLabel:'任务耗时',unitMinSeconds:null,unitMaxSeconds:null,minUnit:null,maxUnit:null,knownUnits:0,totalUnits,methodSeconds:null,methodCount:0,source:''});
function timestamp(line){const m=String(line).match(timePattern);return m?Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6],+m[7]):null;}

export function parseModelTechnicalLogs(groups=[]){
  const calls=[],times=[],methodDurations=[];
  for(const group of groups){
    const localTimes=[];
    for(const line of group.lines||[]){
      const at=timestamp(line);if(at!==null){times.push(at);localTimes.push(at);}
      const usage=String(line).match(usagePattern);
      if(usage)calls.push({model:usage[1],input:+usage[2],output:+usage[3],total:+usage[4]});
    }
    if(localTimes.length>1)methodDurations.push((Math.max(...localTimes)-Math.min(...localTimes))/1000);
  }
  const tokens=emptyTokens();
  if(calls.length){
    Object.assign(tokens,{total:calls.reduce((sum,row)=>sum+row.total,0),input:calls.reduce((sum,row)=>sum+row.input,0),output:calls.reduce((sum,row)=>sum+row.output,0),calls:calls.length});
    for(const key of ['Input','Output','Total']){const values=calls.map(row=>row[key.toLowerCase()]);tokens[`min${key}`]=Math.min(...values);tokens[`max${key}`]=Math.max(...values);}
  }
  return {tokens,spanSeconds:times.length>1?(Math.max(...times)-Math.min(...times))/1000:null,
    methodSeconds:methodDurations.length?methodDurations.reduce((sum,value)=>sum+value,0):null,methodCount:methodDurations.length};
}

export function taskTechnicalMetrics(task){
  const totalUnits=task.total||0,timing=emptyTiming(totalUnits),tokens=emptyTokens();
  if(task.objectType==='agent'){
    const perf=recordedPerformance(task);
    Object.assign(timing,{totalSeconds:perf.sum,totalLabel:'题目耗时累计',unitMinSeconds:perf.min?.wall??null,unitMaxSeconds:perf.max?.wall??null,
      minUnit:perf.min?.question??null,maxUnit:perf.max?.question??null,knownUnits:perf.known,
      source:perf.known?'原运行 wall_seconds · 最终保留尝试':'',note:'累计各题耗时，包含准备、攻击、靶标与评估；并发题目之和不等于任务墙钟时长。'});
    return {kind:'agent',timing,tokens:{...tokens,note:'原运行未保留可核验的 Token 用量。'},coverage:`耗时 ${perf.known} / ${totalUnits} 题；Token 未记录`};
  }
  const sourceId=task.sourceTaskId||task.id,groups=modelLogs[sourceId];
  // Model requests interleave and have no unit ID: a partial replay cannot expose a full archive aggregate.
  if(task.status!=='done'||!groups?.length)return {kind:'model',timing,tokens:{...tokens,note:'未取得当前范围的调用用量。'},coverage:task.status==='done'?'无可核验遥测':'归档技术统计在任务完成后展示'};
  if(!cache.has(sourceId))cache.set(sourceId,parseModelTechnicalLogs(groups));
  const measured=cache.get(sourceId);
  Object.assign(timing,{totalSeconds:measured.spanSeconds,totalLabel:'归档日志跨度',methodSeconds:measured.methodSeconds,methodCount:measured.methodCount,
    source:'原运行 eval_log 日志时间戳',note:'最早日志至最晚日志的时间跨度，包含方法之间的间隔；没有题级开始和结束时间。'});
  return {kind:'model',timing,tokens:{...measured.tokens,source:'原运行 [TOKEN USAGE] Input / Output / Total',
    note:'仅累计日志中有用量的调用，不能保证覆盖全部角色；调用未关联题目，无法计算每题 Token。'},
    coverage:`日志 ${measured.methodCount} / ${groups.length} 个方法；Token 已记录 ${measured.tokens.calls} 次调用，题级覆盖未记录`};
}
