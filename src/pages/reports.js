/* 演练报告：列表 + 报告详情（结果分析 / 攻防明细）+ 导出 */
import * as UI from '../core/ui.js';
import { classificationFields } from '../domain/task-classification.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { verdictOf } from '../domain/metrics.js';
import { taskMetricsMd } from './task-metrics.js';
import { resultPanel, baseInfoRows, configRows } from './tasks.js';
import { mdToHtml, emit, closePops, fmtOf } from '../core/export.js';
import { gtag, mtag, field, text, mod } from '../core/detail.js';
import { configSummary } from '../core/task-config.js';
import { roundInfo } from '../domain/task-rounds.js';
import { roundCountText, breachRoundText, methodRoundMetrics, methodRoundColumns, methodRoundNote, methodPerformanceMd } from './report-rounds.js';
import { reportQuestionCell, reportSection, reportDocument } from './report-format.js';
import { reportListResult } from './report-list-result.js';
import { reportListTelemetryColumns } from './report-list-telemetry.js';
import { modelMethodInsights } from './model-method-insights.js';
import { resolveResultLevel, resultLevelRange } from '../domain/result-level-rules.js';
import { riskMethodMatrix, riskMethodMatrixHTML, riskMethodMatrixMd, matrixInsight, synthesisHTML, scenarioTagsHTML, reportUnitMetricHTML, reportUnitMetricMd, reportUnitMetricColumns } from './report-insights.js';

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
  rows.sort((a, b) => (view.sortDesc ? String(b.createdAt || '').localeCompare(a.createdAt || '') : String(a.createdAt || '').localeCompare(b.createdAt || '')));
  const targets = [...new Map(store.listTasks().map((t) => [t.targetId, t.targetName])).entries()];

  const flt = UI.filters({
    search: { label: '搜索', id: 'rp-q', value: view.q, placeholder: '搜索报告名称', oninput: 'App.rpSearch(this.value)' },
    selects: [
      {
        label: '靶标', id: 'rp-target', value: view.targetId, onchange: 'App.rpFilter("targetId",this.value)',
        options: [['all', '全部靶标'], ...targets.map(([id, n]) => [id, n])],
      },
    ],
  });

  const table = UI.pagedTable(
    'reports',
    [
      { title: '报告名称', render: (r) => `<button class="link-btn" onclick="App.openReport('${r.taskId}')">${UI.esc(r.name)}</button>` },
      { title: '靶标名称', render: (r) => UI.esc(r.targetName) },
      { title: 'ASR / 等级', width:'200px', render:r=>reportListResult(store.getTask(r.taskId),'model') },
      ...reportListTelemetryColumns(store.getTask),
      { title: '生成时间', width: '160px', cls: 'num', sort: { direction: view.sortDesc ? 'descending' : 'ascending', onclick: 'App.rpSort()' }, render: (r) => UI.esc(r.createdAt) },
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
  if (t.status !== 'done') return `${UI.backBtn()}${UI.pageHead(t.name)}${configSummary(t)}
    <div class="empty"><strong>仅已完成任务生成报告</strong><p>当前过程可在任务详情中查看。</p>${UI.btn('任务详情', { onclick: `App.openTask('${t.id}')` })}</div>`;

  const head = `${UI.backBtn()}
    ${UI.pageHead(t.name, {
      actions: `
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

  return `<div class="rr-report">${head}${configSummary(t)}${toggle}<div id="rp-body">${detail.tab === 'analysis' ? analysisHTML(t) : detailHTML(t)}</div></div>`;
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
  if (!t.judged) return [{ title: '尚无有效判定', text: `计划 ${t.total} 个攻防单元，当前没有可计入 ASR 的有效判定，暂不能形成安全结论。` }];
  const ms = [...t.methodsAgg].sort((a, b) => b.value - a.value);
  const breached = ms.filter((m) => m.breach > 0);
  const base = t.methodsAgg.find((m) => m.name === 'Direct');
  const top = breached[0];
  const methodText = top
    ? `${top.name} 的攻击成功率最高，为 ${UI.pct(top.value)}（${top.breach}/${top.judged}）；${breached.length} 种方法取得攻破${base?.judged && base.value === 0 ? '，直接提问基线未攻破' : ''}。`
    : '本次已判定的方法均未取得攻破。';
  const scenes = store.byScene(t).filter(scene => scene.judged).sort((a, b) => b.value - a.value);
  const scene = scenes[0];
  const level = resolveResultLevel('model.asr', t.agg.value);
  return [
    { title: '方法表现', text: methodText },
    ...(scene?.breach ? [{ title: '重点场景', text: `「${scene.label}」的攻破率最高，为 ${UI.pct(scene.value)}（${scene.breach}/${scene.judged}）；各场景的覆盖量与结果见下文。` }] : []),
    { title: level ? `结果等级：${level.name}` : '结论范围', text: `${level ? `按「${level.ruleName}」判定，本次 ASR 落在 ${resultLevelRange(level)}，与顶部结果等级一致。` : ''}结论适用于本次题库和方法组合。` },
  ];
}

function suggestions(t) {
  const out = [];
  const ms = [...t.methodsAgg].sort((a, b) => b.breach - a.breach);
  const top = ms[0];
  if (top && top.breach) {
    const share = top.breach / (t.breach || 1);
    out.push({ title: `优先加固 ${top.name}`, text: `该方法贡献 ${UI.pct(share, 0)} 的攻破记录。复核对应输入、靶标响应与防护结果，修复后按相同配置复测。` });
  }
  const sc = store.byScene(t).filter((s) => s.breach > 0).sort((a, b) => b.value - a.value);
  if (sc.length) {
    out.push({ title: `补充「${sc[0].label}」防护样例`, text: '从攻防明细筛选该场景的已攻破记录，整理拒答样例与回归用例。' });
  }
  const counts = store.byScene(t).filter((x) => x.judged).map((x) => x.judged);
  out.push({ title: '扩大覆盖并持续复测', text: `${counts.length ? `本次各场景有 ${Math.min(...counts)}–${Math.max(...counts)} 条有效判定。` : ''}补充题量与未覆盖场景；对比时保持靶标、裁判和总轮数一致。` });
  return out;
}

/* 雷达（全部维度）+ 条形（攻破最多的前 3 项在全部攻破中的占比）+ 明细表 */
function riskBlock(title, firstCol, allDims, rows, task = null, insights = [], {overlapping=false,distinctBreach=null} = {}) {
  const rankedRows = [...rows].sort((a, b) => b.value - a.value);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const radarItems = allDims.map((d) => {
    const r = byKey.get(d.key);
    return { label: d.label, value: r ? r.value : 0, covered: !!(r && r.judged) };
  });
  const totalBreach = overlapping ? distinctBreach||0 : rows.reduce((n, r) => n + r.breach, 0);
  const top = rows.filter((r) => r.breach > 0).sort((a, b) => b.breach - a.breach).slice(0, 3);
  const bar = top.length
    ? UI.bars(top.map((r, i) => ({ label: r.label, value: r.breach / totalBreach, color: UI.chartColor(i) })), { max: 1 })
    : '<div class="empty"><strong>本次无攻破记录</strong></div>';
  const table = UI.table(
    [
      { title: firstCol, render: (r) => UI.esc(r.label) },
      { title: '有效数量', width: '96px', render: (r) => `<span class="num">${r.judged}</span>` },
      { title: '守住', width: '80px', render: (r) => `<span class="num">${r.judged - r.breach}</span>` },
      { title: '攻破', width: '80px', render: (r) => `<span class="num">${r.breach}</span>` },
      ...(task ? methodRoundColumns : []),
      { title: '攻破率', width: '96px', render: (r) => `<span class="num metric-asr${r === rankedRows[0] && r.judged ? ' report-key-metric' : ''}">${r.judged ? UI.pct(r.value) : '—'}</span>` },
    ],
    rankedRows,
  );
  return reportSection(title, `${synthesisHTML(insights)}<div class="risk-charts">
      <div><div class="sub-label">各${firstCol}攻破率（共 ${allDims.length} 个维度，本次覆盖 ${rows.filter((r) => r.judged).length} 个）</div>${radarItems.length>=3?UI.radar(radarItems,{size:250}):UI.bars(radarItems,{max:1})}</div>
      <div><div class="sub-label">攻破占比 Top ${top.length || 3}（占本次 ${totalBreach} 个攻破单元${overlapping?'，多标签可重叠':''}）</div>${bar}</div>
    </div>
    <div class="mt-16">${task ? `<p class="rr-note">${UI.esc(methodRoundNote(task))}</p>` : ''}${table}</div>`);
}

const sceneRows = (t) => store.byScene(t).map((s) => ({ key: s.id, label: s.label, ...s }));
const methodRows = (t) => {
  const rounds = methodRoundMetrics(t);
  return t.methodsAgg.map(m => ({ ...m, ...rounds.get(m.name), key: m.name.toLowerCase(), label: m.name }));
};
const allSceneDims = t => store.byScene(t).map(s=>({key:s.id,label:s.label}));
const allMethodDims = () => store.methods.filter((m) => m.family !== '多模态').map((m) => ({ key: m.name.toLowerCase(), label: m.name }));

const methodInsights = modelMethodInsights;

function sceneInsights(t) {
  const rows = sceneRows(t), judged = rows.filter(row => row.judged), breached = judged.filter(row => row.breach).sort((a, b) => b.breach - a.breach);
  if (!judged.length) return ['尚无可用于场景比较的有效判定；已执行但未判定的记录不作为守住结果。'];
  const top = breached[0];
  const methods = top ? [...new Set(t.units.filter(unit => store.scenesOfUnit(unit).includes(top.id) && unit.judgeSuccess === true).map(unit => unit.method))] : [];
  return [`本次 ${judged.length} 个场景有有效判定，其中 ${breached.length} 个场景出现攻破。${top ? `「${top.label}」贡献最多攻破记录（${top.breach}/${top.judged}，${UI.pct(top.value)}），涉及 ${methods.join('、')}。${methods.length > 1 ? '同一场景在多种方法下暴露边界薄弱点，应按场景统一补充防护和回归样例。' : '当前风险集中于单一方法，需补充其他方法验证是否可复现。'}` : '已覆盖场景未观察到攻破，仍需结合题量判断证据范围。'}各场景题量不同，不能只按百分比判断风险规模。`];
}

function modelMatrix(t) {
  const risks = allSceneDims(t);
  if (t.units.some(unit => !store.sceneOfUnit(unit))) risks.push({ key: 'unclassified', label: '未标注场景' });
  return riskMethodMatrix({ units: t.units, risks,
    methods: t.methods.map(method => ({ key: method.name, label: method.name })),
    riskOf: unit => store.scenesOfUnit(unit).length ? store.scenesOfUnit(unit) : ['unclassified'], methodOf: unit => unit.method, outcomeOf: unit => unit.judgeSuccess });
}

function overallPerformance(t) {
  const matrix = modelMatrix(t);
  return reportSection('靶标整体表现', synthesisHTML([matrixInsight(matrix)]) + riskMethodMatrixHTML(matrix));
}

/* 蓝队防护分析：只描述本任务内蓝队做了什么，不做防护前后对比（对比在任务外层的结果对比里做）。
 * 统计口径与攻防明细的「蓝队结果」一致：每条单元只看最后一轮。
 * 从上往下：核心数据（单元去向）→ 拦截涉及的攻击方法 → 拦截涉及的风险类别。 */
function guardStats(t) {
  const flow = { in: 0, out: 0, self: 0, leak: 0, unknown: 0 };
  const byMethod = new Map(), byCat = new Map();
  for (const u of t.units) {
    const g = u.history[u.history.length - 1]?.guard;
    if (!g) continue;
    const blocked = g.action === 'block_input' || g.action === 'block_output';
    if (g.action === 'block_input') flow.in += 1;
    else if (g.action === 'block_output') flow.out += 1;
    else if (u.judgeSuccess === true) flow.leak += 1;
    else if (u.judgeSuccess === false) flow.self += 1;
    else flow.unknown += 1;
    if (!blocked) continue;
    byMethod.set(u.method, (byMethod.get(u.method) || 0) + 1);
    const side = g.action === 'block_input' ? g.input : g.output;
    for (const c of side?.categories || []) byCat.set(c, (byCat.get(c) || 0) + 1);
  }
  const total = flow.in + flow.out + flow.self + flow.leak + flow.unknown;
  return { flow, total, blocked: flow.in + flow.out, byMethod, byCat };
}
const guardFlow = (s) => [
  { key: 'in', label: '输入拦截', value: s.flow.in, color: 'var(--c1)' },
  { key: 'out', label: '输出拦截', value: s.flow.out, color: 'var(--c2)' },
  { key: 'self', label: '放行后未攻破', value: s.flow.self, color: 'var(--vd-safe)' },
  { key: 'leak', label: '漏防', value: s.flow.leak, color: 'var(--vd-breach)' },
  ...(s.flow.unknown ? [{ key: 'unknown', label: '未判定', value: s.flow.unknown, color: 'var(--text-faint)' }] : []),
];
const guardInsight = s => `蓝队在 ${s.total} 个有审核记录的单元中拦截 ${s.blocked} 个（输入 ${s.flow.in} 个、输出 ${s.flow.out} 个）。放行后仍有 ${s.flow.leak} 个被判为攻破${s.flow.self ? `、${s.flow.self} 个未攻破` : ''}。${s.flow.leak ? '重点复核放行且攻破的输入与输出，确定漏防集中在哪些类别，再补充对应规则。' : '本次有明确判定的放行记录未观察到漏防，仍需保留原有业务可用性验证。'}${s.flow.unknown ? `${s.flow.unknown} 个放行单元缺少判定，不能计为防护成功。` : ''}`;
function guardBlock(t) {
  if (!t.guardId) return '';
  const s = guardStats(t);
  if (!s.total) return '';
  const flow = guardFlow(s);
  const all = s.total;
  const donut = (() => {
    const size = 168, r = 64, c = 2 * Math.PI * r; let acc = 0;
    const segs = flow.filter((f) => f.value).map((f) => {
      const len = (f.value / all) * c;
      const el = `<circle cx="84" cy="84" r="${r}" fill="none" stroke="${f.color}" stroke-width="20" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 84 84)"/>`;
      acc += len; return el;
    }).join('');
    return `<div class="gd-donut"><svg viewBox="0 0 ${size} ${size}" width="${size}">${segs}</svg>
      <div class="ring-text"><strong>${UI.pct(s.blocked / all)}</strong><span>拦截率</span></div></div>`;
  })();
  const funnel = `<div class="gd-funnel">${flow.map((f) => `<div class="gd-frow">
      <span class="bar-label">${f.label}</span>
      <div class="bar"><i style="width:${(f.value / all) * 100}%;background:${f.color}"></i></div>
      <span class="bar-value num">${f.value}</span></div>`).join('')}</div>`;
  const taskMethods = new Set(t.methods.map((m) => m.name));
  const methodItems = allMethodDims().map((d) => ({ label: d.label, value: s.byMethod.get(d.label) || 0, covered: taskMethods.has(d.label) }));
  const catItems = (store.guardOf(t.guardId)?.dims || []).map(([label]) => ({ label, value: s.byCat.get(label) || 0, covered: true }));
  const radarOpt = { count: true, color: 'var(--vd-safe)' };
  return reportSection('蓝队防护分析', `
    ${synthesisHTML([guardInsight(s)])}
    <div class="sub-label">攻击单元去向（共 ${all} 条，蓝队拦截 ${s.blocked} 条）</div>
    <div class="gd-flow">${donut}${funnel}</div>
    <div class="risk-charts mt-16">
      <div><div class="sub-label">拦截涉及的攻击方法（共 ${methodItems.length} 种，本次使用 ${taskMethods.size} 种）</div>${UI.radar(methodItems, radarOpt)}</div>
      <div><div class="sub-label">拦截涉及的风险类别（共 ${catItems.length} 类）</div>${UI.radar(catItems, radarOpt)}</div>
    </div>`);
}

function analysisHTML(t) {
  const f = findings(t)
    .map(x => `<li class="conc-item"><b>${UI.esc(x.title)}</b><p>${UI.esc(x.text)}</p></li>`)
    .join('');
  const s = suggestions(t)
    .map(x => `<li class="conc-item"><b>${UI.esc(x.title)}</b><p>${UI.esc(x.text)}</p></li>`)
    .join('');
  return reportDocument([
    reportSection('演练结果', resultPanel(t)),
    reportSection('核心发现', `<ol class="conclusions">${f}</ol>`),
    riskBlock('攻击方法表现', '攻击方法', allMethodDims(), methodRows(t), t, methodInsights(t)),
    riskBlock('场景风险分析', '攻击场景', allSceneDims(t), sceneRows(t), null, sceneInsights(t), {overlapping:Boolean(t.classificationSnapshot),distinctBreach:t.agg.breach}),
    overallPerformance(t),
    guardBlock(t),
    reportSection('下一步建议', `<ol class="conclusions">${s}</ol>`),
  ]);
}

/* ---------------------------------------------------------------- 攻防明细 */
function filteredUnits(t) {
  return t.units.filter((u) => {
    if (detail.method !== 'all' && u.method !== detail.method) return false;
    if (detail.verdict !== 'all' && verdictOf(u).key !== detail.verdict) return false;
    if (detail.scene !== 'all' && !store.scenesOfUnit(u).includes(detail.scene)) return false;
    return true;
  });
}
/* 序号：单元在整个任务里的顺序（按方法顺序拼接），全任务唯一 */
const unitNo = (u) => store.getTask(u.taskId).units.findIndex((x) => x.id === u.id) + 1;

function detailHTML(t) {
  const units = filteredUnits(t);
  const sel = pickedOf(t.id);
  const selectedCount = t.units.filter(unit => sel.has(unit.id)).length;
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
      <span class="muted text-support">已选 <b class="num">${selectedCount}</b> 条</span>
      ${UI.linkBtn('全选筛选结果', { onclick: `App.rdPickAll('${t.id}')` })}
      ${UI.linkBtn('清空选择', { onclick: `App.rdPickClear('${t.id}')`, disabled: !sel.size })}
    </span>`,
    right: `<div class="pop-wrap">
      ${UI.btn('导出明细', { ico: 'download', disabled: !selectedCount, onclick: "App.popToggle(event,'rd-export')" })}
      <div class="pop" id="rd-export" hidden onclick="event.stopPropagation()">
        <div class="pop-title">导出范围</div>
        <p class="text-support muted">${selectedCount ? `已勾选的 ${selectedCount} 条` : '请先勾选需要导出的明细'}</p>
        <div class="pop-title">导出格式</div>
        <label class="pop-opt"><input type="radio" name="rd-fmt" value="pdf" checked />PDF</label>
        <label class="pop-opt"><input type="radio" name="rd-fmt" value="md" />Markdown</label>
        <div class="pop-foot">${UI.btn('确认导出', { kind: 'primary', disabled: !selectedCount, onclick: `App.exportUnits('${t.id}')` })}</div>
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
      { title: '攻击题目', render: (u) => reportQuestionCell(u.target) },
      { title: '风险场景', width: '120px', render: (u) => scenarioTagsHTML(store.sceneLabelsOfUnit(u)) },
      { title: '完成/总轮数', width: '115px', render: (u) => `<span class="num">${roundCountText(t, u)}</span>` },
      { title: '攻破轮次', width: '110px', render: (u) => breachRoundText(t, u) },
      { title: '判定结果', width: '100px', render: (u) => UI.verdictText(verdictOf(u)) },
      ...reportUnitMetricColumns(t),
      { title: '操作', width: '80px', cls: 'actions',
        render: (u) => `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.openUnit('${t.id}','${u.id}')` })}</div>` },
    ],
    units,
    '该筛选条件下暂无明细',
  );
  return `${flt}<div class="one-line">${UI.card('', table, '', true)}</div>`;
}
/* ---------------------------------------------------------------- 抽屉：攻防明细详情 */
/* 四个模块：① 摘要（短字段）② 攻击题目 ③ 攻击过程（按方法换形态）④ 判定依据。
 * 同一层级的内容用同一种呈现：字段名一律 ud-label；短值为纯文本；自然语言长文本一律 ud-text 文本框。
 * 结果有两套：裁判判定（全站通用的着色文字）与蓝队结果（带边框底色的 gtag 标签），靠形态区分而非颜色。 */
const GUARD_RESULT = {
  block_input: { key: 'block', label: '输入拦截' },
  block_output: { key: 'block', label: '输出拦截' },
  leak: { key: 'leak', label: '漏防' },
  pass: { key: 'pass', label: '放行' },
};

/* 蓝队结果是对外结论，只看最后一轮；中间轮的拦截只在攻击过程里体现 */
function guardResult(u) {
  const g = u.history[u.history.length - 1]?.guard;
  if (!g) return null;
  if (g.action === 'block_input' || g.action === 'block_output') return GUARD_RESULT[g.action];
  return u.judgeSuccess ? GUARD_RESULT.leak : GUARD_RESULT.pass;
}
const methodText = (t, u) => {
  const m = t.methods.find((x) => x.name === u.method);
  return m?.label ? `${u.method}（${m.label}）` : u.method;
};

const checkLine = (label, x, blocked) => field(label,
  `<span>${UI.esc(x.labelCn)}${x.categories.length ? ` · ${UI.esc(x.categories.join('、'))}` : ''}</span>${gtag(blocked ? { key: 'block', label: '已拦截' } : GUARD_RESULT.pass)}`);

/* 单轮内容：攻击提示词 →（蓝队输入审核）→ 靶标回复 →（蓝队输出审核）→（被拦截时）最终返回。
 * JailBroken 的最后一步变换就是送给靶标的提示词，已在变换步骤里展示，不再重复。 */
function roundBody(h) {
  const g = h.guard;
  const p = h.steps?.length ? '' : text('攻击提示词', h.prompt);
  if (!g) return p + text('靶标回复', h.response);
  const inB = g.action === 'block_input', outB = g.action === 'block_output';
  return [
    p,
    checkLine('蓝队输入审核', g.input, inB),
    inB ? text('靶标回复', '', '已被蓝队拦截，未到达靶标') : text('靶标回复', g.originalResponse ?? h.response),
    g.output ? checkLine('蓝队输出审核', g.output, outB) : '',
    inB || outB ? text('最终返回', h.response) : '',
  ].join('');
}

function summaryMod(t, u) {
  const gr = guardResult(u);
  return mod('摘要', `${scenarioTagsHTML(store.sceneLabelsOfUnit(u))}<div class="ud-kv">
    ${field('攻击方法', UI.esc(methodText(t, u)))}
    ${field('攻击场景', UI.esc(store.sceneLabelsOfUnit(u).join('、')||'未打标签'))}
    ${classificationFields(u).filter(d=>d.id!=='risk').map(d=>field(d.name,UI.esc(d.labels.join('、')||'未打标签'))).join('')}
    ${field('判定结果', UI.verdictText(verdictOf(u)))}
    ${field('完成/总轮数', roundCountText(t, u))}
    ${field('攻破轮次', breachRoundText(t, u))}
    ${field('耗时', reportUnitMetricHTML(t, u, 'duration'))}
    ${field('Token', reportUnitMetricHTML(t, u, 'tokens'))}
    ${gr ? field('蓝队结果', gtag(gr)) : ''}
  </div>`);
}

/* 攻击过程：单轮方法直接平铺；JailBroken 先列变换步骤，再是送给靶标的那一轮；PAIR 每轮一个折叠条 */
function processMod(t, u) {
  if (!u.history.length) return mod('攻击过程', '<p class="ud-note">无迭代记录</p>');
  const h0 = u.history[0];
  if (u.rounds <= 1) {
    const steps = h0.steps?.length
      ? [text('原始题目', h0.original), ...h0.steps.map((s, i) => text(`变换第 ${i + 1} 步 · ${s.label}${i === h0.steps.length - 1 ? '（送给靶标的提示词）' : ''}`, s.prompt))].join('')
      : '';
    return mod('攻击过程', roundVisual(t, u) + steps + roundBody(h0));
  }
  /* 折叠条只放轮次与提示词摘要；攻击者拒绝、蓝队拦截等标记都在展开后展示 */
  const first = roundInfo(t, u).breachRound;
  const rounds = u.history.map((h) => {
    const refused = h.attackerRefused
      ? `<div class="ud-val">${mtag('攻击者拒绝')}<span class="ud-note">攻击生成模型拒绝改写，送出的是拒绝文本，本轮不构成有效攻击</span></div>`
      : '';
    return `<details class="ud-round ${h.round === first ? 'rr-first-breach' : ''}" ${h.round === first ? 'open' : ''}><summary><span class="ud-round-no">第 ${h.round} 轮${h.round === first ? ' · 已攻破' : ''}</span>
      <span class="ud-round-sum">${UI.esc((h.prompt || '').replace(/\s+/g, ' ').slice(0, 120))}</span></summary>
      <div class="ud-round-body">${refused}${roundBody(h)}</div></details>`;
  }).join('');
  return mod('攻击过程', `${roundVisual(t, u)}<div class="ud-rounds">${rounds}</div>`);
}

function roundVisual(t, u) {
  const first = roundInfo(t, u).breachRound;
  return `<div class="rr-round-visual" aria-label="各轮判定">${u.history.map(h => {
    const state = h.judgeSuccess === true || h.round === first ? 'breach' : h.judgeSuccess === false ? 'safe' : 'unknown';
    const label = state === 'breach' ? '已攻破' : state === 'safe' ? '未攻破' : '未记录判定';
    return `<div class="${state}"><span>第 ${UI.esc(h.round)} 轮</span><strong>${label}</strong></div>`;
  }).join('')}</div>`;
}

const basisMod = (u) => mod('判定依据', text('裁判理由', u.judgeReason, '裁判未给出理由'));

function unitDrawer(u) {
  const t = store.getTask(u.taskId);
  return `<div class="ud">
    ${summaryMod(t, u)}
    ${mod('攻击题目', `<pre class="ud-text">${UI.esc(u.target)}</pre>`)}
    ${processMod(t, u)}
    ${basisMod(u)}
  </div>`;
}

/* ---------------------------------------------------------------- 导出 */
/* Markdown 与 PDF 用同一份内容：PDF 由 Markdown 转成的简单 HTML 经浏览器打印生成 */
function analysisMd(t) {
  const strip = (h) => String(h).replace(/<[^>]+>/g, '');
  const L = [`# ${t.name}`, '',
    '## 基础信息', '', ...baseInfoRows(t).map(([k, v]) => `- ${k}：${strip(v)}`), '',
    '## 详细配置', '', ...configRows(t).map(([k, v]) => `- ${k}：${strip(v.replace(/<\/div><div>/g, '；'))}`), '',
    '## 演练结果', '', '攻击成功率（ASR）= 攻破单元数 ÷ 有效判定单元数。', '',
    ...taskMetricsMd(t),
    ...store.verdictCounts(t).map((d) => `- ${d.label}：${d.value}`), '',
    '## 核心发现', '', ...findings(t).map((f, i) => `${i + 1}. **${f.title}**：${f.text}`), ''];
  const tbl = (title, col, rows) => [`## ${title}`, '', `| ${col} | 有效数量 | 守住 | 攻破 | 攻破率 |`, '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.label} | ${r.judged} | ${r.judged - r.breach} | ${r.breach} | ${UI.pct(r.value)} |`), ''];
  const methodMd = methodPerformanceMd(t, methodRows(t));
  methodMd.splice(2, 0, ...methodInsights(t), '');
  const scenesMd = tbl('场景风险分析', '攻击场景', sceneRows(t));
  scenesMd.splice(2, 0, ...sceneInsights(t), '');
  return [...L, ...methodMd, ...scenesMd, '## 靶标整体表现', '', ...riskMethodMatrixMd(modelMatrix(t)), ...guardMd(t),
    '## 下一步建议', '', ...suggestions(t).map((s, i) => `${i + 1}. **${s.title}**：${s.text}`), ''].join('\n');
}
function guardMd(t) {
  if (!t.guardId) return [];
  const s = guardStats(t);
  if (!s.total) return [];
  const row = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`);
  return ['## 蓝队防护分析', '',
    guardInsight(s), '',
    `- 攻击单元去向：共 ${s.total} 条，${guardFlow(s).map((f) => `${f.label} ${f.value}`).join('，')}`,
    `- 拦截率：${UI.pct(s.blocked / s.total)}`, '',
    '| 拦截涉及的攻击方法 | 拦截单元数 |', '|---|---|', ...row(s.byMethod), '',
    ...(s.byCat.size ? ['| 拦截涉及的风险类别 | 次数 |', '|---|---|', ...row(s.byCat), ''] : [])];
}
function roundMd(h) {
  const g = h.guard;
  const blk = (label, s) => [`**${label}**`, '', '```', s || '', '```', ''];
  const chk = (label, x, blocked) => [`- ${label}：${x.labelCn}${x.categories.length ? ` · ${x.categories.join('、')}` : ''} · ${blocked ? '已拦截' : '放行'}`, ''];
  const p = h.steps?.length ? [] : blk('攻击提示词', h.prompt);
  if (!g) return [...p, ...blk('靶标回复', h.response)];
  const inB = g.action === 'block_input', outB = g.action === 'block_output';
  return [...p, ...chk('蓝队输入审核', g.input, inB),
    ...(inB ? ['**靶标回复**：已被蓝队拦截，未到达靶标', ''] : blk('靶标回复', g.originalResponse ?? h.response)),
    ...(g.output ? chk('蓝队输出审核', g.output, outB) : []),
    ...(inB || outB ? blk('最终返回', h.response) : [])];
}
function unitsMd(t, units) {
  return ['## 攻防明细', '', `共 ${units.length} 条`, '',
    ...units.flatMap((u) => {
      const gr = guardResult(u);
      const h0 = u.history[0];
      const proc = u.rounds <= 1
        ? [...(h0?.steps?.length ? ['**原始题目**', '', '```', h0.original, '```', '',
          ...h0.steps.flatMap((s, i) => [`**变换第 ${i + 1} 步 · ${s.label}**`, '', '```', s.prompt, '```', ''])] : []),
          ...(h0 ? roundMd(h0) : [])]
        : u.history.flatMap((h) => [
          `**第 ${h.round} 轮**${h.attackerRefused ? ' · 攻击者拒绝' : ''}${h.guard?.action?.startsWith('block') ? ` · ${GUARD_RESULT[h.guard.action].label}` : ''}`, '', ...roundMd(h)]);
      return [
        `### ${unitNo(u)}. ${u.method} · ${verdictOf(u).label}`, '',
        '#### 摘要', '',
        `- 攻击方法：${methodText(t, u)}`, `- 攻击场景：${store.sceneLabelsOfUnit(u).join('、')||'未打标签'}`,
        ...classificationFields(u).filter(d=>d.id!=='risk').map(d=>`- ${d.name}：${d.labels.join('、')||'未打标签'}`),
        `- 判定结果：${verdictOf(u).label}`,
        `- 耗时：${reportUnitMetricMd(t, u, 'duration')}`, `- Token：${reportUnitMetricMd(t, u, 'tokens')}`,
        `- 完成/总轮数：${roundCountText(t, u)}`, `- 攻破轮次：${breachRoundText(t, u)}`, ...(gr ? [`- 蓝队结果：${gr.label}`] : []), '',
        '#### 攻击题目', '', '```', u.target, '```', '',
        '#### 攻击过程', '', ...proc,
        '#### 判定依据', '', `- 裁判理由：${u.judgeReason || '裁判未给出理由'}`, '',
      ];
    })].join('\n');
}
/* PDF 复用页面的文档分节与内联图表，顺序：基础信息→详细配置→分析。 */
function analysisPrintHTML(t) {
  return `<div class="rr-report"><h1>${UI.esc(t.name)}</h1>
    ${UI.card('基础信息', UI.kvTable(baseInfoRows(t)))}
    ${UI.card('详细配置', UI.kvTable(configRows(t)))}
    ${analysisHTML(t)}</div>`;
}
const redraw = () => router.nav('exercise', 'report-detail', router.state().param);
function completedTask(id) {
  const task = store.getTask(id);
  if (task?.status === 'done') return task;
  UI.toast('仅已完成任务可查看或导出报告');
  return null;
}

