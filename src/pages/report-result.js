/* Result strip is identical in task details and reports. */
import * as UI from '../core/ui.js';
import { taskMetricCards } from './task-metrics.js';
export function reportResultPanel(task) {
  const result = task.agg || { judged: 0, breach: 0 };
  const ended = task.units?.length || 0;
  return `<div class="rr-result">${taskMetricCards(task)}<div class="rr-result-caption"><span>有效判定 <b>${result.judged}</b> / ${task.total || ended}</span><span>攻破 <b>${result.breach}</b></span><span>守住 <b>${result.judged - result.breach}</b></span><span>执行异常 <b>${Math.max(0, ended - result.judged)}</b></span><span>${task.guardId ? '已启用防护 · 链路评估' : '未启用防护 · 资产本体评估'}</span></div></div>`;
}
