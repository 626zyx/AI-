/* 首页：资源概览、企业平台连接与所选时间内的演练汇总。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { icon } from '../core/icons.js';
import { listAssets, listPlatformConnections, listPlatformSyncedAssets } from '../domain/asset-intake.js';
import { syncPlatformConnection } from '../domain/platform-connection.js';
import { welcomeDashboard, WELCOME_METRIC_NOTE } from '../domain/welcome.js';
import { resolveResultLevel } from '../domain/result-level-rules.js';
import { renderLevelDefinition } from '../core/result-level-badge.js';
import { selectIntakeTab } from './asset-intake.js';

const wbState = { days: 30 };
const number = value => value == null ? '—' : Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const percent = value => value == null ? '—' : UI.pct(value);
const refresh = () => router.nav('home', 'home', null, { replace: true });
const dateText = value => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '尚未同步';
const demoMark = '<span class="wb-demo">演示</span>';
function timeControl() {
  return `<div class="seg wb-time-seg" role="group" aria-label="按时间范围筛选">${[[3, '近3天'], [7, '7天'], [30, '1个月']].map(([days, label]) => `<button class="${wbState.days === days ? 'active' : ''}" aria-pressed="${wbState.days === days}" onclick="App.wbRange(${days})">${label}</button>`).join('')}</div>`;
}
// Sample reminders illustrate the configured levels without adding fake task results.
function sampleAlerts() {
  return [.78, .46, .16].map((value, index) => ({ value, title: ['模型安全专项演练', '对话安全回归演练', '基础安全巡检'][index], at: Date.now() - [1, 6, 24][index] * 3600000, level: resolveResultLevel('model.asr', value) })).filter(row => row.level);
}
function kpis(dashboard, alerts) {
  const assets = listAssets(), models = assets.filter(row => row.kind === 'model').length, agents = assets.filter(row => row.kind === 'agent').length;
  const connected = assets.filter(row => row.status === 'ready').length, codePackages = 3;
  const cards = [
    ['演练对象数量', models + agents + codePackages, `模型 ${models} 个 · 智能体 ${agents} 个 · 代码包 ${codePackages} 个`, 'App.wbConnect()', 'box', '代码包数量为演示数据'],
    ['已连通对象', connected, `待测试 ${assets.filter(row => row.status === 'pending').length} · 连通失败 ${assets.filter(row => row.status === 'failed').length}`, 'App.wbConnect()', 'check', '当前模型与智能体接入状态'],
    ['进行中演练任务', dashboard.counts.running, `所选时间内已完成 ${dashboard.counts.done} 个任务`, "App.go('exercise','tasks')", 'layers', '按所选时间范围统计'],
    ['结果数据等级', alerts.length, '演示提醒 · 按当前启用规则匹配', 'App.wbNotices()', 'bell', '用于展示规则触发效果的模拟记录'],
  ];
  return `<section class="wb-kpis" aria-label="平台概览">${cards.map(([label, value, sub, action, ico, tip]) => `<button class="wb-kpi" onclick="${action}" title="${UI.esc(tip)}"><span class="wb-kpi-label">${UI.esc(label)}${icon(ico, 17)}</span><strong class="num">${number(value)}</strong><small>${UI.esc(sub)}</small>${label === '演练对象数量' ? '<span class="wb-kpi-note">代码包为演示数量</span>' : ''}</button>`).join('')}</section>`;
}
const panel = (title, body, { more = '', cls = '' } = {}) => `<section class="wb-panel ${cls}"><div class="wb-panel-h"><h2>${UI.esc(title)}</h2>${more}</div><div class="wb-panel-b">${body}</div></section>`;
function connectionPanel() {
  const rows = listPlatformConnections().filter(row => row.state === 'connected');
  const content = rows.length ? rows.map(row => `<article class="wb-platform"><div class="wb-platform-symbol">${icon('layers', 22)}</div><div class="wb-platform-info"><div><strong>${UI.esc(row.name)}</strong><span class="wb-connected"><i></i>已连通</span></div><p>${UI.esc(row.endpoint)}</p><small>已同步 ${listPlatformSyncedAssets(row.id).length} 个资产<span>最近同步 ${UI.esc(dateText(row.lastSyncedAt))}</span></small></div>${UI.btn('一键同步', { ico: 'refresh', onclick: `App.wbSync('${UI.esc(row.id)}')` })}</article>`).join('') : '<div class="wb-empty">暂无已连通的企业平台</div>';
  return panel('企业平台连接', `<div class="wb-platform-list">${content}</div><div class="wb-connect-actions"><small>演示平台 · 本地同步</small>${UI.linkBtn('+ 去配置连接', { onclick: 'App.wbConnect()' })}</div>`, { cls: 'wb-connection-panel' });
}
function noticesPanel(alerts) {
  const rows = alerts.map(row => `<button class="wb-msg" onclick="App.wbNotices()"><span class="wb-msg-dot" style="background:${row.level.color}"></span><span class="wb-msg-main"><b>${UI.esc(row.title)} ${demoMark}</b><small>ASR ${percent(row.value)} · ${UI.esc(row.level.ruleName)}</small></span>${renderLevelDefinition(row.level)}<time>${UI.esc(dateText(row.at))}</time></button>`).join('');
  return panel('结果数据等级', rows || '<div class="wb-empty">暂无启用的模型 ASR 规则</div>', { more: UI.linkBtn('规则设置 →', { onclick: 'App.wbNotices()' }), cls: 'wb-notices-panel' });
}
function technicalMetric(label, value, unit = '', { demo = false, title = '' } = {}) {
  return `<div class="wb-average" title="${UI.esc(title)}"><span>${UI.esc(label)}${demo ? demoMark : ''}</span><strong class="num">${value}<small>${unit}</small></strong></div>`;
}
function rateRow(label, value, detail = '') {
  const width = Math.max(0, Math.min(100, (value || 0) * 100));
  return `<div class="wb-rate-row"><div><span>${UI.esc(label)}</span><strong class="num">${percent(value)}</strong></div><div class="wb-rate-track" aria-hidden="true"><i style="width:${width}%"></i></div>${detail ? `<small title="${UI.esc(detail)}">${UI.esc(detail)}</small>` : ''}</div>`;
}
function averageColumn(group, kind) {
  const agent = kind === 'agent', duration = group.averageDuration.value, token = group.averageTokens.value;
  const durationUnit = duration == null ? '' : duration >= 60 ? 'min' : 's';
  const durationValue = duration == null ? '—' : (duration >= 60 ? duration / 60 : duration).toFixed(1);
  const rates = agent
    ? rateRow('攻击成功率（ASR）', group.asr.value) + rateRow('疑似注入采纳率', group.suspectedAdoptionRate.value) + rateRow('任务完成率', group.completionRate.value)
    : rateRow('攻击成功率（ASR）', group.asr.value) + rateRow('最高攻击方法攻破率', group.topMethod?.value, group.topMethod?.name) + rateRow('最高场景攻破率', group.topScenario?.value, group.topScenario?.name);
  const coverage = agent ? [['已演练环境', group.coverage.environments], ['已演练靶标', group.coverage.targets]] : [['已演练题目', group.coverage.questions], ['已演练方法', group.coverage.methods]];
  return `<article class="wb-average-column ${kind}" aria-label="${agent ? '智能体' : '模型'}平均指标"><header><div class="wb-kind-title">${icon(agent ? 'box' : 'layers', 19)}<h3>${agent ? '智能体' : '模型'}</h3></div><span>${group.completedCount} 个已完成任务</span>${UI.linkBtn('查看报告 →', { onclick: agent ? "App.go('agent','ag-reports')" : "App.go('exercise','reports')" })}</header>
    <div class="wb-technical-averages">${technicalMetric('执行成功率', percent(group.executionRate.value), '', { title: '各已完成任务的执行成功率平均值；执行成功与安全判定无关。' })}${technicalMetric('平均任务耗时', durationValue, durationUnit, { demo: group.averageDuration.demo, title: '任务详情总耗时的平均值。' })}${technicalMetric('平均 Token 用量', number(token), '', { demo: group.averageTokens.demo, title: '任务详情 Token 总用量的平均值；演示标记表示包含模拟用量。' })}</div>
    <div class="wb-outcome-averages">${rates}</div><footer>${coverage.map(([label, value]) => `<span>${UI.esc(label)}<strong class="num">${number(value)}</strong></span>`).join('')}</footer>${group.completedCount ? '' : '<p class="wb-period-empty">所选时间内暂无已完成演练</p>'}</article>`;
}
export function welcomePage() {
  const dashboard = welcomeDashboard({ modelTasks: store.listTasks(), agentTasks: store.listAgentTasks(), days: wbState.days }), alerts = sampleAlerts();
  return `<div id="welcome-root" class="wb">${UI.pageHead('首页', { actions: timeControl() })}${kpis(dashboard, alerts)}<div class="wb-main">${connectionPanel()}${noticesPanel(alerts)}</div><section class="wb-platform-averages"><div class="wb-averages-heading"><h2>平台平均指标</h2><span title="${UI.esc(WELCOME_METRIC_NOTE)}">已完成任务平均 · 覆盖数量去重统计</span></div><div class="wb-average-grid">${averageColumn(dashboard.model, 'model')}${averageColumn(dashboard.agent, 'agent')}</div></section></div>`;
}
export function mountWelcome() { return () => {}; }
export const actions = {
  wbRange(days) { if (![3, 7, 30].includes(Number(days))) return; wbState.days = Number(days); refresh(); },
  wbNotices() { router.nav('platform', 'datarule'); },
  wbConnect() { selectIntakeTab('connection'); router.nav('platform', 'intake'); },
  wbSync(id) {
    try { const result = syncPlatformConnection(id); refresh(); UI.toast(`演示同步完成：${result.imported.length} 项资产，${result.changed.length} 项更新`); }
    catch (error) { UI.toast(error.message || '同步失败，请检查连接配置'); }
  },
  wbCreate() {
    UI.modal('开始验证', '<div class="wb-entry-grid"><button onclick="UI.closeModal();App.v3Create(\'model\')"><strong>模型演练</strong><span>选择被测模型与攻击策略</span></button><button onclick="UI.closeModal();App.v3Create(\'agent\')"><strong>智能体演练</strong><span>选择靶标并验证沙箱环境</span></button></div>', UI.btn('取消', { onclick: 'UI.closeModal()' }));
  },
};
