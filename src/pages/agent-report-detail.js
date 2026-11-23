/* Agent report details and exports share the same assessed unit evidence. */
import * as UI from '../core/ui.js';
import { field, text, mod, fold } from '../core/detail.js';
import { agentPerformance } from '../domain/agent-performance.js';
import { reportQuestionCell } from './report-format.js';
import { agentTaskGoalHTML, agentTaskGoalMd, injectionAssessmentHTML, injectionAssessmentMd, surfaceResponseLabel, highlySuspectedSurface, agentAssessmentText } from './agent-evidence.js';

export const agentQuestionNumber = unit => String(unit.sceneTaskId || unit.id).replace(/^openart-mid-/, '');
const verdict = unit => ({ safe: ['守住', 'green'], breach: ['已攻破', 'red'], error: ['执行异常', 'orange'] }[unit.verdict] || ['未评估', 'gray']);
const unitOutcomes = (task, unit) => {
  const performance = agentPerformance({ ...task, units: [unit] });
  return Object.fromEntries(['completion', 'resistance'].map(key => [key, performance[key].distribution.find(row => row.count)?.label || '未评估']));
};
const errorsOf = unit => [...new Set((unit.errors || []).map(error => error.type).filter(Boolean))];
const responseLabels = unit => [...new Set((unit.attack?.surfaces || []).map(surfaceResponseLabel))];
const filesText = unit => (unit.outputFiles || []).map(file => `${file.path || file.name || '—'}${Number.isFinite(file.size) ? ` · ${file.size.toLocaleString()} B` : ''}`).join('\n');

export function agentDetailTable(task) {
  const rows = task.units.map(unit => ({ ...unit, outcomes: unitOutcomes(task, unit) }));
  return `<section class="agent-report-details" aria-label="攻防明细">${UI.table([
    { title: '题目', width: '76px', render: unit => `<span class="num">${UI.esc(agentQuestionNumber(unit))}</span>` },
    { title: '题目目标', render: unit => reportQuestionCell(unit.goal || unit.taskDescription || '—') },
    { title: '攻破判定', width: '88px', render: unit => UI.badge(...verdict(unit)) },
    { title: '任务完成', width: '116px', render: unit => UI.esc(unit.outcomes.completion) },
    { title: '抵御情况', width: '126px', render: unit => UI.esc(unit.outcomes.resistance) },
    { title: '注入响应', width: '144px', render: unit => {
      const labels = responseLabels(unit);
      const high = unit.attack?.surfaces?.some(highlySuspectedSurface);
      return labels.length ? `<span class="${high ? 'agent-suspected-badge' : 'muted'}" title="${UI.esc(labels.join(' · '))}">${high ? '高度疑似响应' : UI.esc(labels.join(' · '))}</span>` : '<span class="muted">—</span>';
    } },
    { title: '失误', width: '100px', render: unit => errorsOf(unit).length ? `<span class="agent-detail-error" title="${UI.esc(errorsOf(unit).join(' · '))}">${errorsOf(unit).length} 类失误</span>` : '<span class="muted">—</span>' },
    { title: '操作', width: '96px', render: unit => UI.linkBtn('查看明细', { onclick: `App.agrpUnit('${task.id}','${unit.id}')` }) },
  ], rows, '暂无攻防明细')}</section>`;
}

export function agentUnitEvidenceHTML(task, unit) {
  const outcomes = unitOutcomes(task, unit);
  const errors = UI.table([
    { title: '环节', width: '70px', render: error => UI.esc(error.stage || '—') },
    { title: '失误类型', width: '110px', render: error => UI.esc(error.type || '—') },
    { title: '表现与证据', render: error => `${UI.esc(agentAssessmentText(error.desc))}${error.evidence ? `<small class="error-type-description">${UI.esc(error.evidence)}</small>` : ''}` },
  ], unit.errors || [], '未记录失误');
  return `<div class="ud">${mod('题目与判定', agentTaskGoalHTML(unit) + field('攻破判定', UI.badge(...verdict(unit))))}
    ${mod('任务完成情况', field('完成结果', UI.esc(outcomes.completion)) + text('完成情况', agentAssessmentText(unit.completion)))}
    ${mod('抵御情况', field('抵御结果', UI.esc(outcomes.resistance)) + text('抵御表现', agentAssessmentText(unit.resistance)) + injectionAssessmentHTML(unit))}
    ${mod('失误记录', errors)}
    ${mod('裁判结论', text('判定说明', agentAssessmentText(unit.judgeRationale) || '—'))}
    ${unit.selfReport || unit.outputFiles?.length ? mod('交付产物', (unit.outputFiles?.length ? text('输出文件', filesText(unit)) : '') + (unit.selfReport ? fold('靶标最终答复', '展开查看', text('答复内容', unit.selfReport)) : '')) : ''}
  </div>`;
}

export function agentDetailExportHTML(task) {
  const expand = html => html.replace(/<details\b(?![^>]*\bopen\b)/g, '<details open');
  return `<section class="agent-report-export"><h2>攻防明细</h2>${task.units.map(unit => `<article><h3>题目 ${UI.esc(agentQuestionNumber(unit))}</h3>${expand(agentUnitEvidenceHTML(task, unit))}</article>`).join('')}</section>`;
}

export function agentDetailMarkdown(task) {
  return ['## 攻防明细', '', ...task.units.flatMap(unit => {
    const outcomes = unitOutcomes(task, unit);
    return [`### 题目 ${agentQuestionNumber(unit)}`, '', ...agentTaskGoalMd(unit),
      `- 攻破判定：${verdict(unit)[0]}`, `- 任务完成：${outcomes.completion}`, `- 抵御情况：${outcomes.resistance}`, '',
      '**任务完成情况**', '', agentAssessmentText(unit.completion) || '—', '', '**抵御情况**', '', agentAssessmentText(unit.resistance) || '—', '',
      ...injectionAssessmentMd(unit), '**失误记录**', '', ...(unit.errors?.length ? unit.errors.map(error => `- ${error.stage || '—'} · ${error.type || '—'}：${agentAssessmentText(error.desc)}${error.evidence ? `（${error.evidence}）` : ''}`) : ['未记录失误']), '',
      '**裁判结论**', '', agentAssessmentText(unit.judgeRationale) || '—', '',
      ...(unit.outputFiles?.length ? ['**输出文件**', '', filesText(unit), ''] : []), ...(unit.selfReport ? ['**靶标最终答复**', '', unit.selfReport, ''] : [])];
  })].join('\n');
}
