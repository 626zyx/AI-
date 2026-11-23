import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { icon } from '../core/icons.js';
import { homeView, HOME_PERIODS } from '../domain/welcome.js';
import { subscribeAssets } from '../domain/asset-intake.js';
import { subscribeAssetSync } from '../domain/asset-sync.js';
import { subscribeGrades } from '../domain/grading-rules.js';
import { subscribeNotifications, notificationKey, isNotificationRead } from '../domain/notifications.js';
let periodId = '7d', resourceTab = 'strategies';
const e = UI.esc, q = value => e(JSON.stringify(String(value ?? '')));
const date = value => value ? new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T') + '+08:00').toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
const time = value => value ? date(value).slice(-5) : '—';
const status = { untested: ['待演练', 'gray'], retest: ['待复测', 'amber'], running: ['演练中', 'blue'], done: ['已完成', 'green'] };
const typeLabel = value => value === 'agent' ? '智能体' : '模型';
function toolbar() {
  return `<header class="wb-toolbar"><div class="wb-heading"><h1>态势总览</h1><div class="wb-global-filter" role="group" aria-label="首页时间范围">${HOME_PERIODS.map(({ id, label }) => `<button class="${periodId === id ? 'active' : ''}" aria-pressed="${periodId === id}" onclick="App.wbPeriod('${id}')">${label}</button>`).join('')}</div></div><div class="wb-actions">${UI.btn('连接资产平台', { kind: 'primary', ico: 'plus', onclick: 'App.aiConnect()' })}</div></header>`;
}
function metrics(v) {
  const modelCount = v.assets.filter(a => a.kind === 'model').length, agentCount = v.assets.length - modelCount;
  const reportModels = v.reports.filter(t => t.objectType !== 'agent').length;
  const cards = [
    { title: '同步资产', value: v.assets.length, tone: 'blue', icon: 'layers', note: `<span class="wb-model">模型 <b>${modelCount}</b></span><span class="wb-agent">智能体 <b>${agentCount}</b></span>`, scope: '当前' },
    { title: '当前版本评估覆盖', value: UI.pct(v.coverage, 0), tone: 'teal', icon: 'check', note: `<span>已评估 <b>${v.graded.length}</b> / ${v.assets.length}</span>`, scope: '当前' },
    { title: '进行中任务', value: v.running.length, tone: 'indigo', icon: 'play', note: `<span>本期完成 <b>${v.tasks.filter(t => t.status === 'done').length}</b></span><span class="${v.errorTasks.length ? 'wb-error' : ''}">异常 <b>${v.errorTasks.length}</b></span>`, scope: '当前' },
    { title: '待演练 / 待复测', value: v.pending.length, tone: 'amber', icon: 'clock', note: `<span>待演练 <b>${v.pending.filter(a => a.exercise === 'untested').length}</b></span><span class="wb-wait">待复测 <b>${v.pending.filter(a => a.exercise === 'retest').length}</b></span>`, scope: '当前' },
    { title: '已生成报告', value: v.reports.length, tone: 'purple', icon: 'file', note: `<span class="wb-model">模型 <b>${reportModels}</b></span><span class="wb-agent">智能体 <b>${v.reports.length - reportModels}</b></span>`, scope: v.period.label },
  ];
  return `<section class="wb-metrics" aria-label="资产与任务概况">${cards.map(c => `<article class="wb-metric ${c.tone}"><div class="wb-metric-title"><span>${c.title}</span><span class="wb-metric-icon">${icon(c.icon, 16)}</span></div><div class="wb-metric-number"><strong>${c.value}</strong><span>${c.scope}</span></div><div class="wb-metric-note">${c.note}</div></article>`).join('')}</section>`;
}
const panelHead = (title, extra = '') => `<header class="wb-panel-head"><h2>${title}</h2>${extra}</header>`;
function connections(v) {
  return `<section class="wb-panel wb-connections">${panelHead('企业平台连接', UI.linkBtn('管理连接 →', { onclick: 'App.aiConnections()' }))}<div class="wb-panel-scroll">${v.connections.map(c => `<article class="wb-connection"><div><span class="wb-connection-logo">${icon('swapHorizontal', 19)}</span><strong title="${e(c.name)}">${e(c.name)}</strong>${UI.badge(c.status === 'error' ? '同步异常' : c.status === 'syncing' ? '同步中' : c.status === 'partial' ? '部分成功' : '已连接', c.status === 'error' ? 'red' : c.status === 'syncing' ? 'blue' : c.status === 'partial' ? 'amber' : 'green')}</div><p class="wb-connection-url">${e(c.baseUrl)}</p><div class="wb-connection-facts"><span>同步资产<b>${c.assetCount}</b></span><span>最近同步<b>${time(c.lastSync)}</b></span><span>自动同步<b>${c.interval} 分钟</b></span></div>${c.error ? `<p class="wb-sync-error">${e(c.error)}</p>` : ''}<footer><span>${c.lastBatch ? `新增 ${c.lastBatch.counts.added} · 更新 ${c.lastBatch.counts.updated}` : '连接正常'}</span>${UI.linkBtn(c.status === 'error' ? '重试同步' : '立即同步', { onclick: `App.aiSync(${q(c.id)})`, disabled: c.status === 'syncing' })}</footer></article>`).join('') || `<div class="wb-empty">${UI.btn('连接企业资产平台', { kind: 'primary', onclick: 'App.aiConnect()' })}</div>`}</div></section>`;
}
function distribution(v) {
  let cursor = 0;
  const stops = v.grades.map(g => { const start = cursor; cursor += v.assets.length ? g.count / v.assets.length * 100 : 0; return `${g.color} ${start}% ${cursor}%`; }).join(',');
  return `<section class="wb-panel wb-distribution">${panelHead('靶标评估结果', UI.linkBtn('靶标状态 →', { onclick: "App.aiShowAssets('all')" }))}<div class="wb-grade-content"><div class="wb-grade-ring" style="--grade-stops:${v.assets.length ? stops : '#e9eef5 0% 100%'}" role="img" aria-label="当前 ${v.assets.length} 项靶标，${v.graded.length} 项已评估"><div><strong>${v.graded.length}<small> / ${v.assets.length}</small></strong><span>当前已评估</span></div></div><div class="wb-grade-bars">${v.grades.map(g => `<div class="wb-grade-row"><span><i style="background:${g.color}"></i>${g.label}</span><div><i style="width:${v.assets.length ? g.count / v.assets.length * 100 : 0}%;background:${g.color}"></i></div><strong>${g.count}</strong></div>`).join('')}</div></div></section>`;
}
function messages(v) {
  const types = { sync: '同步提醒', asset: '资产变化', grade: '等级变化', start: '任务开始', done: '任务完成', report: '评估等级' };
  return `<section class="wb-panel wb-messages">${panelHead(`${icon('bell', 15)}消息提醒`, UI.linkBtn('全部 →', { onclick: 'App.openNotices()' }))}<div class="wb-panel-scroll">${v.notices.map(n => `<button class="wb-notice ${n.urgent ? 'urgent' : n.assessment ? 'assessment' : ''} ${isNotificationRead(n) ? 'read' : ''}" onclick="App.ntOpen(${q(notificationKey(n))});${e(n.go || 'App.openNotices()')}"><span class="wb-notice-icon">${icon(n.assessment ? 'bell' : 'file', 15)}</span><div><div><span class="wb-notice-type">${e(types[n.type] || '通知')}</span><time>${e(date(n.at).slice(0, 5))}</time></div><strong title="${e(n.title)}">${e(n.title)}</strong><p title="${e(n.meta || '')}">${e(n.meta || '')}</p></div></button>`).join('') || `<div class="wb-empty">${icon('bell', 24)}<span>本期暂无消息</span></div>`}</div></section>`;
}
function attention(v) {
  return `<section class="wb-panel wb-attention">${panelHead('资产动态', UI.linkBtn('全部靶标 →', { onclick: "App.aiShowAssets('all')" }))}<div class="wb-panel-scroll">${v.attention.map(a => `<button class="wb-asset-row" onclick="App.aiDetail(${q(a.id)})"><span class="wb-asset-icon ${a.kind}">${icon(a.kind === 'agent' ? 'box' : 'cpu', 17)}</span><span class="wb-asset-name"><strong title="${e(a.name)}">${e(a.name)}</strong><small>${typeLabel(a.kind)} · ${e(a.enterpriseVersion)} <time>${e(date(a.activityAt).slice(0, 5))}</time></small></span><span class="wb-asset-state">${UI.badge(...status[a.exercise])}${UI.badge(a.grade.label, a.grade.cls)}</span>${icon('chevronRight', 13)}</button>`).join('') || '<div class="wb-empty">本期暂无资产变化</div>'}</div></section>`;
}
function resources(v) {
  const selected = v.resources.find(r => r.id === resourceTab) || v.resources[0];
  return `<section class="wb-panel wb-resources">${panelHead('策略与规则', '<span class="wb-panel-meta">资源配置 · 版本演进</span>')}<div class="wb-resource-tabs" role="tablist" aria-label="策略与规则">${v.resources.map(r => `<button role="tab" aria-selected="${r.id === selected.id}" class="${r.id === selected.id ? 'active' : ''}" onclick="App.wbResource('${r.id}')">${icon(r.icon, 15)}<span>${r.label}</span><b>${r.count}</b></button>`).join('')}</div><div class="wb-resource-content wb-panel-scroll" role="tabpanel" aria-label="${selected.label}">${selected.cards.map(c => `<button class="wb-resource-card" onclick="${c.go}"><span class="wb-resource-heading">${c.title}<span>${c.tag} ${icon('chevronRight', 12)}</span></span><span class="wb-resource-value"><strong>${c.value}</strong><small>${c.unit}</small></span><span class="wb-resource-detail" title="${e(c.detail)}">${e(c.detail)}</span></button>`).join('')}</div></section>`;
}
export function welcomePage() { const v = homeView(periodId); return `<div id="welcome-root" class="wb">${toolbar()}${metrics(v)}<div class="wb-dashboard">${connections(v)}${distribution(v)}${messages(v)}${attention(v)}${resources(v)}</div></div>`; }
function refresh() { const cur = router.state(); router.nav(cur.page, cur.sub, null, { replace: true }); }
export function mountWelcome(host = document) {
  if (!host.querySelector('#welcome-root')) return () => {};
  let timer;
  const update = () => { clearTimeout(timer); timer = setTimeout(() => { const current = host.querySelector('#welcome-root'); if (!current || document.querySelector('.overlay.open')) return; const positions = [...current.querySelectorAll('.wb-panel-scroll')].map(el => el.scrollTop); const holder = current.parentElement; if (holder) { holder.innerHTML = welcomePage(); holder.querySelectorAll('.wb-panel-scroll').forEach((el, i) => el.scrollTop = positions[i] || 0); } }, 80); };
  const offs = [subscribeAssets(update), subscribeAssetSync(update), subscribeGrades(update), subscribeNotifications(update), store.subscribeTasks(update)];
  return () => { clearTimeout(timer); offs.forEach(off => off()); };
}
export const actions = {
  wbPeriod(value) { periodId = HOME_PERIODS.some(p => p.id === value) ? value : '7d'; refresh(); },
  wbResource(value) { resourceTab = value; refresh(); },
};
