/* 策略中心：模型演练策略 / 防护方法 */
import { icon } from '../core/icons.js';
import * as UI from '../core/ui.js';
import * as store from '../domain/store.js';
import * as router from '../core/router.js';
import { detailFields, detailBlock, detailContent, detailTableField, methodConfigurationTable, openConfigDetail } from '../core/config-detail.js';
import { openEditor } from './strategy-editor.js';
import { latestStrategyRows, releaseLabel } from '../domain/strategy-service.js';
import { openStrategyVersions, updateBadge, versionActions } from './strategy-versions.js';

/* ---------------------------------------------------------------- 模型演练策略 */
const sView = { q: '', status: 'all' };

export function attackStrategyPage() {
  let rows = latestStrategyRows(store.strategies);
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
      options: [['all', '全部状态'], ['published', '已发布'], ['draft', '草稿'], ['disabled','已停用']],
    }],
  });
  const table = UI.pagedTable(
    'strategies',
    [
      { title: '策略名称', render: (s) => `<button class="link-btn" onclick="App.${s.status === 'draft' ? 'editStrategy' : 'openStrategy'}('${s.id}')">${UI.esc(s.name)}</button>${updateBadge(s)}` },
      { title: '攻击方法', render: (s) => `<span class="mono text-support">${UI.esc(s.methods.map((m) => m.name).join(' · ') || '—')}</span>` },
      { title: '场景题库', render: (s) => `<div class="cfg-lines">${store.strategyBankLines(s).map((l) => `<div>${UI.esc(l)}</div>`).join('') || '—'}</div>` },
      { title: '版本', width: '90px', render: s => UI.linkBtn(releaseLabel(s.version), { onclick: `App.sgVersions('${s.id}')` }) },
      { title: '状态', width: '100px', render: (s) => UI.badge(store.STRATEGY_STATUS[s.status], s.status === 'published' ? 'blue' : 'gray') },
      { title: '更新时间', width: '150px', cls: 'num', render: (s) => UI.esc(s.updatedAt) },
      {
        title: '操作', width: '172px', cls: 'actions',
        render: (s) => `<div class="row-actions strategy-row-actions" data-strategy-status="${s.status}">
          ${s.status === 'draft'
            ? UI.linkBtn('编辑', { onclick: `App.editStrategy('${s.id}')` }) + UI.linkBtn('删除', { danger: true, onclick: `App.delStrategy('${s.id}')` })
            : UI.linkBtn('详情', { onclick: `App.openStrategy('${s.id}')` }) + UI.linkBtn('新版本', { onclick: `App.sgNewVersion('${s.id}')` }) + UI.moreMenu([['复制', `App.copyStrategy('${s.id}')`], [s.status==='disabled'?'启用':'停用', `App.sgAvailability('${s.id}',${s.status==='disabled'})`]])}
        </div>`,
      },
    ],
    rows,
    '暂无模型演练策略',
  );

  return `${UI.pageHead('模型演练策略', {
    actions: UI.btn('新建模型演练策略', { kind: 'primary', ico: 'plus', onclick: 'App.newStrategy()' }),
  })}${flt}
  ${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 防护方法 */
export function guardStrategyPage() {
  const table = UI.pagedTable(
    'guards',
    [
      { title: '方法名称', render: (g) => `<button class="link-btn" onclick="App.${!g.builtin&&g.status==='draft'?'guardForm':'openGuard'}('${g.id}')">${UI.esc(g.name)}</button>` },
      { title:'来源',width:'80px',render:g=>UI.badge(g.builtin?'系统':'自建','gray') },
      { title:'防护模型',render:g=>g.builtin?'—':UI.esc(store.modelName(g.modelId)||'—') },
      { title: '审核维度', render: (g) => UI.tagList(g.dims.map(([n]) => n)) },
      { title: '可部署位置', width: '130px', render: (g) => g.stages.join(' / ') },
      { title: '版本', width: '90px', render: g => g.builtin?'—':UI.linkBtn(releaseLabel(g.version),{onclick:`App.guardHistory('${g.id}')`}) },
      {
        title: '操作', width: '172px', cls: 'actions',
        render: (g) => `<div class="row-actions strategy-row-actions">${g.builtin?UI.linkBtn('查看',{onclick:`App.openGuard('${g.id}')`}):UI.linkBtn(g.status==='draft'?'编辑':'详情',{onclick:`App.${g.status==='draft'?'guardForm':'openGuard'}('${g.id}')`})+(g.status!=='draft'?UI.linkBtn('新版本',{onclick:`App.guardNewVersion('${g.id}')`})+UI.moreMenu([[g.status==='disabled'?'启用':'停用',`App.guardToggle('${g.id}')`]]):'')}</div>`,
      },
    ],
    latestStrategyRows(store.guards),
    '暂无防护方法',
  );
  return `${UI.pageHead('防护方法',{actions:UI.btn('新建防护方法',{kind:'primary',ico:'plus',onclick:'App.guardForm()'})})}
  ${UI.card('', table, '', true)}`;
}

export const actions = {
  sgNewVersion(id) { try { const next = store.newStrategyVersion(id); UI.closeDrawer(); openEditor(next); } catch (error) { UI.toast(error.message); } },
  ...versionActions,
  sgVersions(id) { openStrategyVersions(id); },
  sgAvailability(id,enabled){store.setStrategyStatus(id,enabled,'model');UI.closeDrawer();router.nav('strategy','attack');},
  delStrategy(id) {
    const s = store.strategies.find((x) => x.id === id);
    if (!s) return;
    UI.modal('删除模型演练策略', `<p>确定删除「${UI.esc(s.name)}」？${s.status === 'published' ? '删除后不可再用于新建或开始演练，待开始任务需重新选择策略；已开始任务及历史记录保留。' : '删除后不可恢复。'}</p>`,
      `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${UI.btn('删除', { kind: 'danger', onclick: `App.delStrategyOk('${id}')` })}`);
  },
  delStrategyOk(id) {
    store.deleteStrategy(id);
    UI.closeModal(); UI.closeDrawer(); UI.toast('已删除');
    router.nav('strategy', 'attack');
  },
  sgSearch(v) { sView.q = v; UI.resetPage('strategies'); router.nav('strategy', 'attack'); },
  sgStatus(v) { sView.status = v; UI.resetPage('strategies'); router.nav('strategy', 'attack'); },
  copyStrategy(id) {
    try {
      const copiedId = store.copyStrategy(id);
      sView.q = ''; sView.status = 'all'; UI.resetPage('strategies');
      UI.closeDrawer(); router.nav('strategy', 'attack');
      openEditor(copiedId);
      return copiedId;
    } catch (error) { UI.toast(error.message); }
  },
  /* 详情抽屉：场景题库 / 攻击方法与任务详情「详细配置」同一写法 */
  openStrategy(id) {
    const s = store.strategies.find((x) => x.id === id);
    if (!s) return;
    if (s.status === 'draft') { UI.closeDrawer(); return openEditor(id); }
    const body = detailContent(detailBlock('策略基础信息', detailFields([
      ['策略名称', s.name], ['策略描述', s.desc], ['版本', releaseLabel(s.version)], ['状态', store.STRATEGY_STATUS[s.status]],
      [s.status === 'published' ? '发布时间' : '更新时间', s.updatedAt],
    ])) + detailBlock('详细配置信息', detailFields([['题库范围', store.strategyBankLines(s).join('；')],['防护方法',s.guardId?`${s.guardSnapshot?.name||store.guardOf(s.guardId)?.name||'—'}${(s.guardSnapshot||store.guardOf(s.guardId))?.builtin?'':` · ${releaseLabel(s.guardVersion)}`}`:'未启用'],...(s.guardId?[['审核位置',(s.guardStages||[]).join(' / ')]]:[])])
      + detailTableField('攻击方法', methodConfigurationTable([...s.methods].sort((a, b) => a.order - b.order)))));
    const foot = UI.btn('版本记录',{onclick:`App.sgVersions('${s.id}')`}) + UI.btn('创建新版本',{kind:'primary',onclick:`App.sgNewVersion('${s.id}')`}) + UI.btn(s.status==='disabled'?'启用':'停用',{onclick:`App.sgAvailability('${s.id}',${s.status==='disabled'})`}) + UI.btn('关闭',{onclick:'UI.closeDrawer()'});
    openConfigDetail('模型演练策略详情', body, foot);
  },
  openGuard(id) {
    const g = store.guards.find((x) => x.id === id);
    if (!g) return;
    openConfigDetail('防护方法详情', detailContent(
      detailBlock('方法基础信息', detailFields([['方法名称',g.name],['来源',g.builtin?'系统':'自建'],['版本',g.builtin?'—':releaseLabel(g.version)],...(!g.builtin?[['状态',store.STRATEGY_STATUS[g.status]]]:[]),['防护模型',g.builtin?'—':g.modelSnapshot?.name||store.modelName(g.modelId)]]))
      + detailBlock('详细配置信息', detailFields([
        ['防护位置',g.stages.join(' + ')],['拦截阈值',g.threshold==='unsafe'?'不安全':'有争议及以上'],['触发动作',g.action==='review'?'转人工复核':'阻断'],['异常处置',({block:'阻断',allow:'放行并记录',stop:'中止演练'})[g.failureAction]||'阻断'],
        ...(g.stages.includes('输入')?[['输入审核','请求送达靶标前审核']]:[]),...(g.stages.includes('输出')?[['输出审核','审核靶标生成的回复']]:[]), ['判定结果', '安全 / 有争议 / 不安全'],
      ]) + detailTableField(`审核维度（${g.dims.length}）`, UI.table([
        { title: '维度', render: row => UI.esc(row[0]) }, { title: '说明', render: row => UI.esc(row[1]) },
      ], g.dims)))), (g.builtin?'':UI.btn('版本记录',{onclick:`App.guardHistory('${g.id}')`}) + UI.btn(g.status==='draft'?'编辑草稿':'创建新版本',{kind:'primary',onclick:`App.${g.status==='draft'?'guardForm':'guardNewVersion'}('${g.id}')`}) + (g.status==='draft'?'':UI.btn(g.status==='disabled'?'启用':'停用',{onclick:`App.guardToggle('${g.id}')`}))) + UI.btn('关闭',{onclick:'UI.closeDrawer()'}));
  },
};
