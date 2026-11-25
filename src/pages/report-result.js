/* 报告保留顶部指标，执行过程在任务详情中呈现。 */
import * as UI from '../core/ui.js';
import { agentMetricDefinition } from '../domain/metrics.js';
import { taskMetricCards } from './task-metrics.js';

export function reportResultPanel(task) {
  const definition = task.objectType === 'agent' ? agentMetricDefinition(task) : '攻击成功率（ASR）= 最终判定为攻破的单元数 ÷ 有效判定单元数。未判定与异常不计入分母。';
  return `<div class="rr-result"><p class="rr-note">${UI.esc(definition)}</p>${taskMetricCards(task)}</div>`;
}