/* ---------------------------------------------------------------- 操作 */
export const actions = {
  rpSearch(v) { view.q = v; UI.resetPage('reports'); router.nav('exercise', 'reports'); },
  rpFilter(k, v) { view[k] = v; UI.resetPage('reports'); router.nav('exercise', 'reports'); },
  rpSort() { view.sortDesc = !view.sortDesc; router.nav('exercise', 'reports'); },
  openReport(taskId) { const t=store.getTask(taskId); detail.tab='analysis'; router.nav('exercise',t?.status==='done'?'report-detail':'task-detail',taskId); },
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
    if (!completedTask(taskId)) return;
    const u = store.getUnit(taskId, unitId);
    if (!u) return;
    UI.drawer('攻防明细详情', unitDrawer(u), `
      ${UI.btn('导出 PDF', { onclick: `App.exportUnit('${taskId}','${unitId}','pdf')` })}
      ${UI.btn('导出 MD', { onclick: `App.exportUnit('${taskId}','${unitId}','md')` })}
      ${UI.btn('关闭', { onclick: 'UI.closeDrawer()' })}`);
  },
  exportUnit(taskId, unitId, fmt) {
    const t = completedTask(taskId);
    if (!t) return;
    const u = store.getUnit(taskId, unitId);
    if (!t || !u) return;
    emit(`${t.name}-攻防明细-${unitNo(u)}`, `# ${t.name}\n\n${unitsMd(t, [u])}`, fmt);
  },
  exportReport() {
    const t = completedTask(router.state().param);
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
    const t = completedTask(taskId);
    if (!t) return;
    const sel = pickedOf(taskId);
    const units = t.units.filter((u) => sel.has(u.id));
    if (!units.length) { closePops(); return UI.toast('请先勾选需要导出的明细'); }
    closePops();
    emit(`${t.name}-攻防明细`, `# ${t.name}\n\n${unitsMd(t, units)}`, fmtOf('rd-fmt'));
  },
};

if (typeof document !== 'undefined') document.addEventListener('click', closePops);
