/* 策略中心：攻击策略 / 防护策略 */
import { icon } from '../core/icons.js';
import * as UI from '../core/ui.js';
import * as store from '../domain/store.js';
import * as router from '../core/router.js';
import { detailFields, detailBlock, detailContent, detailTableField, methodConfigurationTable, openConfigDetail } from '../core/config-detail.js';
import { openEditor } from './strategy-editor.js';

/* ---------------------------------------------------------------- 攻击策略 */
const sView = { q: '', status: 'all' };

export function attackStrategyPage({ embedded = false } = {}) {
  let rows = [...store.strategies];
  if (sView.status !== 'all') rows = rows.filter((s) => s.status === sView.status);
  if (sView.q.trim()) {
    const q = sView.q.trim().toLowerCase();
    rows = rows.filter((s) => s.name.toLowerCase().includes(q));
  }
  rows = [...rows].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  const flt = UI.filters({
    search: { label: '搜索', id: 'sg-q', value: sView.q, placeholder: '搜索策略名称', oninput: 'App.sgSearch(this.value)' },
    selects: [{
      label: '状态', id: 'sg-status', value: sView.status, onchange: 'App.sgStatus(this.value)',
      options: [['all', '全部状态'], ['published', '已发布'], ['draft', '草稿']],
    }],
  });
  const table = UI.pagedTable(
    'strategies',
    [
      { title: '策略名称', render: (s) => `<button class="link-btn" onclick="App.${s.status === 'draft' ? 'editStrategy' : 'openStrategy'}('${s.id}')">${UI.esc(s.name)}</button>` },
      { title: '攻击方法', render: (s) => `<span class="mono text-support">${UI.esc(s.methods.map((m) => m.name).join(' · ') || '—')}</span>` },
      { title: '场景题库', render: (s) => `<div class="cfg-lines">${store.strategyBankLines(s).map((l) => `<div>${UI.esc(l)}</div>`).join('') || '—'}</div>` },
      { title: '状态', width: '100px', render: (s) => UI.badge(store.STRATEGY_STATUS[s.status], s.status === 'published' ? 'blue' : 'gray') },
      { title: '更新时间', width: '150px', cls: 'num', render: (s) => UI.esc(s.updatedAt) },
      {
        title: '操作', width: '190px', cls: 'actions',
        render: (s) => `<div class="row-actions sg-row-actions" data-strategy-status="${s.status}">
          ${s.status === 'draft'
            ? '<span class="sg-action-placeholder" aria-hidden="true"></span>' + UI.linkBtn('编辑', { onclick: `App.editStrategy('${s.id}')` }) + UI.linkBtn('删除', { danger: true, onclick: `App.delStrategy('${s.id}')` })
            : UI.linkBtn('详情', { onclick: `App.openStrategy('${s.id}')` }) + UI.linkBtn('复制配置', { onclick: `App.copyStrategy('${s.id}')` }) + UI.linkBtn('删除', { danger: true, disabled: store.modelStrategyUsage(s.id).used, onclick: `App.delStrategy('${s.id}')` })}
        </div>`,
      },
    ],
    rows,
    '暂无攻击策略',
  );

  return `${embedded ? '' : UI.pageHead('攻击策略', {
    actions: UI.btn('新建攻击策略', { kind: 'primary', ico: 'plus', onclick: 'App.newStrategy()' }),
  })}${flt}
  ${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 防护策略 */
export function guardStrategyPage() {
  const table = UI.pagedTable(
    'guards',
    [
      { title: '防护名称', render: (g) => `<button class="link-btn" onclick="App.openGuard('${g.id}')">${UI.esc(g.name)}</button>` },
      { title: '防护模型', width: '200px', render: (g) => UI.esc(g.model) },
      { title: '来源', width: '90px', render: () => '系统' },
      { title: '审核维度', render: (g) => `<div class="guard-dimensions" title="${UI.esc(g.dims.map(([n]) => n).join('、'))}">${UI.tagList(g.dims.slice(0, 3).map(([n]) => n))}${g.dims.length > 3 ? `<span class="faint text-support">等 ${g.dims.length} 类</span>` : ''}</div>` },
      { title: '可部署位置', width: '130px', render: (g) => g.stages.join(' / ') },
      {
        title: '操作', width: '90px', cls: 'actions',
        render: (g) => `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.openGuard('${g.id}')` })}</div>`,
      },
    ],
    store.guards,
    '暂无防护策略',
  );
  return `${UI.pageHead('防护库')}
  ${UI.card('', table, '', true)}`;
}

