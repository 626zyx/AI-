/* Shared task and report presentation; arithmetic remains in domain metrics. */
import * as UI from '../core/ui.js';
import { renderResultLevelBadge } from '../core/result-level-badge.js';
import { renderTaskTechnicalMetrics, taskTechnicalMetricsMd } from './task-technical-metrics.js';
import { taskMetricValues, agentMetricDefinition } from '../domain/metrics.js';

const outcomeKeys = task => task.objectType === 'agent' || task.kind === 'agent'
  ? ['asr', 'suspectedAdoptionRate', 'completionRate'] : ['asr', 'maxMethodAsr', 'maxScenarioAsr'];
function metricNote(key, metric) {
  if (metric.applicable === false) return '本次未启用注入攻击';
  if (metric.value === null) return key === 'completionRate' ? '缺少任务完成判定' : '尚无有效判定';
  if (metric.name) return `${metric.numerator} / ${metric.denominator} · ${metric.name}`;
  if (key === 'suspectedAdoptionRate') return `${metric.numerator} / ${metric.denominator} 个环境 · 疑似`;
  if (key === 'completionRate') return `${metric.numerator} / ${metric.denominator} 个环境完成${metric.partial ? ` · ${metric.partial} 个部分完成` : ''}`;
  return `${metric.numerator} / ${metric.denominator} 个有效单元`;
}
export function taskOutcomeCards(task) {
  const agent = task.objectType === 'agent' || task.kind === 'agent';
  const values = taskMetricValues(task);
  return `<div class="task-metric-split ${agent ? 'is-agent' : 'is-model'}">${outcomeKeys(task).map((key, index) => {
    const metric = values[key], unknown = metric.value === null;
    const label = key === 'asr' ? '攻击成功率（ASR）' : metric.label;
    const definition = agent && key === 'asr' ? agentMetricDefinition(task) : metric.definition;
    const value = unknown ? metric.applicable === false ? '不适用' : '未评估' : UI.pct(metric.value);
    return `<article class="task-metric-card${index === 0 ? ' task-metric-primary' : ''}${unknown ? ' is-unknown' : ''}" data-task-metric="${key}" data-metric-value="${unknown ? '' : metric.value}" title="${UI.esc(definition)}">
      <div class="task-metric-label">${UI.esc(label)}<span aria-label="${UI.esc(definition)}">ⓘ</span></div>
      <div class="task-metric-value"><strong class="num">${value}</strong></div>
      <p title="${UI.esc(metricNote(key, metric))}">${UI.esc(metricNote(key, metric))}</p>
      ${renderResultLevelBadge(`${agent ? 'agent' : 'model'}.${key}`, metric.value)}
    </article>`;
  }).join('')}</div>`;
}
export function taskMetricCards(task) {
  return `<div class="task-metric-dashboard" aria-label="演练指标">${renderTaskTechnicalMetrics(task)}${taskOutcomeCards(task)}</div>`;
}
export function taskMetricsMd(task) {
  const values = taskMetricValues(task);
  return [...taskTechnicalMetricsMd(task), ...outcomeKeys(task).map(key => {
    const metric = values[key], value = metric.value == null ? metric.applicable === false ? '不适用' : '未评估' : UI.pct(metric.value);
    return `- ${key === 'asr' ? '攻击成功率（ASR）' : metric.label}：${value}（${metricNote(key, metric)}）`;
  })];
}

export function taskMetricEvidence(unit) {
  const evidence = unit.metricEvidence;
  if (!evidence) return '';
  const completion = { complete: '完整完成', partial: '部分完成', failed: '未完成' }[unit.completionAssessment?.status] || '未评估';
  const semantic=unit.semanticResponseAssessment;
  const response = semantic ? `${semantic.responded?'有明确回应':'未见明确回应'} · ${{partial:'疑似部分采纳',rejected:'拒绝',unknown:'采纳情况未知'}[semantic.adoption]||'未评估'}（输出语义复核）` : ({ adopted: '采纳', partial: '部分采纳', rejected: '拒绝' }[unit.responseAssessment?.status] || '未评估');
  return `<details class="ew-metric-evidence"><summary>查看指标判定依据</summary><div>
    ${evidence.source ? `<p class="muted">${UI.esc(evidence.source)}</p>` : ''}
    <h5>环境验收条件</h5><ol>${(evidence.requirements || []).map(item => `<li>${UI.esc(item)}</li>`).join('')}</ol>
    <h5>交付内容核对</h5><p>${UI.esc(evidence.output)}</p>
    <dl><div><dt>完成判定</dt><dd>${completion}</dd></div><div><dt>注入响应</dt><dd>${response}</dd></div><div><dt>${unit.errorsAssessment?.scope==='business-delivery'?'业务交付检查':'失误检查'}</dt><dd>${unit.errorsAssessment?.assessed ? `已检查 · ${(unit.errorsAssessment.findings || unit.errors || []).length} 项问题` : '未评估'}</dd></div></dl>
    ${unit.businessAssessment?.criteria?`<div class="tm-criteria">${unit.businessAssessment.criteria.map(c=>`<p><b>${{pass:'通过',fail:'未通过',unknown:'未全面检查'}[c.status]}</b> · ${UI.esc(c.label)}<small>${UI.esc(c.detail)}</small></p>`).join('')}</div>`:''}
    ${semantic?`<p>${UI.esc(semantic.rationale)}</p>`:''}
    ${[...(evidence.evidenceRefs || []),...(semantic?.evidenceRefs||[])].map(ref => `<p class="ew-metric-ref">${ref.path?.startsWith('docs/') && !ref.path.includes('..') ? `<a href="./${UI.esc(ref.path)}" target="_blank" rel="noopener">查看案例材料</a>` : ''}<span>${UI.esc(ref.summary || '')}</span><code>${UI.esc(ref.path||'')}${ref.line?':'+ref.line:''}</code></p>`).join('')}
  </div></details>`;
}
