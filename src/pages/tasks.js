/* 演练任务：列表 + 详情 + 新建向导 + 草稿箱 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { OBJECT_TYPE, GUARD_NONE } from '../domain/constants.js';
import { openWizard, openRetest, resumeDraft, drafts } from './wizard.js';

/* 原始日志里没有的配置项统一这样显示，不填猜测值 */
const NOT_RECORDED = '<span class="faint">日志未记录</span>';

/* 页面内状态：只存筛选与排序，不放业务数据 */
const view = {
  q: '',
  targetId: 'all',
  status: 'all',
  sortDesc: true,
};

const S = () => store.listTasks();

function filtered() {
  let rows = S();
  if (view.targetId !== 'all') rows = rows.filter((t) => t.targetId === view.targetId);
  if (view.status !== 'all') rows = rows.filter((t) => t.status === view.status);
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((t) => (t.name + t.targetName + t.id).toLowerCase().includes(q));
  }
  rows.sort((a, b) => (view.sortDesc ? b.startedAt.localeCompare(a.startedAt) : a.startedAt.localeCompare(b.startedAt)));
  return rows;
}

/* ---------------------------------------------------------------- 列表 */
export function tasksPage() {
  const targets = [...new Map(S().map((t) => [t.targetId, t.targetName])).entries()];
  const rows = filtered();

  const flt = UI.filters({
    search: { label: '搜索', id: 'tk-q', value: view.q, placeholder: '搜索任务或靶标名称', oninput: 'App.taskSearch(this.value)' },
    selects: [
      {
        label: '靶标', id: 'tk-target', value: view.targetId, onchange: 'App.taskFilter("targetId",this.value)',
        options: [['all', '全部靶标'], ...targets.map(([id, name]) => [id, name])],
      },
      {
        label: '任务状态', id: 'tk-status', value: view.status, onchange: 'App.taskFilter("status",this.value)',
        options: [['all', '全部状态'], ['running', '进行中'], ['done', '已完成'], ['stopped', '已终止']],
      },
    ],
    sort: { label: view.sortDesc ? '创建时间：倒序' : '创建时间：正序', onclick: 'App.taskSort()' },
  });

  const table = UI.pagedTable(
    'tasks',
    [
      { title: '任务名称', render: (t) => `<button class="link-btn" onclick="App.openTask('${t.id}')">${UI.esc(t.name)}</button>` },
      { title: '靶标名称', render: (t) => UI.esc(t.targetName) },
      { title: '任务状态', render: (t) => UI.statusPill(t.status) },
      { title: '完成进度', width: '140px', render: (t) => UI.progressBar(t.progress) },
      { title: 'ASR', width: '90px', cls: 'num', render: (t) => `<span class="num">${UI.pct(t.asr)}</span>` },
      { title: '创建时间', width: '160px', cls: 'num', render: (t) => UI.esc(t.startedAt) },
      { title: '完成/终止时间', width: '170px', cls: 'num', render: (t) => UI.esc(t.finishedAt || '—') },
      {
        title: '操作', width: '190px', cls: 'actions',
        render: (t) => `<div class="row-actions">
          ${UI.linkBtn('详情', { onclick: `App.openTask('${t.id}')` })}
          ${UI.linkBtn('删除', { danger: true, onclick: 'App.deleteBlocked()' })}
          ${UI.moreMenu([['一键复测', `App.retest('${t.id}')`], ['查看报告', `App.openReportOf('${t.id}')`]])}
        </div>`,
      },
    ],
    rows,
    '暂无演练任务',
  );

  return `${UI.pageHead('演练任务', {
    actions: `
      ${UI.btn('任务草稿箱', { onclick: 'App.openDrafts()' })}
      ${UI.btn('新建演练任务', { kind: 'primary', ico: 'plus', onclick: "App.newTask('model')" })}`,
  })}
  ${flt}
  ${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 详情 */
const detail = { id: null, tab: 'log' };

export function openTask(id) {
  detail.id = id;
  router.nav('exercise', 'task-detail', id);
}

export function taskDetailPage(cur) {
  const id = cur.param || detail.id;
  const t = store.getTask(id);
  if (!t) return `${UI.pageHead('任务详情')}<div class="empty"><strong>任务不存在</strong></div>`;

  const head = `${UI.backBtn()}
    ${UI.pageHead(t.name, {
      extra: UI.statusIcon(t.status),
      actions: `
        ${UI.btn('查看报告', { kind: 'primary', onclick: `App.openReportOf('${t.id}')` })}
        ${UI.btn('一键复测', { onclick: `App.retest('${t.id}')` })}
        ${UI.btn('删除', { kind: 'danger', onclick: 'App.deleteBlocked()' })}`,
    })}`;

  return `${head}
  <div class="detail-grid">
    <div class="detail-left">
      ${UI.card('演练结果', resultPanel(t))}
      ${UI.card('基础信息', UI.kvTable(baseInfoRows(t)))}
      ${UI.card('详细配置', UI.kvTable(configRows(t)))}
    </div>
    <div class="detail-right">
      ${UI.card('运行日志', logPanel(t), `
        ${UI.btn('导出日志', { onclick: `App.exportLog('${t.id}')`, disabled: t.status !== 'done' })}`, true)}
    </div>
  </div>`;
}

/* 演练结果：圆环 + 判定分布条 + 执行进度。四种判定态随执行动态变化 */
export function resultPanel(t) {
  const d = store.verdictCounts(t);
  const total = t.total || 1;
  const seg = d.map((x) => (x.value ? `<i style="width:${(x.value / total) * 100}%;background:${x.color}"></i>` : '')).join('');
  return `<div class="rs">
    <div class="rs-top">
      ${UI.ring(t.asr, { size: 104, label: 'ASR', color: 'var(--vd-breach)', track: 'var(--vd-safe)' })}
      <div class="rs-main">
        <div class="sub-label">攻击结果</div>
        <div class="stack-bar">${seg}</div>
        ${UI.legend(d)}
      </div>
    </div>
    <div class="rs-progress">
      <div class="flex between"><span class="sub-label">执行进度</span><span class="num muted text-support">${t.judged + d.find((x) => x.key === 'error').value} / ${t.total}</span></div>
      ${UI.progressBar(t.progress, { showText: false })}
    </div>
  </div>`;
}

export function baseInfoRows(t) {
  return [
    ['任务名称', UI.esc(t.name)],
    ['演练类型', OBJECT_TYPE[t.objectType]?.label || '—'],
    ['靶标名称', UI.esc(t.targetName)],
    ['任务状态', UI.statusPill(t.status)],
    ['攻击策略', UI.esc(t.strategyName)],
    ['裁判模型', UI.esc(t.judgeName)],
    ['蓝队防护', t.guardId ? `${UI.esc(t.guardName)}·${(t.guardStages?.length ? t.guardStages : ['输入', '输出']).join('+')}` : `<span class="faint">${GUARD_NONE}</span>`],
    ['创建时间', `<span class="num">${UI.esc(t.startedAt)}</span>`],
    ['完成时间', `<span class="num">${UI.esc(t.finishedAt || '—')}</span>`],
  ];
}

export function configRows(t) {
  const strategy = store.strategies.find((x) => x.id === t.strategyId);
  const methods = (strategy?.methods || t.methods.map((m) => ({ name: m.name, params: [] })))
    .map((m) => `<div>${UI.esc(store.methodConfigText(m))}</div>`)
    .join('');
  return [
    ['攻击题库', UI.esc(store.bankRefText(t.bankName, t.bankCount))],
    ['攻击方法', `<div class="cfg-lines">${methods}</div>`],
    ['执行并发', t.concurrency ? `${t.concurrency}` : NOT_RECORDED],
    ['单次输出上限', t.maxTokens ? `${t.maxTokens} tokens` : NOT_RECORDED],
  ];
}

function logPanel(t) {
  const lines = store.logLines(t.id);
  const body = lines
    .map((l) => {
      if (l.kind === 'section') return `<div class="log-sec">${UI.esc(l.text)}</div>`;
      const tag = l.tag ? `<span class="log-tag ${l.tag}">${UI.esc(l.tagLabel || l.tag)}</span>` : '';
      const time = l.time ? `<span class="log-time">${UI.esc(l.time)}</span>` : '';
      const sub = l.sub ? `<div class="log-sub">${UI.esc(l.sub)}</div>` : '';
      return `<div class="log-line">${time}${tag}<span class="log-text">${UI.esc(l.text)}</span>${sub}</div>`;
    })
    .join('');
  return `<div class="log" id="log-view">
    <div class="log-toolbar">
      <span class="muted">共 ${lines.length} 行</span>
    </div>
    <div class="log-body" id="log-body">${body}</div>
  </div>`;
}

/* ---------------------------------------------------------------- 操作 */
function refresh() {
  router.nav('exercise', 'task-detail', detail.id);
}

export const actions = {
  taskSearch(v) {
    view.q = v;
    UI.resetPage('tasks');
    UI_refreshList();
  },
  taskFilter(key, v) {
    view[key] = v;
    UI.resetPage('tasks');
    UI_refreshList();
  },
  taskSort() {
    view.sortDesc = !view.sortDesc;
    UI_refreshList();
  },
  openTask(id) {
    openTask(id);
  },
  openReportOf(taskId) {
    router.nav('exercise', 'report-detail', taskId);
  },
  retest(id) {
    const t = store.getTask(id);
    if (t) openRetest(t);
  },
  exportLog(taskId) {
    const t = store.getTask(taskId);
    if (!t || t.status !== 'done') return UI.toast('任务未执行成功，暂不可导出');
    UI.download(`${t.name}-运行日志.txt`, store.logText(taskId));
  },
  toggleNewTask() {
    openWizard('model');
  },
  newTask() {
    openWizard('model');
  },
  openDrafts() {
    router.nav('exercise', 'drafts');
  },
  resumeDraft(idx) {
    resumeDraft(idx);
  },
};

function UI_refreshList() {
  router.nav('exercise', 'tasks');
}

/* ---------------------------------------------------------------- 任务草稿箱 */
export function draftsPage() {
  const rows = drafts.map((d, i) => ({
    idx: i,
    name: d.name || '未命名任务',
    target: store.models.find((m) => m.id === d.targetId)?.name || '',
    strategy: store.strategies.find((s) => s.id === d.strategyId)?.name || '',
    savedAt: d.savedAt,
  }));

  const table = UI.pagedTable(
    'drafts',
    [
      { title: '任务名称', render: (r) => UI.esc(r.name) },
      { title: '靶标', render: (r) => (r.target ? UI.esc(r.target) : '<span class="faint">未选择</span>') },
      { title: '攻击策略', render: (r) => (r.strategy ? UI.esc(r.strategy) : '<span class="faint">未选择</span>') },
      { title: '保存时间', width: '160px', cls: 'num', render: (r) => UI.esc(r.savedAt || '—') },
      {
        title: '操作', width: '160px', cls: 'actions',
        render: (r) => `<div class="row-actions">
          ${UI.linkBtn('继续编辑', { onclick: `App.resumeDraft(${r.idx})` })}
          ${UI.linkBtn('删除', { danger: true, onclick: 'App.deleteBlocked()' })}
        </div>`,
      },
    ],
    rows,
    '暂无草稿任务',
  );

  return `${UI.backBtn()}
  ${UI.pageHead('任务草稿箱')}
  ${UI.card('', table, '', true)}`;
}
