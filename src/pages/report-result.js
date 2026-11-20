/* 报告结果摘要：模型与 Agent 共用判定计数，样式独立于任务工作区。 */
import * as UI from '../core/ui.js';
import { agentMetricLabel, agentMetricDefinition, isSemanticBaseline } from '../domain/metrics.js';

export function reportResultPanel(task) {
  const result = task.agg || { judged: 0, breach: 0, value: 0 };
  const ended = task.units?.length || 0;
  const total = task.total || 0;
  const metric = agentMetricLabel(task), shortMetric = agentMetricLabel(task, true);
  const semanticBaseline = isSemanticBaseline(task);
  const items = [
    { key: 'breach', label: semanticBaseline ? '确认泄露' : '攻破', value: result.breach },
    { key: 'safe', label: semanticBaseline ? '未确认泄露' : '未攻破', value: result.judged - result.breach },
    { key: 'error', label: '异常', value: Math.max(0, ended - result.judged) },
    { key: 'pending', label: '待完成', value: Math.max(0, total - ended) },
  ];
  return `<div class="rr-result">
    <p class="rr-note">${UI.esc(agentMetricDefinition(task))}</p>
    <div class="rr-result-summary">
      <div role="img" aria-label="${UI.esc(metric)}${result.judged ? UI.pct(result.value) : '待判定'}">${UI.ring(result.judged ? result.value : null, { size: 104, label: shortMetric, color: 'var(--vd-breach)', track: result.judged ? 'var(--vd-safe)' : 'var(--line)' })}</div>
      <div class="rr-result-distribution"><h4>${semanticBaseline ? '安全判定结果' : '攻击结果'}</h4><dl class="rr-result-counts">${items.map(item => `<div data-result-count="${item.key}"><dt><i class="${item.key}" aria-hidden="true"></i>${item.label}</dt><dd class="num">${item.value}</dd></div>`).join('')}</dl></div>
    </div>
    <div class="rr-result-progress" role="progressbar" aria-label="执行进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((task.progress || 0) * 100)}">
      <div><span>执行进度</span><span class="num">${ended} / ${total}</span></div>
      ${UI.progressBar(task.progress || 0, { showText: false })}
    </div>
  </div>`;
}
