/* 智能体演练 · 演练结果：按靶标智能体聚合，一个智能体一行。
 * 与模型演练的结果页不同：那边按单元列，这边按对象汇总。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { RISK_LABEL } from '../domain/constants.js';

const view = { q: '', sortKey: 'asr' };
const cmp = { picked: [] };

export function agentResultsPage() {
  let rows = store.agentResultRows();
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((r) => (r.agentName + r.frameworkLabel + r.baseModelName).toLowerCase().includes(q));
  }
  if (view.sortKey === 'completion') rows = [...rows].sort((a, b) => a.completion.value - b.completion.value);

  const flt = UI.filters({
    search: { label: '搜索', id: 'agr-q', value: view.q, placeholder: '搜索智能体 / 框架 / 基座模型', oninput: 'App.agrSearch(this.value)' },
    selects: [
      {
        label: '排序', id: 'agr-sort', value: view.sortKey, onchange: 'App.agrSort(this.value)',
        options: [['asr', 'ASR 从高到低'], ['name', '名称']],
      },
    ],
  });

  const table = UI.pagedTable(
    'ag-results',
    [
      { title: '靶标智能体', render: (r) => `<button class="link-btn" onclick="App.openAgObject('${r.agentId}')">${UI.esc(r.agentName)}</button>` },
      { title: '启动命令', render: (r) => (r.launchCmd !== '—' ? `<code>${UI.esc(r.launchCmd)}</code>` : '<span class="faint">—</span>') },
      { title: '基座模型', width: '170px', render: (r) => UI.esc(r.baseModelName) },
      { title: '覆盖题库', render: (r) => `<span class="tags">${r.bankNames.map((n) => UI.badge(n, 'gray')).join('')}</span>` },
      { title: '题目数', width: '80px', cls: 'num', render: (r) => `<span class="num">${r.agg.total}</span>` },
      { title: 'ASR', width: '80px', cls: 'num', render: (r) => `<span class="num">${UI.pct(r.agg.value)}</span>` },
      { title: '风险等级', width: '90px', render: (r) => UI.riskBadge(r.risk) },
      { title: '最近演练', width: '160px', cls: 'num', render: (r) => UI.esc(r.lastRunAt) },
      {
        title: '操作', width: '120px', cls: 'actions',
        render: (r) => `<div class="row-actions">
          ${UI.linkBtn('详情', { onclick: `App.openAgObject('${r.agentId}')` })}
          ${UI.linkBtn('对比', { onclick: `App.agrCompare('${r.agentId}')` })}
        </div>`,
      },
    ],
    rows,
    '暂无演练结果',
  );

  return `${UI.pageHead('演练结果')}${flt}${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 对象详情 */
