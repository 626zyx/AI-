import * as UI from '../core/ui.js';
import { taskMetricValues } from '../domain/metrics.js';
import { renderResultLevelBadge } from '../core/result-level-badge.js';

export function reportListResult(task,type='model') {
  if(!task)return '—';
  const metric=taskMetricValues(task).asr;
  const value=metric.value==null ? metric.applicable===false?'不适用':'未评估' : UI.pct(metric.value);
  const level=renderResultLevelBadge(type+'.asr',metric.value);
  return `<div class="report-list-result"><span class="num metric-asr">${value}</span>${level||'<span class="report-list-ungraded">未分级</span>'}</div>`;
}
