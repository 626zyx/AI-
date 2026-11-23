/* Agent reports combine aggregate analysis with scoped question evidence. */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { compareValues } from '../core/table-sort.js';
import { configSummary } from '../core/task-config.js';
import { reportSection, reportDocument } from './report-format.js';
import { reportResultPanel } from './report-result.js';
import { agentPerformance } from '../domain/agent-performance.js';
import { agentErrorFramework } from '../domain/agent-error-framework.js';
import { assessmentTask } from '../domain/task-assessment.js';
import { taskMetricMarkdown } from './task-metrics.js';
import { actions as reportManagementActions } from './report-management.js';
import { agentAssessmentText } from './agent-evidence.js';
import { agentDetailTable, agentQuestionNumber, agentUnitEvidenceHTML, agentDetailExportHTML, agentDetailMarkdown } from './agent-report-detail.js';
import { emit, closePops, fmtOf } from '../core/export.js';

const view = { q: '', targetId: 'all', sortDesc: true };
const detail = { taskId: null, tab: 'analysis' };
const getTask = id => { const task = store.getAgentTask(id); return task ? assessmentTask(task) : null; };
const short = (value, length = 210) => { const text = agentAssessmentText(value); return text.length > length ? `${text.slice(0, length)}…` : text; };

export function agentReportsPage() {
  let rows = store.listAgentReports();
  const targets = [...new Map(rows.map(row => [getTask(row.taskId)?.targetId, row.targetName]).filter(([id]) => id)).entries()];
  if (view.targetId !== 'all') rows = rows.filter(row => getTask(row.taskId)?.targetId === view.targetId);
  if (view.q.trim()) rows = rows.filter(row => `${row.name} ${row.targetName}`.toLowerCase().includes(view.q.trim().toLowerCase()));
  rows.sort((a, b) => compareValues(a.createdAt, b.createdAt, view.sortDesc));
  const filters = UI.filters({ search: { label: '搜索', id: 'agrp-q', value: view.q, placeholder: '搜索报告或靶标', oninput: 'App.agrpSearch(this.value)' }, selects: [{ label: '靶标', id: 'agrp-target', value: view.targetId, onchange: 'App.agrpTarget(this.value)', options: [['all', '全部靶标'], ...targets] }] });
  const table = UI.pagedTable('ag-reports', [
    { title: '报告名称', render: row => `<button class="link-btn" onclick="App.openAgReport('${row.taskId}')">${UI.esc(row.name)}</button>` },
    { title: '靶标名称', render: row => UI.esc(row.targetName) },
    { title: '生成时间', width: '160px', sort: { direction: view.sortDesc ? 'descending' : 'ascending', onclick: 'App.agrpSort()' }, render: row => UI.esc(row.createdAt || '—') },
    { title: '操作', width: '120px', cls: 'actions', render: row => `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.openAgReport('${row.taskId}')` })}${UI.linkBtn('删除', { danger: true, onclick: `App.rpDeleteReport('${row.taskId}','agent')` })}</div>` },
  ], rows, '暂无演练报告');
  return `${UI.pageHead('演练报告')}${filters}${UI.card('', table, '', true)}`;
}

function exportMenu(id) {
  return `<div class="pop-wrap">${UI.btn('导出报告', { kind: 'primary', ico: 'download', onclick: "App.popToggle(event,'agrp-export')" })}<div class="pop" id="agrp-export" hidden onclick="event.stopPropagation()"><div class="pop-title">导出内容</div><label class="pop-opt"><input type="checkbox" id="agex-analysis" checked>结果分析</label><label class="pop-opt"><input type="checkbox" id="agex-detail">攻防明细</label><div class="pop-title">导出格式</div><label class="pop-opt"><input type="radio" name="agex-fmt" value="pdf" checked>PDF</label><label class="pop-opt"><input type="radio" name="agex-fmt" value="md">Markdown</label><div class="pop-foot">${UI.btn('确认导出', { kind: 'primary', onclick: `App.agrpExport('${id}')` })}</div></div></div>`;
}
export function agentReportDetailPage(cur) {
  const task = getTask(cur?.param);
  if (!task) return UI.pageHead('演练报告') + '<div class="empty">报告不存在</div>';
  if (task.status !== 'done') return `${UI.backBtn()}${UI.pageHead(task.name)}<div class="empty"><strong>任务完成后生成报告</strong>${UI.btn('查看任务', { onclick: `App.openAgTask('${task.id}')` })}</div>`;
  if (detail.taskId !== task.id) { detail.taskId = task.id; detail.tab = 'analysis'; }
  const toggle = `<div class="report-switch"><div class="seg" role="tablist" aria-label="报告内容">${[['analysis', '结果分析'], ['detail', '攻防明细']].map(([key, label]) => `<button role="tab" aria-selected="${detail.tab === key}" aria-controls="agrp-body" class="${detail.tab === key ? 'active' : ''}" onclick="App.agrpTab('${key}')">${label}</button>`).join('')}</div></div>`;
  return `<div class="rr-report rr-agent-report">${UI.backBtn()}${UI.pageHead(task.name, { actions: UI.btn('任务详情', { onclick: `App.openAgTask('${task.id}')` }) + exportMenu(task.id) })}${configSummary(task, 'agent')}${reportResultPanel(task)}${toggle}<div class="rr-report-scroll" id="agrp-body" role="tabpanel">${detail.tab === 'detail' ? agentDetailTable(task) : analysisHTML(task)}</div></div>`;
}
function distributionHTML(section, kind) {
  const total = section.distribution.reduce((sum, row) => sum + row.count, 0);
  const rows = section.distribution;
  if (kind === 'completion') return `<div class="agent-completion-matrix" aria-label="任务完成与安全结果矩阵">${rows.filter(row => row.key !== 'unknown').map(row => `<div style="--outcome-color:${row.color}"><span>${row.label}</span><strong class="num">${row.count}<small>项</small></strong><i style="width:${total ? row.count / total * 100 : 0}%"></i></div>`).join('')}</div>${rows.at(-1).count ? `<p class="rr-small">${rows.at(-1).count} 项未评估</p>` : ''}`;
  return `<div class="agent-distribution" aria-label="抵御结果分布"><div class="agent-stacked-bar">${rows.filter(row => row.count).map(row => `<i title="${row.label} ${row.count} 项" style="width:${total ? row.count / total * 100 : 0}%;background:${row.color}"></i>`).join('')}</div><div class="agent-distribution-legend">${rows.map(row => `<span><i style="background:${row.color}"></i>${row.label}<b class="num">${row.count}</b></span>`).join('')}</div></div>`;
}
function performanceSection(task, key, title, section) {
  const highlights = section.highlights.map(item => `<article class="agent-highlight"><div><span>题目 ${UI.esc(item.question)}</span><button class="link-btn" onclick="App.agrpUnit('${task.id}','${item.id}')">查看证据</button></div><h4 title="${UI.esc(item.title)}">${UI.esc(item.title)}</h4><p>${UI.esc(short(item.content))}</p></article>`).join('');
  return reportSection(title, `<section data-performance="${key}"><p class="agent-performance-summary" data-performance-summary>${UI.esc(section.summary)}</p><div class="agent-performance-grid"><div class="agent-performance-chart"><div class="sub-label">${key === 'completion' ? '完成 × 安全' : '抵御结果'}</div>${distributionHTML(section, key)}</div><div class="agent-highlight-list"><div class="sub-label">重点任务</div>${highlights || '<p class="rr-note">暂无重点任务</p>'}</div></div></section>`);
}
const errorNote = '按涉及题目去重；同一失误可出现在多个环节。';
function errorFrameworkHTML(task) {
  const frame = agentErrorFramework(task.units);
  const rows = frame.rows.filter(row => row.count);
  return `<p class="rr-note">${errorNote}</p><div class="agent-error-framework-scroll">${UI.table([
    { title: '失误类型', render: row => `<strong>${UI.esc(row.key)}</strong><span class="error-type-description">${UI.esc(row.description)}</span>` },
    { title: '归属', width: '100px', render: row => /交付|遗漏|任务|执行/.test(row.key) ? '任务完成' : '安全抵御' },
    ...frame.stages.map(stage => ({ title: stage, width: '68px', render: row => { const cell = row.cells.find(item => item.stage === stage); return cell?.count ? `<span class="error-observation num">${cell.count}</span>` : '<span class="error-unrecorded">—</span>'; } })),
    { title: '涉及题数', width: '80px', render: row => `<b class="num">${row.count}</b>` },
  ], rows, '本次未记录共性失误')}</div>`;
}
function recommendations(task) {
  return task.agg?.breach ? ['优先复核已攻破任务的授权与交付边界，将对应检查加入业务流程。', '保持题库、裁判和防护条件一致，针对当前企业版本复测并在靶标状态中对比。'] : ['补充当前业务的边界场景，保持同一判定标准持续评估。', '企业版本或关键调用配置变更后，使用同一策略复测。'];
}
function analysisHTML(task) {
  const performance = agentPerformance(task);
  return reportDocument([
    performanceSection(task, 'completion', '任务完成情况', performance.completion),
    performanceSection(task, 'resistance', '抵御情况', performance.resistance),
    reportSection('共性失误分析', errorFrameworkHTML(task)),
    reportSection('下一步建议', `<ul class="conclusions">${recommendations(task).map(text => `<li class="conc-item"><p>${text}</p></li>`).join('')}</ul>`),
  ]);
}
function analysisMarkdown(task) {
  const performance = agentPerformance(task), errors = agentErrorFramework(task.units);
  return [`# ${task.name}`, '', `- 靶标：${task.targetName}`, `- 演练策略：${task.strategyName || '—'}`, `- 裁判：${task.judgeName || '—'}`, '', '## 演练结果', '', ...taskMetricMarkdown(task), '',
    ...['completion', 'resistance'].flatMap(key => [`## ${key === 'completion' ? '任务完成情况' : '抵御情况'}`, '', performance[key].summary, '', ...performance[key].distribution.map(row => `- ${row.label}：${row.count} 项`), '', '### 重点任务', '', ...performance[key].highlights.flatMap(item => [`**题目 ${item.question} · ${item.title}**`, '', item.content, ''])]),
    '## 共性失误分析', '', errorNote, '', ...errors.rows.filter(row => row.count).map(row => `- ${row.key}：${row.count} 项`), '', '## 下一步建议', '', ...recommendations(task).map(text => `- ${text}`), ''].join('\n');
}
const refresh = () => router.nav('agent', 'ag-reports');
export const actions = {
  ...reportManagementActions,
  agrpSearch(value) { view.q = value; UI.resetPage('ag-reports'); refresh(); },
  agrpTarget(value) { view.targetId = value; UI.resetPage('ag-reports'); refresh(); },
  agrpSort() { view.sortDesc = !view.sortDesc; refresh(); },
  openAgReport(id) { const task = getTask(id); router.nav('agent', task?.status === 'done' ? 'ag-report-detail' : 'ag-task-detail', id); },
  agrpTab(tab) {
    if (!['analysis', 'detail'].includes(tab)) return;
    detail.tab = tab;
    if (detail.taskId) router.nav('agent', 'ag-report-detail', detail.taskId);
  },
  agrpUnit(taskId, unitId) {
    const task = getTask(taskId);
    if (task?.status !== 'done') return UI.toast('任务完成后可查看报告证据');
    const unit = task.units.find(item => item.id === unitId);
    if (!unit) return;
    UI.drawer(`攻防明细 · 题目 ${agentQuestionNumber(unit)}`, agentUnitEvidenceHTML(task, unit), UI.btn('关闭', { onclick: 'UI.closeDrawer()' }));
  },
  agrpExport(id) {
    const task = getTask(id); if (task?.status !== 'done') return UI.toast('任务完成后可导出报告');
    const withAnalysis = document.getElementById('agex-analysis')?.checked ?? true;
    const withDetail = document.getElementById('agex-detail')?.checked ?? false;
    if (!withAnalysis && !withDetail) return UI.toast('请选择导出内容');
    const heading = [`# ${task.name}`, '', `- 靶标：${task.targetName}`, '', '## 演练结果', '', ...taskMetricMarkdown(task), ''].join('\n');
    const md = [withAnalysis ? analysisMarkdown(task) : heading, withDetail ? agentDetailMarkdown(task) : ''].filter(Boolean).join('\n');
    const html = `<div class="rr-report"><h1>${UI.esc(task.name)}</h1>${reportResultPanel(task)}${withAnalysis ? analysisHTML(task) : ''}${withDetail ? agentDetailExportHTML(task) : ''}</div>`;
    closePops(); emit(`${task.name}-演练报告`, md, fmtOf('agex-fmt'), html);
  },
};
