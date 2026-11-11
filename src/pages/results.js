/* 演练结果：列表（默认按 ASR 降序）+ 选择对比任务弹窗 + 结果对比页 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { GUARD_NONE, OBJECT_TYPE } from '../domain/constants.js';

const view = { q: '', risk: 'all', targetId: 'all', sortDesc: true };
const pick = { base: null, other: null, mode: 'target' };

/* 对比类型：控制变量不同，候选任务的过滤条件不同 */
const COMPARE_MODES = {
  target: {
    label: '靶标对比', text: '仅靶标不同，攻击策略、蓝队与裁判一致',
    match: (a, b) => a.targetId !== b.targetId && a.strategyId === b.strategyId && a.judgeId === b.judgeId && (a.guardId || '') === (b.guardId || ''),
  },
  guard: {
    label: '蓝队对比', text: '仅蓝队不同，靶标、攻击策略与裁判一致',
    match: (a, b) => (a.guardId || '') !== (b.guardId || '') && a.targetId === b.targetId && a.strategyId === b.strategyId && a.judgeId === b.judgeId,
  },
};

const doneTasks = () => store.listTasks().filter((t) => t.status === 'done');
const guardText = (t) => (t.guardId ? UI.esc(t.guardName) : `<span class="faint">${GUARD_NONE}</span>`);

function rowsData() {
  let rows = doneTasks();
  if (view.targetId !== 'all') rows = rows.filter((t) => t.targetId === view.targetId);
  if (view.risk !== 'all') rows = rows.filter((t) => t.risk.key === view.risk);
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((t) => (t.targetName + t.strategyName).toLowerCase().includes(q));
  }
  rows.sort((a, b) => (view.sortDesc ? b.asr - a.asr : a.asr - b.asr));
  return rows;
}

