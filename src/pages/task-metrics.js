/* Shared compact metric strip for task details, reports and exports. */
import * as UI from '../core/ui.js';
import { taskMetricValues, taskMetricGrade } from '../domain/metrics.js';

const agentTask = task => task.objectType === 'agent' || task.kind === 'agent';
const duration = value => value == null ? '—' : value < 60 ? `${Math.round(value)}s` : value < 3600 ? `${(value / 60).toFixed(1)}m` : `${(value / 3600).toFixed(1)}h`;
const tokens = value => value == null ? '—' : value >= 1000000 ? `${(value / 1000000).toFixed(2)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value));

export function metricGrade(task, key, metric) {
  return taskMetricGrade(task, key, metric);
}
export function metricRuleBadge(task, key, metric) {
  if (metric.value == null || metric.applicable === false) return '';
  const grade = metricGrade(task, key, metric);
  if (!grade.ruleId) return '';
  return `<span class="metric-grade grade-${UI.esc(grade.key)}" title="${UI.esc(`${grade.ruleName || '数据等级规则'} · ${grade.condition || ''}`)}">${UI.esc(grade.label)}</span>`;
}
function metricNote(key, metric) {
  if (metric.applicable === false) return '未启用注入';
  if (metric.value != null) {
    if (metric.name) return `${metric.name}${metric.ties?.length > 1 ? ` · 并列 ${metric.ties.length} 项` : ''}`;
    if (key === 'completionRate') return `安全完成 ${metric.safeCompleted} · 不安全完成 ${metric.unsafeCompleted}`;
    if (key === 'responseRate') return '拒绝、隔离与采纳均计响应';
    return `${metric.numerator} / ${metric.denominator} ${key === 'executionRate' ? '已结束' : '有效判定'}${metric.unknown ? ` · ${metric.unknown} 未评估` : ''}`;
  }
  if (key === 'completionRate') return '缺少完整业务验收判定';
  if (key === 'responseRate' && metric.inferred) return `${metric.inferred} 题仅有疑似响应`;
  if (key === 'errorRate') return '缺少失误检查覆盖';
  return '暂无有效数据';
}
function rateCard(task, key, metric) {
  const top = key.startsWith('max');
  const title = top ? key === 'maxMethodAsr' ? '攻击方法 TOP 1' : '场景 TOP 1' : key === 'asr' ? '攻破率 ASR' : metric.label;
  const empty = metric.value == null;
  const grade = key === 'asr' && !empty ? metricGrade(task, key, metric) : null;
  return `<article class="task-metric-card ${key === 'asr' ? 'metric-primary' : ''}${empty ? ' is-unknown' : ''}" data-task-metric="${key}" data-metric-value="${empty ? '' : metric.value}" title="${UI.esc(metric.definition)}">
    <div class="task-metric-label"><span>${title}</span>${metricRuleBadge(task, key, metric)}</div>
    <div class="task-metric-value"><strong class="num">${empty ? metric.applicable === false ? '不适用' : '未评估' : UI.pct(metric.value)}</strong>${key === 'asr' ? `<i class="metric-mini-ring grade-${grade?.key || 'unknown'}" style="--metric-fill:${empty ? 0 : metric.value * 100}%" aria-hidden="true"></i>` : ''}</div>
    <p title="${UI.esc(metricNote(key, metric))}">${UI.esc(metricNote(key, metric))}</p>
  </article>`;
}
function usageCard(key, metric) {
  const time = key === 'duration', format = time ? duration : tokens;
  return `<article class="task-metric-card metric-usage" data-task-metric="${key}" title="${time ? '总耗时为任务经过时间；平均耗时为已完成单元耗时均值' : '所有演练角色调用的 Token 合计；平均值按已完成单元计算'}"><div class="task-metric-label">${time ? '耗时' : 'Token 消耗'}</div><div class="task-metric-value"><strong class="num">${format(metric.total)}</strong><span>总计</span></div><p>平均 <b class="num">${format(metric.average)}</b> / 单元</p></article>`;
}
export function taskMetricCards(task) {
  const agent = agentTask(task), values = taskMetricValues(task);
  const basic = agent ? ['executionRate', 'duration', 'tokens'] : ['asr', 'executionRate', 'duration', 'tokens'];
  const result = agent ? ['asr', 'completionRate', 'responseRate', 'errorRate'] : ['maxMethodAsr', 'maxScenarioAsr'];
  const render = key => ['duration', 'tokens'].includes(key) ? usageCard(key, values[key]) : rateCard(task, key, values[key]);
  return `<div class="task-metric-cards metric-strip ${agent ? 'is-agent' : 'is-model'}" aria-label="演练指标"><div class="metric-strip-group metric-basic" aria-label="基础数据">${basic.map(render).join('')}</div><div class="metric-strip-group metric-outcomes" aria-label="结果表现">${result.map(render).join('')}</div></div>`;
}
export function taskMetricMarkdown(task) {
  const values = taskMetricValues(task);
  const keys = agentTask(task) ? ['asr', 'executionRate', 'completionRate', 'responseRate', 'errorRate'] : ['asr', 'executionRate', 'maxMethodAsr', 'maxScenarioAsr'];
  return [...keys.map(key => { const m = values[key]; return `- ${key === 'asr' ? '攻破率 ASR' : m.label}：${m.value == null ? m.applicable === false ? '不适用' : '未评估' : UI.pct(m.value)}（${metricNote(key, m)}）`; }), `- 耗时：总计 ${duration(values.duration.total)}；平均 ${duration(values.duration.average)} / 单元`, `- Token：总计 ${tokens(values.tokens.total)}；平均 ${tokens(values.tokens.average)} / 单元`];
}
/* Kept as a compatibility export; evidence is available in the task record. */
export const taskMetricEvidence = () => '';
