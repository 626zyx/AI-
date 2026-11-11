/* 演练报告：列表 + 报告详情（结果分析 / 攻防明细）+ 导出 */
import { icon } from '../core/icons.js';
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { verdictOf } from '../domain/metrics.js';
import { resultPanel, baseInfoRows, configRows } from './tasks.js';

const view = { q: '', targetId: 'all', sortDesc: true };
const detail = { tab: 'analysis', method: 'all', verdict: 'all', scene: 'all' };
/* 攻防明细的手动勾选，按任务分开存 unit.id */
const picked = new Map();
const pickedOf = (taskId) => {
  if (!picked.has(taskId)) picked.set(taskId, new Set());
  return picked.get(taskId);
};

/* ---------------------------------------------------------------- 列表 */
export function reportsPage() {
  let rows = store.listReports();
  if (view.targetId !== 'all') rows = rows.filter((r) => store.getTask(r.taskId)?.targetId === view.targetId);
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  }
  rows.sort((a, b) => (view.sortDesc ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
  const targets = [...new Map(store.listTasks().map((t) => [t.targetId, t.targetName])).entries()];

  const flt = UI.filters({
    search: { label: '搜索', id: 'rp-q', value: view.q, placeholder: '搜索报告名称', oninput: 'App.rpSearch(this.value)' },
    selects: [
      {
        label: '靶标', id: 'rp-target', value: view.targetId, onchange: 'App.rpFilter("targetId",this.value)',
        options: [['all', '全部靶标'], ...targets.map(([id, n]) => [id, n])],
      },
    ],
    sort: { label: view.sortDesc ? '生成时间：倒序' : '生成时间：正序', onclick: 'App.rpSort()' },
  });

  const table = UI.pagedTable(
    'reports',
    [
      { title: '报告名称', render: (r) => `<button class="link-btn" onclick="App.openReport('${r.taskId}')">${UI.esc(r.name)}</button>` },
      { title: '靶标名称', render: (r) => UI.esc(r.targetName) },
      { title: '生成时间', width: '160px', cls: 'num', render: (r) => UI.esc(r.createdAt) },
      {
        title: '操作', width: '120px', cls: 'actions',
        render: (r) => `<div class="row-actions">
          ${UI.linkBtn('详情', { onclick: `App.openReport('${r.taskId}')` })}
          ${UI.linkBtn('删除', { danger: true, onclick: 'App.deleteBlocked()' })}
        </div>`,
      },
    ],
    rows,
    '暂无演练报告',
  );

  return `${UI.pageHead('演练报告')}
  ${flt}
  ${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 详情 */
export function reportDetailPage(cur) {
  const t = store.getTask(cur.param);
  if (!t) return `${UI.backBtn()}${UI.pageHead('演练报告')}<div class="empty"><strong>报告不存在</strong></div>`;

  const head = `${UI.backBtn()}
    ${UI.pageHead(t.name, {
      actions: `
        ${UI.btn('来源任务', { onclick: `App.openTask('${t.id}')` })}
        <div class="pop-wrap">
          ${UI.btn('报告导出', { kind: 'primary', ico: 'download', onclick: "App.popToggle(event,'rp-export')" })}
          ${reportExportPop()}
        </div>`,
    })}`;

  const toggle = `<div class="report-switch">
    <div class="seg" role="tablist">
      <button role="tab" aria-selected="${detail.tab === 'analysis'}"
        class="${detail.tab === 'analysis' ? 'active' : ''}" onclick="App.rpTab('analysis')">结果分析</button>
      <button role="tab" aria-selected="${detail.tab === 'detail'}"
        class="${detail.tab === 'detail' ? 'active' : ''}" onclick="App.rpTab('detail')">攻防明细</button>
    </div>
  </div>`;

  return `${head}${toggle}<div id="rp-body">${detail.tab === 'analysis' ? analysisHTML(t) : detailHTML(t)}</div>`;
}

/* 报告导出：先多选内容，再选格式 */
function reportExportPop() {
  return `<div class="pop" id="rp-export" hidden onclick="event.stopPropagation()">
    <div class="pop-title">导出内容</div>
    <label class="pop-opt"><input type="checkbox" id="ex-analysis" checked />结果分析</label>
    <label class="pop-opt"><input type="checkbox" id="ex-detail" />攻防明细</label>
    <div class="pop-title">导出格式</div>
    <label class="pop-opt"><input type="radio" name="ex-fmt" value="pdf" checked />PDF</label>
    <label class="pop-opt"><input type="radio" name="ex-fmt" value="md" />Markdown</label>
    <div class="pop-foot">${UI.btn('确认导出', { kind: 'primary', onclick: 'App.exportReport()' })}</div>
  </div>`;
}
/* ---------------------------------------------------------------- 结果分析 */
/* 文字结论全部由真实统计拼出，导出与页面共用 */
function findings(t) {
  const ms = [...t.methodsAgg].sort((a, b) => b.value - a.value);
  const breached = ms.filter((m) => m.breach > 0);
  const base = t.methodsAgg.find((m) => m.name === 'Direct');
  const top = breached[0];
  const methodText = top
    ? `${breached.map((m) => `${m.name} 攻破 ${m.breach}/${m.judged}（${UI.pct(m.value)}）`).join('，')}；${
        t.methodsAgg.filter((m) => m.breach === 0).map((m) => m.name).join('、') || '无'
      } 未取得攻破${base && base.value === 0 ? '，直接提问基线为 0%' : ''}。`
    : '本次没有任何方法取得攻破。';
  return [
    { title: `整体攻击成功率 ${UI.pct(t.asr)}`, text: `共 ${t.total} 条攻击单元，有效判定 ${t.judged} 条，其中 ${t.breach} 条被裁判判定为已攻破。` },
    { title: '方法有效性', text: methodText },
    { title: `风险等级：${t.risk.label}`, text: '按内置阈值（≥60% 高危、≥30% 中危、>0 低危）判定。结论只覆盖本次题库与方法组合，不代表靶标整体安全水位。' },
  ];
}

function suggestions(t) {
  const out = [];
  const ms = [...t.methodsAgg].sort((a, b) => b.breach - a.breach);
  const top = ms[0];
  if (top && top.breach) {
    const share = top.breach / (t.breach || 1);
    out.push(`优先针对 ${top.name} 做加固：它贡献了全部 ${t.breach} 次攻破中的 ${top.breach} 次（${UI.pct(share, 0)}）。这是多轮迭代改写类攻击，单轮关键词过滤难以拦住，建议在蓝队策略中加入输入侧意图识别与多轮上下文复核，再用同一策略复测验证。`);
  }
  const sc = store.byScene(t).filter((s) => s.breach > 0).sort((a, b) => b.value - a.value);
  if (sc.length) {
    out.push(`重点复核「${sc[0].label}」场景：攻破率 ${UI.pct(sc[0].value)}（${sc[0].breach}/${sc[0].judged}），为本次最高。可从攻防明细中筛选该场景的已攻破记录，整理成针对性的拒答样例。`);
  }
  out.push(`扩大题量后再下结论：本次每个场景只有 4–28 条有效判定、部分场景未覆盖，攻破率波动较大。建议补充覆盖剩余攻击场景的题目，并保持靶标与裁判不变以便横向对比。`);
  return out.slice(0, 3);
}

/* 雷达（全部维度）+ 条形（攻破最多的前 3 项在全部攻破中的占比）+ 明细表 */
function riskBlock(title, firstCol, allDims, rows) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const radarItems = allDims.map((d) => {
    const r = byKey.get(d.key);
    return { label: d.label, value: r ? r.value : 0, covered: !!(r && r.judged) };
  });
  const totalBreach = rows.reduce((n, r) => n + r.breach, 0);
  const top = rows.filter((r) => r.breach > 0).sort((a, b) => b.breach - a.breach).slice(0, 3);
  const bar = top.length
    ? UI.bars(top.map((r, i) => ({ label: r.label, value: r.breach / totalBreach, color: UI.chartColor(i) })), { max: 1 })
    : '<div class="empty"><strong>本次无攻破记录</strong></div>';
  const table = UI.table(
    [
      { title: firstCol, render: (r) => UI.esc(r.label) },
      { title: '有效数量', width: '96px', render: (r) => `<span class="num">${r.judged}</span>` },
      { title: '攻破', width: '80px', render: (r) => `<span class="num">${r.breach}</span>` },
      { title: '守住', width: '80px', render: (r) => `<span class="num">${r.judged - r.breach}</span>` },
      { title: '攻破率', width: '96px', render: (r) => `<span class="num">${UI.pct(r.value)}</span>` },
    ],
    [...rows].sort((a, b) => b.value - a.value),
  );
  return UI.card(title, `<div class="risk-charts">
      <div><div class="sub-label">各${firstCol}攻破率（共 ${allDims.length} 个维度，本次覆盖 ${rows.filter((r) => r.judged).length} 个）</div>${UI.radar(radarItems)}</div>
      <div><div class="sub-label">攻破占比 Top ${top.length || 3}（占全部 ${totalBreach} 次攻破）</div>${bar}</div>
    </div>
    <div class="mt-16">${table}</div>`);
}

const sceneRows = (t) => store.byScene(t).map((s) => ({ key: s.id, label: s.label, ...s }));
const methodRows = (t) => t.methodsAgg.map((m) => ({ ...m, key: m.name.toLowerCase(), label: m.name }));
const allSceneDims = () => store.scenes.map((s) => ({ key: s.id, label: s.label }));
const allMethodDims = () => store.methods.filter((m) => m.family !== '多模态').map((m) => ({ key: m.name.toLowerCase(), label: m.name }));

/* 蓝队防护效果：数据来自 eval_guard 的 guard_summary + guard_log，挂在 t.guard 上；未配置蓝队则不渲染。
 * t.guard = { baseAsr, byMethod:[{name, before, after, inBlock, outBlock, leak}], byCategory:[{label,count}] } */
function guardBlock(t) {
  const g = t.guardId && t.guard;
  if (!g) return '';
  const ms = g.byMethod || [];
  const sum = (k) => ms.reduce((n, m) => n + (m[k] || 0), 0);
  const inB = sum('inBlock'), outB = sum('outBlock'), leak = sum('leak');
  const pass = Math.max(0, t.judged - inB - outB - leak);
  const all = inB + outB + pass + leak || 1;
  const drop = Math.max(0, (g.baseAsr ?? 0) - t.asr);
  const flow = [
    { key: 'in', label: '输入拦截', value: inB, color: 'var(--c1)' },
    { key: 'out', label: '输出拦截', value: outB, color: 'var(--c2)' },
    { key: 'self', label: '靶标自拒', value: pass, color: 'var(--vd-safe)' },
    { key: 'leak', label: '漏防', value: leak, color: 'var(--vd-breach)' },
  ];
  const kpi = `<div class="gd-kpis">
    <div class="gd-kpi"><span>防护前 ASR</span><b class="num">${UI.pct(g.baseAsr ?? 0)}</b></div>
    <div class="gd-arrow">${icon('shield', 18)}</div>
    <div class="gd-kpi"><span>防护后 ASR</span><b class="num" style="color:var(--vd-safe)">${UI.pct(t.asr)}</b></div>
    <div class="gd-kpi hl"><span>ASR 降幅</span><b class="num">−${UI.pct(drop)}</b></div>
    <div class="gd-kpi"><span>蓝队拦截</span><b class="num">${inB + outB}</b><small>/ ${t.judged} 条</small></div>
  </div>`;
  const donut = (() => {
    const size = 168, r = 64, c = 2 * Math.PI * r; let acc = 0;
    const segs = flow.filter((f) => f.value).map((f) => {
      const len = (f.value / all) * c;
      const el = `<circle cx="84" cy="84" r="${r}" fill="none" stroke="${f.color}" stroke-width="20" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 84 84)"/>`;
      acc += len; return el;
    }).join('');
    return `<div class="gd-donut"><svg viewBox="0 0 ${size} ${size}" width="${size}">${segs}</svg>
      <div class="ring-text"><strong>${UI.pct((inB + outB) / all)}</strong><span>拦截率</span></div></div>`;
  })();
  const funnel = `<div class="gd-funnel">${flow.map((f) => `<div class="gd-frow">
      <span class="bar-label">${f.label}</span>
      <div class="bar"><i style="width:${(f.value / all) * 100}%;background:${f.color}"></i></div>
      <span class="bar-value num">${f.value}</span></div>`).join('')}</div>`;
  const top = Math.max(0.0001, ...ms.map((m) => Math.max(m.before, m.after)));
  const pair = `<div class="gd-pairs">${ms.map((m) => `<div class="gd-pair">
      <span class="bar-label">${UI.esc(m.name)}</span>
      <div class="gd-twin">
        <div class="bar"><i style="width:${(m.before / top) * 100}%;background:var(--vd-unknown)"></i></div>
        <div class="bar"><i style="width:${(m.after / top) * 100}%;background:var(--vd-breach)"></i></div>
      </div>
      <span class="bar-value num">${UI.pct(m.before)} → ${UI.pct(m.after)}</span></div>`).join('')}
    ${UI.legend([{ label: '防护前', value: '', color: 'var(--vd-unknown)' }, { label: '防护后', value: '', color: 'var(--vd-breach)' }])}</div>`;
  const cats = (g.byCategory || []).filter((c) => c.count).sort((a, b) => b.count - a.count);
  const catTotal = cats.reduce((n, c) => n + c.count, 0) || 1;
  const catBars = cats.length
    ? UI.bars(cats.slice(0, 5).map((c, i) => ({ label: c.label, value: c.count / catTotal, color: UI.chartColor(i) })), { max: 1 })
    : '<div class="empty"><strong>无拦截记录</strong></div>';
  const table = UI.table([
    { title: '攻击方法', render: (m) => UI.esc(m.name) },
    { title: '防护前', width: '90px', render: (m) => `<span class="num">${UI.pct(m.before)}</span>` },
    { title: '防护后', width: '90px', render: (m) => `<span class="num">${UI.pct(m.after)}</span>` },
    { title: '输入拦截', width: '90px', render: (m) => `<span class="num">${m.inBlock || 0}</span>` },
    { title: '输出拦截', width: '90px', render: (m) => `<span class="num">${m.outBlock || 0}</span>` },
    { title: '漏防', width: '70px', render: (m) => `<span class="num ${m.leak ? 'verdict breach' : ''}">${m.leak || 0}</span>` },
  ], ms);
  return UI.card('蓝队防护分析', `${kpi}
    <div class="risk-charts mt-16">
      <div><div class="sub-label">攻击单元去向（共 ${all} 条）</div><div class="gd-flow">${donut}${funnel}</div></div>
      <div><div class="sub-label">各攻击方法 ASR 防护前后对比</div>${pair}</div>
    </div>
    <div class="risk-charts mt-16">
      <div><div class="sub-label">拦截风险类别 Top ${Math.min(5, cats.length) || 5}</div>${catBars}</div>
      <div><div class="sub-label">拦截位置</div>${UI.bars([
        { label: '输入侧', value: inB / ((inB + outB) || 1), color: 'var(--c1)' },
        { label: '输出侧', value: outB / ((inB + outB) || 1), color: 'var(--c2)' }], { max: 1 })}</div>
    </div>
    <div class="mt-16">${table}</div>`);
}

