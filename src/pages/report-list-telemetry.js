import * as UI from '../core/ui.js';
import { taskOperationalMetrics } from '../domain/task-technical-metrics.js';

const seconds=value=>value==null?'—':`${Number(value).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})} s`;
const tokens=value=>value==null?'—':Number(value).toLocaleString('zh-CN',{maximumFractionDigits:0});

/* Reuse the detail-page aggregates, including their recorded/demo provenance. */
export function reportListTelemetry(metrics,kind){
  if(!metrics)return '—';
  const duration=kind==='duration',metric=duration?metrics.timing:metrics.tokens,format=duration?seconds:tokens;
  const values=duration?[metric.totalSeconds,metric.unitAverageSeconds]:[metric.total,metric.unitAverage];
  const hasValues=values.some(value=>value!=null),source=!hasValues?'missing':metric.totalDemo?'demo':metric.rangeDemo?'mixed':'recorded';
  const text=values.map(format).join(' / ');
  const labelled=['总','平均'].map((label,index)=>`${label} ${format(values[index])}`).join('；');
  const provenance=metric.totalDemo?'含演示数据':metric.rangeDemo?'单元分布为演示数据':hasValues?'已记录数据':'未记录';
  const note=[labelled,provenance,metric.note,duration?'平均按攻防单元统计；最大、最小值可在报告详情查看，单元累计耗时不代表并发任务的实际等待时间。':'平均按攻防单元统计；最大、最小值可在报告详情查看。'].filter(Boolean).join('\n');
  return `<span class="report-list-telemetry" data-report-metric="${kind}" data-metric-source="${source}" aria-label="${UI.esc(labelled+'；'+provenance)}" title="${UI.esc(note)}">${UI.esc(text)}</span>`;
}

export function reportListTelemetryColumns(taskOf){
  const cache=new Map();
  const metricsFor=row=>{
    if(!cache.has(row.taskId)){
      const task=taskOf(row.taskId);cache.set(row.taskId,task?taskOperationalMetrics(task):null);
    }
    return cache.get(row.taskId);
  };
  return [
    {title:'总 / 平均耗时',width:'240px',render:row=>reportListTelemetry(metricsFor(row),'duration')},
    {title:'总 / 平均 Token 用量',width:'240px',render:row=>reportListTelemetry(metricsFor(row),'tokens')},
  ];
}
