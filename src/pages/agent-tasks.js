/* 智能体演练 · 演练任务：列表 + 详情 + 单元详情 + 新建向导 */
import { icon } from '../core/icons.js';
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { AGENT_VERDICT, RISK_LABEL } from '../domain/constants.js';
import { openAgentWizard, resumeAgentDraft, agentDrafts } from './agent-wizard.js';

const view = { q: '', targetId: 'all', bankId: 'all', status: 'all', sortDesc: true };
const detailView = { verdict: 'all', label: 'all', expanded: new Set() };

const S = () => store.listAgentTasks();

function filtered() {
  let rows = S();
  if (view.targetId !== 'all') rows = rows.filter((t) => t.targetId === view.targetId);
  if (view.bankId !== 'all') rows = rows.filter((t) => t.sceneBankId === view.bankId);
  if (view.status !== 'all') rows = rows.filter((t) => t.status === view.status);
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((t) => (t.name + t.targetName + t.id).toLowerCase().includes(q));
  }
  rows.sort((a, b) => (view.sortDesc ? b.startedAt.localeCompare(a.startedAt) : a.startedAt.localeCompare(b.startedAt)));
  return rows;
}

/* ---------------------------------------------------------------- 列表 */
export function agentTasksPage() {
  const rows = filtered();
  const targets = [...new Map(S().map((t) => [t.targetId, t.targetName])).entries()];

  const flt = UI.filters({
    search: { label: '搜索', id: 'ag-q', value: view.q, placeholder: '搜索任务或智能体名称', oninput: 'App.agTaskSearch(this.value)' },
    selects: [
      {
        label: '靶标智能体', id: 'ag-target', value: view.targetId, onchange: 'App.agTaskFilter("targetId",this.value)',
        options: [['all', '全部智能体'], ...targets],
      },
      {
        label: '场景题库', id: 'ag-bank', value: view.bankId, onchange: 'App.agTaskFilter("bankId",this.value)',
        options: [['all', '全部题库'], ...store.sceneBanks.map((b) => [b.id, b.name])],
      },
      {
        label: '任务状态', id: 'ag-status', value: view.status, onchange: 'App.agTaskFilter("status",this.value)',
        options: [['all', '全部状态'], ['running', '进行中'], ['done', '已完成'], ['stopped', '已终止']],
      },
    ],
    sort: { label: view.sortDesc ? '创建时间：倒序' : '创建时间：正序', onclick: 'App.agTaskSort()' },
  });

  const table = UI.pagedTable(
    'ag-tasks',
    [
      { title: '任务名称', render: (t) => `<button class="link-btn" onclick="App.openAgTask('${t.id}')">${UI.esc(t.name)}</button>` },
      { title: '靶标智能体', width: '190px', render: (t) => UI.esc(t.targetName) },
      { title: '场景题库', width: '180px', render: (t) => UI.esc(t.sceneBankName) },
      { title: '任务状态', width: '110px', render: (t) => UI.statusPill(t.status) },
      { title: '完成进度', width: '130px', render: (t) => UI.progressBar(t.progress) },
      { title: 'ASR', width: '80px', cls: 'num', render: (t) => `<span class="num">${UI.pct(t.agg.value)}</span>` },
      { title: '创建时间', width: '160px', cls: 'num', render: (t) => UI.esc(t.startedAt) },
      {
        title: '操作', width: '170px', cls: 'actions',
        render: (t) => `<div class="row-actions">
          ${UI.linkBtn('详情', { onclick: `App.openAgTask('${t.id}')` })}
          ${UI.linkBtn('删除', { danger: true, onclick: 'App.deleteBlocked()' })}
          ${UI.moreMenu([['查看报告', `App.openAgReportOf('${t.id}')`]])}
        </div>`,
      },
    ],
    rows,
    '暂无智能体演练任务',
  );

  return `${UI.pageHead('演练任务', {
    actions: `
      ${UI.btn('任务草稿箱', { onclick: 'App.openAgDrafts()' })}
      ${UI.btn('新建演练任务', { kind: 'primary', ico: 'plus', onclick: 'App.newAgTask()' })}`,
  })}${flt}${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 草稿箱 */
export function agentDraftsPage() {
  const rows = agentDrafts.map((d, i) => ({
    idx: i,
    name: d.name || '未命名任务',
    target: store.agentOf(d.targetId)?.name || '',
    strategy: store.getAgentStrategy(d.strategyId)?.name || '',
    savedAt: d.savedAt,
  }));

  const table = UI.pagedTable(
    'ag-drafts',
    [
      { title: '任务名称', render: (r) => UI.esc(r.name) },
      { title: '靶标智能体', render: (r) => (r.target ? UI.esc(r.target) : '<span class="faint">未选择</span>') },
      { title: '演练策略', render: (r) => (r.strategy ? UI.esc(r.strategy) : '<span class="faint">未选择</span>') },
      { title: '保存时间', width: '160px', cls: 'num', render: (r) => UI.esc(r.savedAt || '—') },
      {
        title: '操作', width: '160px', cls: 'actions',
        render: (r) => `<div class="row-actions">
          ${UI.linkBtn('继续编辑', { onclick: `App.resumeAgDraft(${r.idx})` })}
          ${UI.linkBtn('删除', { danger: true, onclick: 'App.deleteBlocked()' })}
        </div>`,
      },
    ],
    rows,
    '暂无草稿任务',
  );

  return `${UI.backBtn()}${UI.pageHead('任务草稿箱')}${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 详情 */
export function agentTaskDetailPage(cur) {
  const t = store.getAgentTask(cur?.param);
  if (!t) return `${UI.pageHead('任务详情')}<div class="empty"><strong>任务不存在</strong></div>`;

  const head = `${UI.backBtn()}
    ${UI.pageHead(t.name, {
    extra: UI.statusIcon(t.status),
    actions: `
        ${UI.btn('查看报告', { kind: 'primary', onclick: `App.openAgReportOf('${t.id}')` })}
        ${UI.btn('导出结果', { onclick: `App.agExport('${t.id}')` })}
        ${UI.btn('删除', { kind: 'danger', onclick: 'App.deleteBlocked()' })}`,
  })}`;

  return `${head}
  <div class="detail-grid">
    <div class="detail-left">
      ${UI.card('演练结果', agentResultPanel(t))}
      ${UI.card('风险标签归因', labelPanel(t), '', true)}
      ${UI.card('基础信息', UI.kvTable(agentBaseRows(t)))}
      ${UI.card('详细配置', UI.kvTable(agentConfigRows(t)))}
    </div>
    <div class="detail-right">
      ${UI.card('逐题执行明细', unitListPanel(t), '', true)}
    </div>
  </div>`;
}

/* 演练结果：ASR 圆环 + 三态分布 + 执行进度 */
export function agentResultPanel(t) {
  const d = store.agentVerdictCountsOf(t);
  const total = t.total || 1;
  const seg = d.map((x) => (x.value ? `<i style="width:${(x.value / total) * 100}%;background:${x.color}"></i>` : '')).join('');
  return `<div class="rs">
    <div class="rs-top">
      ${UI.ring(t.agg.value, { size: 104, label: 'ASR', color: 'var(--vd-breach)', track: 'var(--vd-safe)' })}
      <div class="rs-main">
        <div class="sub-label">攻击结果</div>
        <div class="stack-bar">${seg}</div>
        ${UI.legend(d)}
      </div>
    </div>
    <div class="rs-progress">
      <div class="flex between"><span class="sub-label">执行进度</span>
        <span class="num muted text-support">${t.units.length} / ${t.total}</span></div>
      ${UI.progressBar(t.progress, { showText: false })}
    </div>
  </div>`;
}

/* 风险标签归因：题库标签维度的泄漏统计，不是执行维度 */
function labelPanel(t) {
  if (!t.labelsAgg.length) return '<div class="empty"><strong>暂无数据</strong></div>';
  const max = Math.max(...t.labelsAgg.map((x) => x.asr ?? 0), 0.01);
  const rows = t.labelsAgg.map((x) => `<tr>
    <td>${UI.badge(x.label, x.cls)}</td>
    <td class="num">${x.denominator}</td>
    <td class="num">${x.breach}</td>
    <td class="num">${x.asr === null ? '—' : UI.pct(x.asr)}</td>
    <td><div class="mini-bar"><i style="width:${((x.asr ?? 0) / max) * 100}%"></i></div></td>
  </tr>`).join('');
  return `<div class="label-attr">
    <p class="faint text-support">分母为本次演练中声明该标签的题数，不是题目总数。标签来自题库标注，不是执行维度。</p>
    <table class="kv-table tight">
      <thead><tr><th>风险标签</th><th class="num">涉及题数</th><th class="num">泄漏</th><th class="num">泄漏率</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

export function agentBaseRows(t) {
  const a = store.agentOf(t.targetId);
  return [
    ['任务名称', UI.esc(t.name)],
    ['任务描述', UI.esc(t.desc || '—')],
    ['靶标智能体', UI.esc(t.targetName)],
    ['启动命令', a?.launchCmd ? `<code>${UI.esc(a.launchCmd)}</code>` : '—'],
    ['基座模型', UI.esc(a?.baseModelName || '—')],
    ['任务状态', UI.statusPill(t.status)],
    ['演练策略', UI.esc(t.strategyName || '—')],
    ['场景题库', UI.esc(t.sceneBankName)],
    ['创建时间', `<span class="num">${UI.esc(t.startedAt)}</span>`],
    ['完成时间', `<span class="num">${UI.esc(t.finishedAt || '—')}</span>`],
  ];
}

export function agentConfigRows(t) {
  return [
    ['题目数', `<span class="num">${t.total}</span>${t.taskIdSnapshot ? ' <span class="faint">（已快照固定）</span>' : ''}`],
    ['迭代轮数', `${t.maxIterations ?? 1}`],
    ['执行并发', `${t.concurrency ?? '—'}`],
    ['单条超时', t.targetTimeout ? `${t.targetTimeout} 秒` : '—'],
    ['异常统计', `跑崩 ${t.agg.unknown} 条 · 判定不一致 ${t.evalMismatch ?? 0} 条 · 疑似声明排除 ${t.declarationOnly ?? 0} 处`],
  ];
}

/* ---------------------------------------------------------------- 逐题明细 */
function unitListPanel(t) {
  let units = t.units;
  if (detailView.verdict !== 'all') units = units.filter((u) => u.verdict === detailView.verdict);
  if (detailView.label !== 'all') units = units.filter((u) => (u.declaredLabels || []).includes(detailView.label));

  if (!t.units.length) return '<div class="empty"><strong>暂无执行记录</strong></div>';

  const vOpts = [['all', '全部判定'], ...Object.values(AGENT_VERDICT).map((v) => [v.key, v.label])];
  const lOpts = [['all', '全部标签'], ...t.labelsAgg.map((x) => [x.key, x.label])];

  const bar = `<div class="unit-toolbar">
    <select onchange="App.agUnitFilter('verdict',this.value)">
      ${vOpts.map(([v, l]) => `<option value="${v}" ${detailView.verdict === v ? 'selected' : ''}>${UI.esc(l)}</option>`).join('')}
    </select>
    <select onchange="App.agUnitFilter('label',this.value)">
      ${lOpts.map(([v, l]) => `<option value="${v}" ${detailView.label === v ? 'selected' : ''}>${UI.esc(l)}</option>`).join('')}
    </select>
    <span class="muted">共 ${units.length} 条</span>
  </div>`;

  const body = units.map((u) => unitRow(t, u)).join('') || '<div class="empty"><strong>无匹配记录</strong></div>';
  return `<div class="unit-list">${bar}<div class="unit-body">${body}</div></div>`;
}

function unitRow(t, u) {
  const v = AGENT_VERDICT[u.verdict] || AGENT_VERDICT.error;
  const open = detailView.expanded.has(u.id);
  const tags = (u.triggeredLabels || []).map((k) => UI.badge(RISK_LABEL[k]?.label || k, RISK_LABEL[k]?.cls || 'gray')).join('');
  return `<div class="unit-item ${open ? 'open' : ''}">
    <button class="unit-head" onclick="App.agToggleUnit('${u.id}')">
      <span class="unit-caret">${icon(open ? 'chevronDown' : 'chevronRight', 14)}</span>
      <span class="unit-id num">${UI.esc(u.sceneTaskId)}</span>
      <span class="unit-dom">${UI.esc(u.domainOriginal || '—')}</span>
      ${UI.badge(v.label, v.cls)}
      <span class="unit-dur num">${u.durationSec ? `${u.durationSec}s` : '—'}</span>
      <span class="unit-tags">${tags || '<span class="faint">—</span>'}</span>
    </button>
    ${open ? unitBody(t, u) : ''}
  </div>`;
}

function unitBody(t, u) {
  const chains = (u.chains || []).map((c, i) => chainBlock(c, i + 1)).join('')
    || '<p class="faint">未检出泄漏</p>';
  const outs = (u.outputFiles || []).map((f) => `<code>${UI.esc(f)}</code>`).join(' ') || '<span class="faint">无产物</span>';
  const fails = (u.toolFailures || []).map((f) => `<div><code>${UI.esc(f.tool)}</code> — ${UI.esc(f.reason)}</div>`).join('')
    || '<span class="faint">无</span>';
  return `<div class="unit-detail">
    <div class="ud-sec"><div class="sub-label">任务目标</div><p>${UI.esc(u.goal || '—')}</p></div>
    <div class="ud-sec"><div class="sub-label">泄漏链路</div>${chains}</div>
    <div class="ud-sec"><div class="sub-label">产物文件</div><div class="ud-files">${outs}</div></div>
    <div class="ud-sec"><div class="sub-label">工具调用失败</div>${fails}</div>
    <div class="ud-sec">
      <div class="sub-label">智能体自述
        <span class="hint" title="智能体自己的汇报，未经独立验证。平台无法还原其文件读取序列">?</span>
      </div>
      <pre class="ud-report">${UI.esc(u.selfReport || '—')}</pre>
    </div>
  </div>`;
}

function chainBlock(c, no) {
  const sig = c.signal === 'high'
    ? UI.badge('高辨识度', 'green')
    : UI.badge('易误报', 'amber');
  const decl = c.likelyDeclaration ? UI.badge('疑似声明排除', 'gray') : '';
  const labels = (c.riskLabels || []).map((k) => RISK_LABEL[k]?.label || k).join('、');
  return `<div class="chain">
    <div class="chain-no">泄漏链路 ${no} ${sig} ${decl}</div>
    ${UI.kvTable([
    ['命中标记', `<code>${UI.esc(c.marker)}</code>`],
    ['源文件', c.sourceFiles?.length ? c.sourceFiles.map((f) => `<code>${UI.esc(f)}</code>`).join(' ') : '<span class="faint">未定位</span>'],
    ['产物文件', `<code>${UI.esc(c.sinkFile)}</code>`],
    ['风险类别', `${UI.esc(labels)}${c.className ? ` · <code>${UI.esc(c.className)}</code>` : ''}`],
    ['陷阱设计', UI.esc(c.coLocation || '—')],
    ['泄漏后果', UI.esc(c.riskReason || '—')],
    ['命中上下文', `<span class="ctx">${UI.esc(c.context || '—')}</span>`],
  ])}
  </div>`;
}

/* ---------------------------------------------------------------- 操作 */
function refreshList() {
  const c = router.state();
  router.nav(c.page, c.sub, c.param);
}

export const actions = {
  agTaskSearch(v) { view.q = v; UI.resetPage('ag-tasks'); refreshList(); },
  agTaskFilter(k, v) { view[k] = v; UI.resetPage('ag-tasks'); refreshList(); },
  agTaskSort() { view.sortDesc = !view.sortDesc; refreshList(); },
  openAgTask(id) { router.nav('agent', 'ag-task-detail', id); },
  openAgReportOf(taskId) { router.nav('agent', 'ag-report-detail', taskId); },
  newAgTask() { openAgentWizard(); },
  openAgDrafts() { router.nav('agent', 'ag-drafts'); },
  resumeAgDraft(idx) { resumeAgentDraft(idx); },
  agUnitFilter(k, v) { detailView[k] = v; refreshList(); },
  agToggleUnit(id) {
    if (detailView.expanded.has(id)) detailView.expanded.delete(id);
    else detailView.expanded.add(id);
    refreshList();
  },
  agExport(id) {
    const t = store.getAgentTask(id);
    if (!t) return;
    UI.download(`${id}-units.json`, JSON.stringify(t.units, null, 2));
  },
};
