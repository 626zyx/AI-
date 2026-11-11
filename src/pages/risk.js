/* 风险中心：只放已触发的风险事件。触发与分级规则在平台管理 · 风险管理里设置。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';

const view = { level: 'all', q: '' };

export function riskPage() {
  const rule = store.riskRule;
  const asrType = store.riskTypes.find((x) => x.id === 'exercise-asr');
  const events = asrType.enabled ? store.listTasks().filter((t) => t.status === 'done' && t.agg.value > rule.trigger) : [];
  let rows = view.level === 'all' ? events : events.filter((t) => t.risk.key === view.level);
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((t) => (t.targetName + t.name).toLowerCase().includes(q));
  }
  rows = [...rows].sort((a, b) => b.agg.value - a.agg.value);

  const flt = UI.filters({
    search: { label: '搜索', id: 'rk-q', value: view.q, placeholder: '搜索风险事件、靶标或来源任务', oninput: 'App.rkFilter("q",this.value)' },
    selects: [{
      label: '风险等级', id: 'rk-level', value: view.level, onchange: 'App.rkFilter("level",this.value)',
      options: [['all', '全部等级'], ['critical', '高危'], ['high', '中危'], ['medium', '低危']],
    }],
    right: `<span class="faint text-support">${UI.linkBtn('触发与分级规则', { onclick: "App.go('platform','riskrule')" })}</span>`,
  });

  const table = UI.pagedTable(
    'risk',
    [
      { title: '风险事件', render: (t) => `${UI.esc(asrType.name)}<div class="faint text-support">${UI.esc(t.targetName)} · ASR ${UI.pct(t.agg.value)}</div>` },
      { title: '风险等级', width: '100px', render: (t) => UI.riskBadge(t.risk) },
      { title: '来源任务', render: (t) => `<button class="link-btn" onclick="App.openTask('${t.id}')">${UI.esc(t.name)}</button>` },
      { title: '触发时间', width: '160px', cls: 'num', render: (t) => UI.esc(t.finishedAt) },
    ],
    rows,
    '暂无风险事件',
  );
  return `${UI.pageHead('风险中心')}${flt}${UI.card('', table, '', true)}`;
}

export const actions = {
  rkFilter(k, v) { view[k] = v; UI.resetPage('risk'); router.nav('risk', 'events'); },
};