export function agentObjectPage(cur) {
  const id = cur?.param;
  const r = store.agentResultRows().find((x) => x.agentId === id);
  if (!r) return `${UI.pageHead('智能体结果')}<div class="empty"><strong>暂无该智能体的演练结果</strong></div>`;

  const a = store.agentOf(id);
  const labelRows = r.labelsAgg.map((x) => `<tr>
    <td>${UI.badge(x.label, x.cls)}</td>
    <td class="num">${x.denominator}</td>
    <td class="num">${x.breach}</td>
    <td class="num">${x.asr === null ? '—' : UI.pct(x.asr)}</td>
  </tr>`).join('');

  const taskRows = r.tasks.map((t) => `<tr>
    <td><button class="link-btn" onclick="App.openAgTask('${t.id}')">${UI.esc(t.name)}</button></td>
    <td>${UI.esc(t.sceneBankName)}</td>
    <td class="num">${t.total}</td>
    <td class="num">${UI.pct(t.agg.value)}</td>
    <td class="num">${UI.esc(t.finishedAt || '—')}</td>
  </tr>`).join('');

  return `${UI.backBtn()}
  ${UI.pageHead(r.agentName, { extra: UI.riskBadge(r.risk) })}
  <div class="detail-grid">
    <div class="detail-left">
      ${UI.card('汇总', `<div class="rs">
        <div class="rs-top">
          ${UI.ring(r.agg.value, { size: 104, label: 'ASR', color: 'var(--vd-breach)', track: 'var(--vd-safe)' })}
          <div class="rs-main">
            ${UI.kvTable([
    ['累计题目', `<span class="num">${r.agg.total}</span>`],
    ['攻破题数', `<span class="num">${r.agg.breach}</span>`],
    ['异常题数', `<span class="num">${r.agg.unknown}</span>`],
    ['演练任务数', `<span class="num">${r.taskCount}</span>`],
  ])}
          </div>
        </div>
      </div>`)}
      ${UI.card('风险标签归因', `<p class="faint text-support">分母为涉及该标签的题数。标签来自题库标注。</p>
        <table class="kv-table tight">
          <thead><tr><th>风险标签</th><th class="num">涉及题数</th><th class="num">攻破</th><th class="num">攻破率</th></tr></thead>
          <tbody>${labelRows || '<tr><td colspan="4" class="empty-cell">暂无数据</td></tr>'}</tbody>
        </table>`, '', true)}
      ${UI.card('接入信息', UI.kvTable([
    ['启动命令', a?.launchCmd ? `<code>${UI.esc(a.launchCmd)}</code>` : '—'],
    ['容器镜像', a?.runnerImage ? `<code>${UI.esc(a.runnerImage)}</code>` : '—'],
    ['基座模型', UI.esc(a?.baseModelName || '—')],
    ['攻击入口', a?.surfaces?.length ? `${a.surfaces.length} 个（一期不使用）` : '<span class="faint">未声明</span>'],
  ]))}
    </div>
    <div class="detail-right">
      ${UI.card('演练任务', `<table class="kv-table tight">
        <thead><tr><th>任务</th><th>题库</th><th class="num">题数</th><th class="num">ASR</th><th class="num">完成时间</th></tr></thead>
        <tbody>${taskRows}</tbody></table>`, '', true)}
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- 对比 */
export function agentComparePage() {
  const rows = store.agentResultRows();
  if (rows.length < 2) {
    return `${UI.backBtn()}${UI.pageHead('智能体对比')}
      <div class="empty"><strong>至少需要两个智能体的演练结果</strong>
      <p class="faint">对比要求双方跑过同一题库快照，否则结果不可比</p></div>`;
  }

  const a = rows.find((r) => r.agentId === cmp.picked[0]) || rows[0];
  const b = rows.find((r) => r.agentId === cmp.picked[1]) || rows[1];

  /* 题集一致性校验：两边必须跑过同一批 task_id */
  const setOf = (r) => new Set(r.units.map((u) => u.sceneTaskId));
  const sa = setOf(a); const sb = setOf(b);
  const shared = [...sa].filter((x) => sb.has(x));
  const comparable = shared.length > 0;

  const sel = (cur, which) => `<select onchange="App.agrPick(${which},this.value)">
    ${rows.map((r) => `<option value="${r.agentId}" ${cur.agentId === r.agentId ? 'selected' : ''}>${UI.esc(r.agentName)}</option>`).join('')}
  </select>`;

  const labelKeys = [...new Set([...a.labelsAgg.map((x) => x.key), ...b.labelsAgg.map((x) => x.key)])];
  const pick = (r, k) => r.labelsAgg.find((x) => x.key === k);
  const labelRows = labelKeys.map((k) => {
    const xa = pick(a, k); const xb = pick(b, k);
    return `<tr>
      <td>${UI.badge(RISK_LABEL[k]?.label || k, RISK_LABEL[k]?.cls || 'gray')}</td>
      <td class="num">${xa ? UI.pct(xa.asr ?? 0) : '—'}</td>
      <td class="num">${xb ? UI.pct(xb.asr ?? 0) : '—'}</td>
    </tr>`;
  }).join('');

  /* 逐题差异：结果不同的排前面 */
  const ua = new Map(a.units.map((u) => [u.sceneTaskId, u]));
  const ub = new Map(b.units.map((u) => [u.sceneTaskId, u]));
  const diffRows = shared
    .map((tid) => ({ tid, va: ua.get(tid)?.verdict, vb: ub.get(tid)?.verdict }))
    .sort((x, y) => Number(y.va !== y.vb) - Number(x.va !== x.vb))
    .map((d) => `<tr class="${d.va !== d.vb ? 'diff' : ''}">
      <td class="num">${UI.esc(d.tid)}</td>
      <td>${verdictCell(d.va)}</td>
      <td>${verdictCell(d.vb)}</td>
    </tr>`).join('');

  return `${UI.backBtn()}
  ${UI.pageHead('Agent 对比')}
  <div class="cmp-pickers">${sel(a, 0)}<span class="faint">对比</span>${sel(b, 1)}</div>
  ${comparable ? '' : `<div class="empty"><strong>两者没有共同题目，无法逐题对比</strong>
    <p class="faint">对比要求双方跑过同一题库快照</p></div>`}
  ${UI.card('总体', `<table class="kv-table tight">
    <thead><tr><th>指标</th><th class="num">${UI.esc(a.agentName)}</th><th class="num">${UI.esc(b.agentName)}</th></tr></thead>
    <tbody>
      <tr><td>ASR</td><td class="num">${UI.pct(a.agg.value)}</td><td class="num">${UI.pct(b.agg.value)}</td></tr>
      <tr><td>攻破题数</td><td class="num">${a.agg.breach}</td><td class="num">${b.agg.breach}</td></tr>
      <tr><td>题目数</td><td class="num">${a.agg.total}</td><td class="num">${b.agg.total}</td></tr>
      <tr><td>共同题目</td><td class="num" colspan="2">${shared.length}</td></tr>
    </tbody></table>`, '', true)}
  ${UI.card('按风险标签', `<table class="kv-table tight">
    <thead><tr><th>标签</th><th class="num">${UI.esc(a.agentName)}</th><th class="num">${UI.esc(b.agentName)}</th></tr></thead>
    <tbody>${labelRows || '<tr><td colspan="3" class="empty-cell">暂无数据</td></tr>'}</tbody></table>`, '', true)}
  ${comparable ? UI.card('逐题差异', `<p class="faint text-support">结果不同的题目排在前面，这些最有分析价值。</p>
    <table class="kv-table tight">
      <thead><tr><th>题目</th><th>${UI.esc(a.agentName)}</th><th>${UI.esc(b.agentName)}</th></tr></thead>
      <tbody>${diffRows}</tbody></table>`, '', true) : ''}`;
}

function verdictCell(v) {
  if (!v) return '<span class="faint">未跑</span>';
  const map = { breach: 'red', safe: 'green', error: 'amber' };
  const label = { breach: '已攻破', safe: '已守住', error: '异常' };
  return UI.badge(label[v] || v, map[v] || 'gray');
}

export const actions = {
  agrSearch(v) { view.q = v; UI.resetPage('ag-results'); router.nav('agent', 'ag-results'); },
  agrSort(v) { view.sortKey = v; router.nav('agent', 'ag-results'); },
  openAgObject(id) { router.nav('agent', 'ag-object', id); },
  agrCompare(id) {
    if (id) cmp.picked[0] = id;
    router.nav('agent', 'ag-compare');
  },
  agrPick(which, id) {
    cmp.picked[which] = id;
    router.nav('agent', 'ag-compare');
  },
};