export const actions = {
  copyStrategy(id) {
    try { const copied = store.copyStrategy(id); UI.closeDrawer(); openEditor(copied); UI.toast('配置已复制为独立草稿'); return copied; }
    catch (error) { UI.toast(error.message); }
  },
  delStrategy(id) {
    const s = store.strategies.find((x) => x.id === id);
    if (!s) return;
    if (store.modelStrategyUsage(id).used) return UI.toast('已参与演练的组合攻击策略不可删除');
    UI.modal('删除攻击策略', `<p>确定删除「${UI.esc(s.name)}」？删除后不可再用于新建演练；尚未开始的任务需重新选择策略。</p>`,
      `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${UI.btn('删除', { kind: 'danger', onclick: `App.delStrategyOk('${id}')` })}`);
  },
  delStrategyOk(id) {
    try { store.deleteStrategy(id); } catch (error) { return UI.toast(error.message); }
    UI.closeModal(); UI.closeDrawer(); UI.toast('已删除');
    router.nav('strategy', 'attack');
  },
  sgSearch(v) { sView.q = v; UI.resetPage('strategies'); router.nav('strategy', 'attack'); },
  sgStatus(v) { sView.status = v; UI.resetPage('strategies'); router.nav('strategy', 'attack'); },
  /* 详情抽屉：攻击题库 / 攻击方法与任务详情「详细配置」同一写法 */
  openStrategy(id) {
    const s = store.strategies.find((x) => x.id === id);
    if (!s) return;
    if (s.status === 'draft') { UI.closeDrawer(); return openEditor(id); }
    const body = detailContent(detailBlock('策略基础信息', detailFields([
      ['策略名称', s.name], ['策略描述', s.desc], ['状态', store.STRATEGY_STATUS[s.status]],
      [s.status === 'published' ? '发布时间' : '更新时间', s.updatedAt],
    ])) + detailBlock('详细配置信息', detailFields([['题库范围', store.strategyBankLines(s).join('；')]])
      + detailTableField('攻击方法', methodConfigurationTable([...s.methods].sort((a, b) => a.order - b.order)))));
    const foot = UI.btn('复制配置', { onclick: `App.copyStrategy('${s.id}')` }) + UI.btn('删除', { kind: 'danger', disabled: store.modelStrategyUsage(s.id).used, onclick: `App.delStrategy('${s.id}')` }) + UI.btn('关闭', { onclick: 'UI.closeDrawer()' });
    openConfigDetail('攻击策略详情', body, foot);
  },
  openGuard(id) {
    const g = store.guards.find((x) => x.id === id);
    if (!g) return;
    openConfigDetail('防护策略详情', detailContent(
      detailBlock('基础信息', detailFields([['防护名称', g.name], ['防护模型', g.model], ['来源', `系统 · ${g.provider}`], ['说明', g.desc]]))
      + detailBlock('详细配置信息', detailFields([
        ['防护位置', g.stages.join(' + ')], ['输入审核', '审核发给靶标的提示词'],
        ['输出审核', '审核靶标生成的回复'], ['判定结果', g.verdict], ['适用语言', g.languages],
      ]) + detailTableField(`审核维度（${g.dims.length}）`, UI.table([
        { title: '维度', render: row => UI.esc(row[0]) }, { title: '说明', render: row => UI.esc(row[1]) },
      ], g.dims)))));
  },
};