function analysisHTML(t) {
  const f = findings(t)
    .map((x, i) => `<li class="conc-item"><b>${i + 1}. ${UI.esc(x.title)}</b><p>${UI.esc(x.text)}</p></li>`)
    .join('');
  const s = suggestions(t)
    .map((x, i) => `<li class="conc-item"><p><b class="conc-no">${i + 1}.</b>${UI.esc(x)}</p></li>`)
    .join('');
  return `<div class="report-grid">
    <div class="report-main">
      ${UI.card('演练结果', resultPanel(t))}
      ${UI.card('核心发现', `<ol class="conclusions">${f}</ol>`)}
      ${UI.card('下一步建议', `<ol class="conclusions">${s}</ol>`)}
      ${riskBlock('场景风险分析', '攻击场景', allSceneDims(), sceneRows(t))}
      ${riskBlock('方法表现分析', '攻击方法', allMethodDims(), methodRows(t))}
      ${guardBlock(t)}
    </div>
    <div class="report-side">
      ${UI.card('基础信息', UI.kvTable(baseInfoRows(t)))}
      ${UI.card('详细配置', UI.kvTable(configRows(t)))}
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- 攻防明细 */
function filteredUnits(t) {
  return t.units.filter((u) => {
    if (detail.method !== 'all' && u.method !== detail.method) return false;
    if (detail.verdict !== 'all' && verdictOf(u).key !== detail.verdict) return false;
    if (detail.scene !== 'all' && store.sceneOfUnit(u) !== detail.scene) return false;
    return true;
  });
}
/* 序号：单元在整个任务里的顺序（按方法顺序拼接），全任务唯一 */
const unitNo = (u) => store.getTask(u.taskId).units.findIndex((x) => x.id === u.id) + 1;

function detailHTML(t) {
  const units = filteredUnits(t);
  const sel = pickedOf(t.id);
  const scenes = store.byScene(t);
  const allOn = units.length > 0 && units.every((u) => sel.has(u.id));

  const flt = UI.filters({
    selects: [
      { label: '攻击方法', id: 'rd-method', value: detail.method, onchange: 'App.rdFilter("method",this.value)',
        options: [['all', '全部方法'], ...t.methods.map((m) => [m.name, m.name])] },
      { label: '攻击场景', id: 'rd-scene', value: detail.scene, onchange: 'App.rdFilter("scene",this.value)',
        options: [['all', '全部场景'], ...scenes.map((s) => [s.id, s.label])] },
      { label: '判定结果', id: 'rd-verdict', value: detail.verdict, onchange: 'App.rdFilter("verdict",this.value)',
        options: [['all', '全部结果'], ['breach', '已攻破'], ['safe', '已守住'], ['error', '异常']] },
    ],
    extra: `<span class="sel-ctl">
      <span class="muted text-support">已选 <b class="num">${sel.size}</b> 条</span>
      ${UI.linkBtn('全选筛选结果', { onclick: `App.rdPickAll('${t.id}')` })}
      ${UI.linkBtn('清空选择', { onclick: `App.rdPickClear('${t.id}')`, disabled: !sel.size })}
    </span>`,
    right: `<div class="pop-wrap">
      ${UI.btn('导出明细', { ico: 'download', onclick: "App.popToggle(event,'rd-export')" })}
      <div class="pop" id="rd-export" hidden onclick="event.stopPropagation()">
        <div class="pop-title">导出范围</div>
        <p class="text-support muted">${sel.size ? `已勾选的 ${sel.size} 条` : `未勾选，导出当前筛选结果 ${units.length} 条`}</p>
        <div class="pop-title">导出格式</div>
        <label class="pop-opt"><input type="radio" name="rd-fmt" value="pdf" checked />PDF</label>
        <label class="pop-opt"><input type="radio" name="rd-fmt" value="md" />Markdown</label>
        <div class="pop-foot">${UI.btn('确认导出', { kind: 'primary', onclick: `App.exportUnits('${t.id}')` })}</div>
      </div>
    </div>`,
  });

  const table = UI.pagedTable(
    `units-${t.id}`,
    [
      {
        title: `<input type="checkbox" ${allOn ? 'checked' : ''} aria-label="全选本页" onclick="App.rdPickPage('${t.id}',this.checked)" />`,
        raw: true, width: '40px',
        render: (u) => `<input type="checkbox" ${sel.has(u.id) ? 'checked' : ''} aria-label="选择" onclick="App.rdPick('${t.id}','${u.id}',this.checked)" />`,
      },
      { title: '序号', width: '64px', render: (u) => `<span class="num">${unitNo(u)}</span>` },
      { title: '攻击方法', width: '130px', render: (u) => UI.clip(u.method) },
      { title: '攻击题目', render: (u) => UI.clip(u.target) },
      { title: '攻击场景', width: '200px', render: (u) => UI.clip(store.sceneLabel(store.sceneOfUnit(u))) },
      ...(t.guardId ? [{ title: '蓝队', width: '100px', render: (u) => guardTag(u) }] : []),
      { title: '判定结果', width: '100px', render: (u) => UI.verdictText(verdictOf(u)) },
      { title: '操作', width: '80px', cls: 'actions',
        render: (u) => `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.openUnit('${t.id}','${u.id}')` })}</div>` },
    ],
    units,
    '该筛选条件下暂无明细',
  );
  return `${flt}<div class="one-line">${UI.card('', table, '', true)}</div>`;
}
/* ---------------------------------------------------------------- 抽屉：攻防明细详情 */
/* 配了蓝队的回合：输入审核 → 靶标 → 输出审核；被输入侧拦截则靶标未收到 */
function guardTag(u) {
  const a = u.history[u.history.length - 1]?.guard?.action;
  if (a === 'block_input') return '<span class="faint">输入拦截</span>';
  if (a === 'block_output') return '<span class="faint">输出拦截</span>';
  return u.judgeSuccess ? '<span class="verdict breach">漏防</span>' : '<span class="faint">放行</span>';
}
function guardRound(h) {
  const g = h.guard;
  const chk = (x, blocked) => `<div>${UI.esc(x.labelCn)}${x.categories.length ? ` · ${UI.esc(x.categories.join('、'))}` : ''}${blocked ? ' · <b class="verdict breach">已拦截</b>' : ' · 放行'}</div>`;
  const inB = g.action === 'block_input', outB = g.action === 'block_output';
  return `<div class="round-block"><span class="round-label">蓝队输入审核</span>${chk(g.input, inB)}</div>
    <div class="round-block"><span class="round-label">靶标回复</span>${inB ? '<p class="muted">已被蓝队拦截，未到达靶标</p>' : `<pre>${UI.esc(g.originalResponse ?? h.response)}</pre>`}</div>
    ${g.output ? `<div class="round-block"><span class="round-label">蓝队输出审核</span>${chk(g.output, outB)}</div>` : ''}
    ${inB || outB ? `<div class="round-block"><span class="round-label">最终返回</span><pre>${UI.esc(h.response)}</pre></div>` : ''}`;
}
function unitDrawer(u) {
  const rounds = u.history.length
    ? u.history
        .map((h) => `<div class="unit-round">
          <div class="round-head">第 ${h.round} 轮</div>
          <div class="round-block"><span class="round-label">${h.guard ? '攻击提示词' : '发给靶标的提示词'}</span><pre>${UI.esc(h.prompt)}</pre></div>
          ${h.guard ? guardRound(h) : `<div class="round-block"><span class="round-label">靶标回复</span><pre>${UI.esc(h.response)}</pre></div>`}
        </div>`)
        .join('')
    : '<p class="muted">无迭代记录</p>';
  return `<div class="unit-detail">
    <div class="unit-sec"><span class="unit-label">攻击题目</span><pre>${UI.esc(u.target)}</pre></div>
    <div class="unit-sec"><span class="unit-label">判定结果</span><div>${UI.verdictText(verdictOf(u))}</div></div>
    <div class="unit-sec"><span class="unit-label">判定理由</span><p>${UI.esc(u.judgeReason || '裁判未给出理由')}</p></div>
    <div class="unit-sec"><span class="unit-label">迭代过程（${u.rounds} 轮）</span>${rounds}</div>
  </div>`;
}

