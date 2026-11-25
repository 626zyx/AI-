/* 首页：资源概览、分类结果与已记录演练的关键发现。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { icon } from '../core/icons.js';
import { BUSINESS_ICONS } from '../domain/constants.js';
import { listAssets, listPlatformConnections } from '../domain/asset-intake.js';
import { welcomeDashboard, welcomeAssetDirectory } from '../domain/welcome.js';
import { resolveResultLevel } from '../domain/result-level-rules.js';
import { renderLevelDefinition } from '../core/result-level-badge.js';
import { unifiedPosture, postureControls, postureActions } from './welcome-posture.js';

const wbState = { days: 30, assetPages: { model: 1, agent: 1 } };
const assetPageSize = 5;
const number = value => value == null ? '—' : Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const percent = value => value == null ? '—' : UI.pct(value);
const refresh = () => router.nav('home', 'home', null, { replace: true });
const levelBadge = level => level ? renderLevelDefinition(level) : `<span class="wb-unmapped-level">${icon('shield', 14)}<span>未配置等级</span></span>`;
const currentDashboard = () => welcomeDashboard({ modelTasks: store.listTasks(), agentTasks: store.listAgentTasks(), days: wbState.days });
const currentAssets = dashboard => welcomeAssetDirectory(dashboard.tasks, listAssets()).filter(row => row.tasks.length > 0).map(row => ({ ...row, level: row.asr == null ? null : resolveResultLevel(`${row.kind}.asr`, row.asr) }));
const duration = metric => metric?.value == null ? '—' : `${metric.value < 60 ? metric.value.toFixed(1) + ' 秒' : (metric.value / 60).toFixed(1) + ' 分'}${metric.demo ? ' *' : ''}`;
const tokens = metric => metric?.value == null ? '—' : `${number(metric.value)}${metric.demo ? ' *' : ''}`;
function timeControl() {
  return `<div class="seg wb-time-seg" role="group" aria-label="按时间范围筛选">${[[3, '近3天'], [7, '7天'], [30, '1个月']].map(([days, label]) => `<button class="${wbState.days === days ? 'active' : ''}" aria-pressed="${wbState.days === days}" onclick="App.wbRange(${days})">${label}</button>`).join('')}</div>`;
}
const kindCounts = (model, agent) => `<small>模型 ${number(model)} · Agent ${number(agent)}</small>`;
function kpis(dashboard) {
  const assets = listAssets(), models = assets.filter(row => row.kind === 'model').length, agents = assets.filter(row => row.kind === 'agent').length;
  const connections = listPlatformConnections(), connected = connections.filter(row => row.state === 'connected').length;
  const taskCounts = dashboard.counts, model = dashboard.model, agent = dashboard.agent;
  const cards = [
    { label:'演练对象数量', value:models + agents, sub:`模型 ${models} · Agent ${agents}`, icon:BUSINESS_ICONS.assets, tip:'当前已接入的模型与智能体' },
    { label:'完成任务数', value:taskCounts.done, html:kindCounts(model.completedCount, agent.completedCount), icon:BUSINESS_ICONS.tasks, tip:`所选时间内模型与智能体已完成任务；正在演练 ${taskCounts.running}、待开始 ${taskCounts.ready}、异常 ${taskCounts.error}、草稿 ${taskCounts.draft}、已终止 ${taskCounts.stopped}` },
    { label:'已生成报告数', value:model.completedCount + agent.completedCount, html:kindCounts(model.completedCount, agent.completedCount), icon:BUSINESS_ICONS.reports, tip:'所选时间内，每个已完成任务对应一份可查看的演练报告；未完成任务不计入' },
    { label:'已连接企业平台', value:connections.length, sub:`${connected} 个已连通 · ${connections.length - connected} 个待连通（演示）`, icon:BUSINESS_ICONS.platform, tip:'当前已配置的企业平台连接；连通状态为本地演示' },
    { label:'演练策略覆盖数量', value:model.coverage.strategies + agent.coverage.strategies, html:`<div class="wb-coverage-counts"><span>方法 <b>${number(model.coverage.methods)}</b></span><span>题目 <b>${number(model.coverage.questions)}</b></span><span>环境 <b>${number(agent.coverage.environments)}</b></span></div>`, icon:BUSINESS_ICONS.strategy, tip:'所选时间内已完成且实际执行的任务：策略按对象类型与记录的策略 ID 去重；无策略 ID 的自由组合不计入策略数。方法与题目取模型执行单元，环境取 Agent 执行单元，分别按标识去重；旧题目无 ID 时按完整题目内容去重' },
  ];
  return `<section class="wb-kpis" aria-label="平台概览">${cards.map(card => `<article class="wb-kpi" title="${UI.esc(card.tip)}"><span class="wb-kpi-label">${UI.esc(card.label)}${icon(card.icon, 17)}</span><strong class="num">${number(card.value)}</strong>${card.html || `<small>${UI.esc(card.sub)}</small>`}</article>`).join('')}</section>`;
}

const panel = (title, body, { more = '', cls = '' } = {}) => `<section class="wb-panel ${cls}"><div class="wb-panel-h"><h2>${UI.esc(title)}</h2>${more}</div><div class="wb-panel-b">${body}</div></section>`;
function assetResultsPanel(results, dashboard) {
  const groups = ['model', 'agent'].map(kind => {
    const rows = results.filter(row => row.kind === kind), name = kind === 'model' ? '模型' : '智能体';
    const summary = dashboard[kind], pageSize = assetPageSize;
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    const page = wbState.assetPages[kind] = Math.min(wbState.assetPages[kind], pageCount);
    const table = rows.length ? UI.table([
      { title: '靶标名称', render: row => `<div class="wb-asset-name"><span title="${UI.esc(row.name)}">${UI.esc(row.name)}</span>${!row.inDirectory ? '<small>已移出目录</small>' : ''}</div>` },
      { title: '平均 ASR', cls: 'num', render: row => `<span class="wb-asr-value ${row.asr > 0 ? 'has-breach' : ''}" title="${row.assessedRuns} 次有效演练的 ASR 等权平均">${percent(row.asr)}</span>` },
      { title: '结果等级', render: row => row.asr == null ? `<span class="wb-no-result">未判定</span>` : levelBadge(row.level) },
      { title: '演练次数', cls: 'num', render: row => number(row.tasks.length) },
      { title: '攻破 / 判定', cls: 'num', render: row => row.judged ? `${number(row.breach)} / ${number(row.judged)}` : '—' },
    ], rows.slice((page - 1) * pageSize, page * pageSize)) : '<p class="wb-period-empty">暂无演练结果</p>';
    return `<section class="wb-asset-group ${kind} ${pageCount > 1 ? 'has-pages' : 'single-page'}" aria-label="${name}靶标演练结果"><header><div class="wb-kind-title">${icon(BUSINESS_ICONS[kind], 16)}<h3>${name}</h3><span class="wb-kind-count">${rows.length}</span></div></header><div class="wb-asset-summary"><span title="所选时间内，各次已完成任务执行成功率的等权平均">执行成功率 <b class="wb-safe">${percent(summary.executionRate.value)}</b></span><span title="已完成任务的总耗时等权平均；* 表示包含演示估算">平均耗时 <b>${duration(summary.averageDuration)}</b></span><span title="已完成任务的总 Token 等权平均；* 表示包含演示估算">平均 Token <b>${tokens(summary.averageTokens)}</b></span></div><div class="wb-asset-table">${table}</div>${pageCount > 1 ? `<div class="wb-asset-pager"><span>${rows.length} 个靶标${summary.averageDuration.demo || summary.averageTokens.demo ? ' · * 含演示估算' : ''}</span><div><button aria-label="${name}靶标上一页" ${page <= 1 ? 'disabled' : ''} onclick="App.wbAssetsPage('${kind}',${page - 1})">${icon('prev', 13)}</button><span>${page} / ${pageCount}</span><button aria-label="${name}靶标下一页" ${page >= pageCount ? 'disabled' : ''} onclick="App.wbAssetsPage('${kind}',${page + 1})">${icon('next', 13)}</button></div></div>` : summary.averageDuration.demo || summary.averageTokens.demo ? '<div class="wb-asset-pager wb-asset-note"><span>* 含演示估算</span></div>' : ''}</section>`;
  }).join('');
  return panel('靶标结果', `<div class="wb-asset-groups">${groups}</div>`, { cls: 'wb-assets-panel' });
}
function findingsPanel(dashboard) {
  return panel('演练态势', unifiedPosture(dashboard), { cls: 'wb-findings-panel wo-panel', more: postureControls() });
}
export function welcomePage() {
  const dashboard = currentDashboard();
  const results = currentAssets(dashboard);
  return `<div id="welcome-root" class="wb">${UI.pageHead('首页', { actions: timeControl() })}${kpis(dashboard)}<div class="wb-main">${findingsPanel(dashboard)}${assetResultsPanel(results, dashboard)}</div></div>`;
}
export function mountWelcome() { return () => {}; }
export const actions = {
  ...postureActions,
  wbAssetsPage(kind, page) {
    if (!['model', 'agent'].includes(kind)) return;
    wbState.assetPages[kind] = Math.max(1, Math.floor(Number(page) || 1)); refresh();
  },
  wbRange(days) { if (![3, 7, 30].includes(Number(days))) return; wbState.days = Number(days); wbState.assetPages = { model: 1, agent: 1 }; refresh(); },
};
