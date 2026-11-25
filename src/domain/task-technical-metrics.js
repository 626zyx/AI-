import { taskTechnicalMetrics } from './recorded-technical-metrics.js';
import { taskUnitTechnicalMetrics } from './unit-technical-metrics.js';
export { taskTechnicalMetrics, parseModelTechnicalLogs } from './recorded-technical-metrics.js';

/* Product preview only: keep unavailable telemetry separate from archived evidence.
 * Deterministic estimates keep a task/report consistent without claiming real use. */
export function taskOperationalMetrics(task = {}, {recordedOnly=false}={}) {
  const recorded = taskTechnicalMetrics(task);
  const units = task.units || [];
  const expected = Math.max(Number(task.total) || 0, units.length);
  const executed = units.filter(unit => {
    if (unit.executionStatus) return unit.executionStatus === 'done';
    return recorded.kind === 'agent' ? ['safe', 'breach'].includes(unit.verdict) : typeof unit.judgeSuccess === 'boolean';
  }).length;
  if(recordedOnly)return {
    execution:{executed,expected,value:expected?executed/expected:0},
    timing:{totalSeconds:recorded.timing.totalSeconds,unitAverageSeconds:recorded.timing.knownUnits&&recorded.timing.totalSeconds!=null?recorded.timing.totalSeconds/recorded.timing.knownUnits:null,
      unitMinSeconds:recorded.timing.unitMinSeconds,unitMaxSeconds:recorded.timing.unitMaxSeconds,totalDemo:false,rangeDemo:false,note:recorded.timing.note||'未记录可核验耗时。'},
    tokens:{total:recorded.tokens.total,unitAverage:recorded.tokens.knownUnits&&recorded.tokens.total!=null?recorded.tokens.total/recorded.tokens.knownUnits:null,
      unitMin:recorded.tokens.unitMin,unitMax:recorded.tokens.unitMax,totalDemo:false,rangeDemo:false,note:recorded.tokens.note},
  };
  const metricTask=task.status==='done'&&!units.length&&!task.executionUnits?.length&&expected
    ?{...task,units:Array.from({length:expected},(_,index)=>({id:`unit-${index+1}`}))}:task;
  const rows=taskUnitTechnicalMetrics(metricTask);
  const summary=(key,sourceKey,rawTotal,precision)=>{
    const values=rows.filter(row=>row[key]!=null),simulated=values.some(row=>row[sourceKey]==='demo');
    const sum=values.length?Math.round(values.reduce((total,row)=>total+row[key],0)*precision)/precision:null;
    const total=recorded.kind==='model'&&rawTotal!=null?rawTotal:sum??rawTotal;
    return {total,average:values.length?total/values.length:null,min:values.length?Math.min(...values.map(row=>row[key])):null,max:values.length?Math.max(...values.map(row=>row[key])):null,
      totalDemo:simulated&&(rawTotal==null||Math.abs(total-rawTotal)>1/precision),rangeDemo:simulated};
  };
  const timing=summary('durationSeconds','durationSource',recorded.timing.totalSeconds,1000);
  const tokens=summary('totalTokens','tokenSource',recorded.tokens.total,1);
  return {
    execution: { executed, expected, value: expected ? executed / expected : 0 },
    timing: { totalSeconds:timing.total, unitAverageSeconds:timing.average,
      unitMinSeconds:timing.min, unitMaxSeconds:timing.max,totalDemo:timing.totalDemo,rangeDemo:timing.rangeDemo,
      note: timing.totalDemo ? '缺少的耗时记录使用演示数据补全，合计与明细一致。' : recorded.timing.note || '已记录运行耗时。' },
    tokens: { total:tokens.total,unitAverage:tokens.average,unitMin:tokens.min,unitMax:tokens.max,totalDemo:tokens.totalDemo,rangeDemo:tokens.rangeDemo,
      note: tokens.totalDemo ? '缺少的 Token 记录使用演示数据补全，合计与明细一致。' : recorded.tokens.note },
  };
}
