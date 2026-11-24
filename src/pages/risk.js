/* 风险中心：已触发的风险事件 + 轻量处置。
 * 操作列：处理（下拉：忽略 / 已处理，改状态）+ 复测（跳到来源任务的一键复测）。
 * 处理状态只存在内存里（demo），刷新即重置。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { listRiskEvents } from '../domain/risk-rules.js';

const view = { level: 'all', source: 'all', status: 'all', q: '' };

const STATUS = {
  pending: { label: '待处理', tone: 'amber' },
  ignored: { label: '忽略', tone: 'gray' },
  handled: { label: '已处理', tone: 'green' },
};
const handled = new Map(); // `${source}:${id}` -> status
const statusOf = (e) => handled.get(`${e.source}:${e.id}`) || 'pending';

export function riskPage() {
  let rows = listRiskEvents(store.listTasks(), store.listAgentTasks());
  if (view.source !== 'all') rows = rows.filter((e) => e.source === view.source);
  if (view.level !== 'all') rows = rows.filter((e) => e.risk.key === view.level);
  if (view.status !== 'all') rows = rows.filter((e) => statusOf(e) === view.status);
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((e) => (e.targetName + e.taskName + e.typeName).toLowerCase().includes(q));
  }

  const flt = UI.filters({
    search: { label: '搜索', id: 'rk-q', value: view.q, placeholder: '搜索风险事件、靶标或来源任务', oninput: 'App.rkFilter("q",this.value)' },
    selects: [
      {
        label: '来源', id: 'rk-source', value: view.source, onchange: 'App.rkFilter("source",this.value)',
        options: [['all', '全部来源'], ['model', '模型演练'], ['agent', 'Agent 演练']],
      },
      {
        label: '风险等级', id: 'rk-level', value: view.level, onchange: 'App.rkFilter("level",this.value)',
        options: [['all', '全部等级'], ['critical', '高危'], ['high', '中危'], ['medium', '低危']],
      },
      {
        label: '处理状态', id: 'rk-status', value: view.status, onchange: 'App.rkFilter("status",this.value)',
        options: [['all', '全部状态'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])],
      },
    ],
    right: `<span class="faint text-support">${UI.linkBtn('触发与分级规则', { onclick: "App.go('platform','riskrule')" })}</span>`,
  });

  const openTask = (e) => (e.source === 'agent' ? `App.openAgTask('${e.taskId}')` : `App.openTask('${e.taskId}')`);
  const retest = (e) => (e.source === 'agent' ? `App.agRetest('${e.taskId}')` : `App.retest('${e.taskId}')`);
  const table = UI.pagedTable(
    'risk',
    [
      { title: '风险事件 / 资产', render: e => `${UI.linkBtn(e.typeName, { onclick: `App.rkDetail('${e.id}')` })}<div class="muted text-support">${UI.esc(e.targetName)} · ${UI.esc(e.targetVersion)}</div>` },
      { title: '触发指标', render: e => `<span title="${UI.esc(e.metric.definition)}">${UI.esc(e.metricLabel)} ${UI.pct(e.value)}</span><div class="muted text-support">${e.metric.numerator} / ${e.metric.denominator} 有效判定${e.metric.name ? ` · ${UI.esc(e.metric.name)}` : ''}</div>` },
      { title: '来源', width: '100px', render: (e) => (e.source === 'agent' ? 'Agent 演练' : '模型演练') },
      { title: '风险等级', width: '90px', render: (e) => UI.riskBadge(e.risk) },
      { title: '来源任务', render: (e) => `<button class="link-btn" onclick="${openTask(e)}">${UI.esc(e.taskName)}</button>` },
      { title: '触发时间', width: '150px', cls: 'num', render: (e) => UI.esc(e.at || '—') },
      { title: '处理状态', width: '90px', render: (e) => UI.badge(STATUS[statusOf(e)].label, STATUS[statusOf(e)].tone) },
      {
        title: '操作', width: '150px', cls: 'actions',
        render: (e) => `<div class="row-actions">
          ${UI.moreMenu([['忽略', `App.rkSet('${e.source}','${e.id}','ignored')`], ['已处理', `App.rkSet('${e.source}','${e.id}','handled')`]], '处理')}
          ${UI.linkBtn('复测', { onclick: retest(e) })}
        </div>`,
      },
    ],
    rows,
    '暂无风险事件',
  );
  return `${UI.pageHead('风险中心', { actions: UI.btn('管理风险规则', { onclick: "App.go('platform','riskrule')" }) })}<p class="rr-note">按当前启用的发布规则检查已完成演练。同一任务可触发多条规则；未评估或不适用的指标不会按 0% 触发风险。</p>${flt}${UI.card('', table, '', true)}`;
}

export const actions = {
  rkDetail(id) {
    const event = listRiskEvents(store.listTasks(), store.listAgentTasks()).find(event => event.id === id);
    if (!event) return UI.toast('该事件已不符合当前规则，请刷新列表');
    const metric = event.metric, rule = event.ruleSnapshot;
    UI.drawer(event.typeName, UI.kvTable([
      ['关联资产', UI.esc(event.targetName) + ' · ' + UI.esc(event.targetVersion)],
      ['风险等级', UI.riskBadge(event.risk)],
      ['触发条件', UI.esc(event.condition)],
      ['本次指标', UI.pct(event.value)],
      ['有效判定', `${metric.numerator} / ${metric.denominator}`],
      ['未参与判定', String(metric.unknown ?? '—')],
      ...(metric.name ? [['最高值归属', UI.esc(metric.name)]] : []),
      ['指标口径', UI.esc(metric.definition)],
      ['规则来源', rule.builtin ? '系统' : `用户自建 · ${UI.esc(event.ruleVersion)}`],
      ['适用范围', UI.esc(rule.targetId ? event.targetName : '全部同类资产')],
      ['负责人', UI.esc(rule.owner || '安全运营')],
      ['业务含义', UI.esc(rule.description || '根据任务指标触发的安全风险')],
    ]), UI.btn('关闭', { onclick: 'UI.closeDrawer()' }) + UI.btn('查看来源任务', { kind: 'primary', onclick: `UI.closeDrawer();App.${event.source === 'agent' ? 'openAgTask' : 'openTask'}('${event.taskId}')` }));
  },
  rkFilter(k, v) { view[k] = v; UI.resetPage('risk'); router.nav('risk', 'events'); },
  rkSet(source, id, status) {
    handled.set(`${source}:${id}`, status);
    UI.toast(`已标记为「${STATUS[status].label}」`);
    router.nav('risk', 'events');
  },
};