export function resultsPage() {
  const rows = rowsData();
  const targets = [...new Map(store.listTasks().map((t) => [t.targetId, t.targetName])).entries()];

  const flt = UI.filters({
    search: { label: '搜索', id: 'rs-q', value: view.q, placeholder: '搜索靶标或策略名称', oninput: 'App.rsSearch(this.value)' },
    selects: [
      {
        label: '靶标', id: 'rs-target', value: view.targetId, onchange: "App.rsFilter('targetId',this.value)",
        options: [['all', '全部靶标'], ...targets],
      },
      {
        label: '风险等级', id: 'rs-risk', value: view.risk, onchange: "App.rsFilter('risk',this.value)",
        options: [['all', '全部等级'], ['critical', '高危'], ['high', '中危'], ['medium', '低危'], ['none', '安全']],
      },
    ],
    sort: { label: view.sortDesc ? 'ASR：从高到低' : 'ASR：从低到高', onclick: 'App.rsSort()' },
  });

  const table = UI.pagedTable(
    'results',
    [
      { title: '靶标名称', render: (t) => UI.esc(t.targetName) },
      { title: 'ASR', width: '90px', render: (t) => `<span class="num">${UI.pct(t.asr)}</span>` },
      { title: '风险等级', width: '100px', render: (t) => UI.riskBadge(t.risk) },
      { title: '攻击策略', render: (t) => UI.esc(t.strategyName) },
      { title: '蓝队', width: '110px', render: guardText },
      { title: '裁判模型', render: (t) => UI.esc(t.judgeName) },
      {
        title: '操作', width: '170px', cls: 'actions',
        render: (t) => `<div class="row-actions">
          ${UI.linkBtn('结果对比', { onclick: `App.compareOpen('${t.id}')` })}
          ${UI.moreMenu([['任务详情', `App.openTask('${t.id}')`], ['查看报告', `App.openReportOf('${t.id}')`]])}
        </div>`,
      },
    ],
    rows,
    '暂无演练结果',
  );

  return `${UI.pageHead('演练结果')}
  ${flt}
  ${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 选择对比任务 */
function pickerHTML() {
  const base = store.getTask(pick.base);
  const mode = COMPARE_MODES[pick.mode];
  const cands = doneTasks().filter((t) => t.id !== base.id && t.objectType === base.objectType && mode.match(base, t));
  const modes = Object.entries(COMPARE_MODES)
    .map(([k, m]) => `<button class="mode-card ${k === pick.mode ? 'on' : ''}" onclick="App.compareMode('${k}')">
      <b>${m.label}</b><span class="faint text-support">${m.text}</span></button>`)
    .join('');
  const list = cands.length
    ? cands
        .map(
          (t) => `<label class="pick-row ${pick.other === t.id ? 'on' : ''}">
          <input type="radio" name="cmp-other" value="${t.id}" ${pick.other === t.id ? 'checked' : ''}
            onchange="App.comparePick(this.value)" />
          <span class="pick-main"><b>${UI.esc(t.name)}</b>
            <span class="faint text-support">${UI.esc(t.targetName)} · ${UI.esc(t.strategyName)} · <span class="num">${UI.esc(t.finishedAt)}</span></span></span>
          <span class="num">${UI.pct(t.asr)}</span>
        </label>`,
        )
        .join('')
    : '<div class="empty"><strong>暂无可对比的任务</strong></div>';
  return `<div class="pick">
    <div class="sub-label">原始任务</div>
    <div class="pick-base"><b>${UI.esc(base.name)}</b>
      <span class="faint text-support">${UI.esc(OBJECT_TYPE[base.objectType].label)} · ${UI.esc(base.targetName)} · ${UI.esc(base.strategyName)}</span>
      <span class="num">${UI.pct(base.asr)}</span></div>
    <div class="sub-label mt-16">对比类型</div>
    <div class="mode-cards">${modes}</div>
    <div class="sub-label mt-16">可对比任务 <span class="num">${cands.length}</span></div>
    <div class="pick-list">${list}</div>
  </div>`;
}

function renderPicker() {
  UI.modal(
    '选择对比任务',
    pickerHTML(),
    `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${UI.btn('开始对比', { kind: 'primary', onclick: 'App.compareGo()' })}`,
  );
}

/* ---------------------------------------------------------------- 结果对比页 */
/* 版式参照用户给的图：两列卡片 + 三段对照表；变化值用带底色的小框放在对照组数值前，单位为 %（百分点差） */
const diffChip = (a, b) => {
  const d = (b - a) * 100;
  const cls = d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'same';
  const txt = cls === 'same' ? '0%' : `${d > 0 ? '+' : ''}${d.toFixed(1)}%`;
  return `<span class="diff-chip ${cls}">${txt}</span>`;
};
const asrVal = (x) => (x ? `<b class="num">${UI.pct(x.value)}</b> <span class="faint text-support num">攻破数/有效判定: ${x.breach}/${x.judged}</span>` : '<span class="faint">本次未覆盖</span>');

/* 对照表：第一列名称，第二列原始，第三列「变化框 + 对照」 */
function cmpRows(rows) {
  return `<div class="cmp-tbl">${rows
    .map((r) => `<div class="cmp-tr ${r.hl ? 'hl' : ''}">
      <div class="cmp-k">${r.k}</div><div class="cmp-a">${r.a}</div><div class="cmp-b">${r.b}</div></div>`)
    .join('')}</div>`;
}

function pairRows(rowsA, rowsB, keyOf, labelOf) {
  const keys = [...new Set([...rowsA, ...rowsB].map(keyOf))];
  return keys.map((k) => {
    const x = rowsA.find((r) => keyOf(r) === k);
    const y = rowsB.find((r) => keyOf(r) === k);
    return { k: UI.esc(labelOf(x || y)), a: asrVal(x), b: `${x && y ? diffChip(x.value, y.value) : ''}${asrVal(y)}` };
  });
}

export function comparePage(cur) {
  const [ia, ib] = String(cur.param || '').split('~');
  const a = store.getTask(ia);
  const b = store.getTask(ib);
  if (!a || !b) return `${UI.backBtn()}${UI.pageHead('结果对比')}<div class="empty"><strong>对比任务不存在</strong></div>`;

  const cfg = [
    ['靶标', (t) => UI.esc(t.targetName)],
    ['攻击策略', (t) => UI.esc(t.strategyName)],
    ['攻击题库', (t) => UI.esc(store.bankRefText(t.bankName, t.bankCount))],
    ['蓝队', guardText],
    ['裁判', (t) => UI.esc(t.judgeName)],
    ['执行并发', (t) => UI.esc(t.concurrency ?? '—')],
    ['有效判定', (t) => `<span class="num">${t.judged}</span>`],
  ].map(([k, f]) => {
    const va = f(a), vb = f(b), diff = va !== vb;
    return { k: `${UI.esc(k)}${diff ? ' <span class="badge amber">不同</span>' : ''}`, a: va, b: vb, hl: diff };
  });

  const asrCard = (t, role, chip = '', k = 'base') => `<div class="cmp-box ${k}">
    <span class="sub-label">${role}</span>
    <b class="cmp-title">${UI.esc(t.name)}</b>
    <span class="faint text-support">ASR</span>
    <div class="cmp-big">${chip}<strong class="num">${UI.pct(t.asr)}</strong></div>
    <span class="faint text-support num">攻破数/有效判定: ${t.breach}/${t.judged}</span>
  </div>`;

  return `${UI.backBtn()}
  ${UI.pageHead('结果对比', { actions: UI.btn('导出', { kind: 'primary', ico: 'download', onclick: 'App.compareExport()' }) })}
  <div class="cmp">
    <div class="cmp-pair">
      ${asrCard(a, '原始任务')}
      ${asrCard(b, '对照任务', diffChip(a.asr, b.asr), 'ctrl')}
    </div>
    ${UI.card('配置对照', cmpRows(cfg))}
    ${UI.card('攻击场景表现', cmpRows(pairRows(store.byScene(a), store.byScene(b), (x) => x.id, (x) => x.label)))}
    ${UI.card('攻击方法表现', cmpRows(pairRows(a.methodsAgg, b.methodsAgg, (x) => x.name, (x) => x.name)))}
  </div>`;
}

export const actions = {
  rsSearch(v) { view.q = v; UI.resetPage('results'); router.nav('exercise', 'results'); },
  rsFilter(k, v) { view[k] = v; UI.resetPage('results'); router.nav('exercise', 'results'); },
  rsSort() { view.sortDesc = !view.sortDesc; router.nav('exercise', 'results'); },
  compareOpen(id) {
    Object.assign(pick, { base: id, other: null, mode: 'target' });
    renderPicker();
  },
  compareMode(k) {
    Object.assign(pick, { mode: k, other: null });
    renderPicker();
  },
  comparePick(id) {
    pick.other = id;
    renderPicker();
  },
  compareGo() {
    if (!pick.other) return UI.toast('请选择对照任务');
    UI.closeModal();
    router.nav('exercise', 'compare', `${pick.base}~${pick.other}`);
  },
  /* 默认导出 PDF：走浏览器打印，打印样式只保留对比内容 */
  compareExport() {
    window.print();
  },
};