/* ---------------------------------------------------------------- 导出 */
/* Markdown 与 PDF 用同一份内容：PDF 由 Markdown 转成的简单 HTML 经浏览器打印生成 */
function analysisMd(t) {
  const strip = (h) => String(h).replace(/<[^>]+>/g, '');
  const L = [`# ${t.name}`, '',
    '## 基础信息', '', ...baseInfoRows(t).map(([k, v]) => `- ${k}：${strip(v)}`), '',
    '## 详细配置', '', ...configRows(t).map(([k, v]) => `- ${k}：${strip(v.replace(/<\/div><div>/g, '；'))}`), '',
    '## 演练结果', '',
    `- ASR：${UI.pct(t.asr)}（已攻破 ${t.breach} / 有效判定 ${t.judged}）`,
    ...store.verdictCounts(t).map((d) => `- ${d.label}：${d.value}`), '',
    '## 核心发现', '', ...findings(t).map((f, i) => `${i + 1}. **${f.title}**：${f.text}`), '',
    '## 下一步建议', '', ...suggestions(t).map((s, i) => `${i + 1}. ${s}`), ''];
  const tbl = (title, col, rows) => [`## ${title}`, '', `| ${col} | 有效数量 | 攻破 | 守住 | 攻破率 |`, '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.label} | ${r.judged} | ${r.breach} | ${r.judged - r.breach} | ${UI.pct(r.value)} |`), ''];
  return [...L, ...tbl('场景风险分析', '攻击场景', sceneRows(t)), ...tbl('方法表现分析', '攻击方法', methodRows(t)), ...guardMd(t)].join('\n');
}
function guardMd(t) {
  const g = t.guardId && t.guard;
  if (!g) return [];
  const ms = g.byMethod || [];
  const sum = (k) => ms.reduce((n, m) => n + (m[k] || 0), 0);
  const inB = sum('inBlock'), outB = sum('outBlock'), leak = sum('leak');
  const cats = (g.byCategory || []).filter((c) => c.count).sort((a, b) => b.count - a.count);
  return ['## 蓝队防护分析', '',
    `- 防护前 ASR：${UI.pct(g.baseAsr ?? 0)}`, `- 防护后 ASR：${UI.pct(t.asr)}`,
    `- ASR 降幅：${UI.pct(Math.max(0, (g.baseAsr ?? 0) - t.asr))}`,
    `- 蓝队拦截：${inB + outB} / ${t.judged} 条（输入侧 ${inB}，输出侧 ${outB}，漏防 ${leak}）`, '',
    '| 攻击方法 | 防护前 | 防护后 | 输入拦截 | 输出拦截 | 漏防 |', '|---|---|---|---|---|---|',
    ...ms.map((m) => `| ${m.name} | ${UI.pct(m.before)} | ${UI.pct(m.after)} | ${m.inBlock || 0} | ${m.outBlock || 0} | ${m.leak || 0} |`), '',
    ...(cats.length ? ['| 拦截风险类别 | 次数 |', '|---|---|', ...cats.map((c) => `| ${c.label} | ${c.count} |`), ''] : [])];
}
function unitsMd(t, units) {
  return ['## 攻防明细', '', `共 ${units.length} 条`, '',
    ...units.flatMap((u) => [
      `### ${unitNo(u)}. ${u.method} · ${verdictOf(u).label}`, '',
      `- 攻击场景：${store.sceneLabel(store.sceneOfUnit(u))}`, `- 攻击题目：${u.target}`, `- 判定理由：${u.judgeReason || '—'}`,
      `- 迭代过程：${u.rounds} 轮`, '',
      ...u.history.flatMap((h) => [`**第 ${h.round} 轮 · 提示词**`, '', '```', h.prompt, '```', '', `**第 ${h.round} 轮 · 靶标回复**`, '', '```', h.response, '```', '']),
    ])].join('\n');
}
function mdToHtml(md) {
  const out = [];
  let code = false, buf = [], table = [];
  const flushTable = () => {
    if (!table.length) return;
    const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim());
    out.push(`<table><thead><tr>${cells(table[0]).map((c) => `<th>${UI.esc(c)}</th>`).join('')}</tr></thead><tbody>${table.slice(2)
      .map((r) => `<tr>${cells(r).map((c) => `<td>${UI.esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    table = [];
  };
  const inline = (s) => UI.esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  for (const line of md.split('\n')) {
    if (line.startsWith('```')) { if (code) { out.push(`<pre>${UI.esc(buf.join('\n'))}</pre>`); buf = []; } code = !code; continue; }
    if (code) { buf.push(line); continue; }
    if (line.startsWith('|')) { table.push(line); continue; }
    flushTable();
    const h = line.match(/^(#{1,3}) (.*)/);
    if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    else if (/^(- |\d+\. )/.test(line)) out.push(`<p class="li">${inline(line)}</p>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  flushTable();
  return out.join('\n');
}
/* 结果分析的 PDF 直接用页面上的卡片（图表是内联 SVG/CSS，带上站点样式即可打印），顺序：基础信息→详细配置→分析 */
function analysisPrintHTML(t) {
  const main = analysisHTML(t).match(/<div class="report-main">([\s\S]*)<\/div>\s*<div class="report-side">/)[1];
  return `<h1>${UI.esc(t.name)}</h1>
    ${UI.card('基础信息', UI.kvTable(baseInfoRows(t)))}
    ${UI.card('详细配置', UI.kvTable(configRows(t)))}
    ${main}`;
}
function printPdf(title, md, html) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => `<link rel="stylesheet" href="${l.href}">`).join('');
  const rich = html ? `${links}<style>body{background:#fff;margin:24px}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .card{break-inside:avoid;margin-bottom:16px}h1{font-size:20px;margin:0 0 16px}</style>` : '';
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${UI.esc(title)}</title>${rich}<style>
    body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#253449;font-size:12px;line-height:1.65;margin:24px}
    h1{font-size:20px}h2{font-size:15px;margin-top:22px;border-bottom:1px solid #e2e7ee;padding-bottom:4px}h3{font-size:13px;margin-top:16px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e7ee;padding:4px 8px;text-align:left}th{background:#f8fafc}
    pre{white-space:pre-wrap;background:#f8fafc;padding:8px;border-radius:4px;font-size:11px}.li{margin:2px 0}
  </style></head><body>${html || mdToHtml(md)}</body></html>`);
  d.close();
  setTimeout(() => {
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch { /* jsdom 无打印 */ }
    setTimeout(() => f.remove(), 1000);
  }, 50);
  UI.toast('已打开打印窗口，请选择「另存为 PDF」');
}
function emit(name, md, fmt, html) {
  if (fmt === 'md') UI.download(`${name}.md`, md);
  else printPdf(name, md, html);
}
const closePops = () => document.querySelectorAll('.pop').forEach((p) => (p.hidden = true));
const fmtOf = (n) => document.querySelector(`input[name="${n}"]:checked`)?.value || 'pdf';
const redraw = () => router.nav('exercise', 'report-detail', router.state().param);

/* ---------------------------------------------------------------- 操作 */
export const actions = {
  rpSearch(v) { view.q = v; UI.resetPage('reports'); router.nav('exercise', 'reports'); },
  rpFilter(k, v) { view[k] = v; UI.resetPage('reports'); router.nav('exercise', 'reports'); },
  rpSort() { view.sortDesc = !view.sortDesc; router.nav('exercise', 'reports'); },
  openReport(taskId) { router.nav('exercise', 'report-detail', taskId); },
  rpTab(tab) { detail.tab = tab; redraw(); },
  rdFilter(k, v) { detail[k] = v; UI.resetPage(`units-${router.state().param}`); redraw(); },
  rdPick(taskId, id, on) { const s = pickedOf(taskId); on ? s.add(id) : s.delete(id); redraw(); },
  rdPickPage(taskId, on) {
    const t = store.getTask(taskId);
    const pg = UI.paginate(`units-${taskId}`, filteredUnits(t));
    const s = pickedOf(taskId);
    pg.slice.forEach((u) => (on ? s.add(u.id) : s.delete(u.id)));
    redraw();
  },
  rdPickAll(taskId) { const s = pickedOf(taskId); filteredUnits(store.getTask(taskId)).forEach((u) => s.add(u.id)); redraw(); },
  rdPickClear(taskId) { pickedOf(taskId).clear(); redraw(); },
  popToggle(e, id) {
    e.stopPropagation();
    const el = document.getElementById(id);
    const open = el.hidden;
    closePops();
    UI.closeMenus();
    el.hidden = !open;
  },
  openUnit(taskId, unitId) {
    const u = store.getUnit(taskId, unitId);
    if (!u) return;
    UI.drawer('攻防明细详情', unitDrawer(u), `
      ${UI.btn('导出 PDF', { onclick: `App.exportUnit('${taskId}','${unitId}','pdf')` })}
      ${UI.btn('导出 MD', { onclick: `App.exportUnit('${taskId}','${unitId}','md')` })}
      ${UI.btn('关闭', { onclick: 'UI.closeDrawer()' })}`);
  },
  exportUnit(taskId, unitId, fmt) {
    const t = store.getTask(taskId);
    const u = store.getUnit(taskId, unitId);
    if (!t || !u) return;
    emit(`${t.name}-攻防明细-${unitNo(u)}`, `# ${t.name}\n\n${unitsMd(t, [u])}`, fmt);
  },
  exportReport() {
    const t = store.getTask(router.state().param);
    if (!t) return;
    const a = document.getElementById('ex-analysis')?.checked;
    const d = document.getElementById('ex-detail')?.checked;
    if (!a && !d) return UI.toast('请至少选择一项导出内容');
    const parts = [];
    if (a) parts.push(analysisMd(t));
    if (d) parts.push((a ? '' : `# ${t.name}\n\n`) + unitsMd(t, t.units));
    closePops();
    const html = a ? analysisPrintHTML(t) + (d ? mdToHtml(unitsMd(t, t.units)) : '') : null;
    emit(`${t.name}-${a && d ? '演练报告' : a ? '结果分析' : '攻防明细'}`, parts.join('\n\n'), fmtOf('ex-fmt'), html);
  },
  exportUnits(taskId) {
    const t = store.getTask(taskId);
    const sel = pickedOf(taskId);
    const units = sel.size ? t.units.filter((u) => sel.has(u.id)) : filteredUnits(t);
    if (!units.length) return UI.toast('没有可导出的明细');
    closePops();
    emit(`${t.name}-攻防明细`, `# ${t.name}\n\n${unitsMd(t, units)}`, fmtOf('rd-fmt'));
  },
};

if (typeof document !== 'undefined') document.addEventListener('click', closePops);
