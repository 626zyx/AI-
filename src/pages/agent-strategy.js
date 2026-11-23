/* 策略中心 · 智能体演练策略：列表 + 详情抽屉 + 新建编辑 + 草稿箱。
 * 策略 = 演练方法 + 场景题库与题目范围。用户先选演练方法再选题，发布后锁定。
 * 形态对齐模型演练策略：列表列、详情抽屉「基本信息 / 策略配置」两卡。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { compareValues } from '../core/table-sort.js';
import { CONFIGURE_MODEL_VALUE, configureModelsOption, configureMoreModels } from '../core/model-config-navigation.js';
import { detailFields, detailBlock, detailContent, detailTableField, methodConfigurationTable, openConfigDetail } from '../core/config-detail.js';
import { selectableAgentBanks, selectableMethods } from '../domain/resource-authoring.js';
import { latestStrategyRows, releaseLabel, freezeStrategyDependencies, strategyUpdates, upgradedStrategy } from '../domain/strategy-service.js';
import { openStrategyVersions, updateBadge, versionActions, strategyCatalog } from './strategy-versions.js';

const view = { q: '', status: 'all', sortDesc: true, draftsSortDesc: true };
const statusBadge = (s) => UI.badge(store.AG_STRATEGY_STATUS[s.status], s.status === 'published' ? 'blue' : 'gray');
const methodText = (s) => {
  const m = store.agentMethodOf(s.methodId);
  if (!m) return '—';
  return m.requiresRole ? `${m.name}（攻击生成模型：${store.modelName(s.attackerModelId)}）` : m.name;
};
const lines = (arr) => `<div class="cfg-lines">${arr.map((l) => `<div>${UI.esc(l)}</div>`).join('') || '—'}</div>`;

/* ---------------------------------------------------------------- 列表 */
export function agentStrategyPage() {
  let rows = latestStrategyRows(store.agentStrategies);
  if (view.status !== 'all') rows = rows.filter((s) => s.status === view.status);
  if (view.q.trim()) {
    const q = view.q.trim().toLowerCase();
    rows = rows.filter((s) => s.name.toLowerCase().includes(q));
  }
  rows = [...rows].sort((x, y) => compareValues(x.updatedAt, y.updatedAt, view.sortDesc));
  const flt = UI.filters({
    search: { label: '搜索', id: 'ags-q', value: view.q, placeholder: '搜索策略名称', oninput: 'App.agsSearch(this.value)' },
    selects: [{
      label: '状态', id: 'ags-status', value: view.status, onchange: 'App.agsStatus(this.value)',
      options: [['all', '全部状态'], ['published', '已发布'], ['draft', '草稿'], ['disabled','已停用']],
    }],
  });
  const table = UI.pagedTable(
    'ag-strategies',
    [
      { title: '策略名称', render: (s) => `<button class="link-btn" onclick="App.${s.status === 'draft' ? 'editAgStrategy' : 'openAgStrategy'}('${s.id}')">${UI.esc(s.name)}</button>${updateBadge(s,'agent')}` },
      { title: '演练方法', width: '160px', render: (s) => UI.esc(store.agentMethodOf(s.methodId)?.name || '—') },
      { title: '场景题库', render: (s) => lines(store.agentStrategyBankLines(s)) },
      { title: '版本', width: '90px', render: s => UI.linkBtn(releaseLabel(s.version), { onclick: `App.agsVersions('${s.id}')` }) },
      { title: '状态', width: '100px', render: statusBadge },
      { title: '更新时间', width: '150px', cls: 'num', sort: { direction: view.sortDesc ? 'descending' : 'ascending', onclick: 'App.agsSort()' }, render: (s) => UI.esc(s.updatedAt || '—') },
      {
        title: '操作', width: '172px', cls: 'actions',
        render: (s) => `<div class="row-actions strategy-row-actions" data-strategy-status="${s.status}">
          ${s.status === 'draft'
            ? UI.linkBtn('编辑', { onclick: `App.editAgStrategy('${s.id}')` }) + UI.linkBtn('删除', { danger: true, onclick: `App.delAgStrategy('${s.id}')` })
            : UI.linkBtn('详情', { onclick: `App.openAgStrategy('${s.id}')` }) + UI.linkBtn('新版本', { onclick: `App.agsNewVersion('${s.id}')` }) + UI.moreMenu([['复制',`App.copyAgStrategy('${s.id}')`],[s.status==='disabled'?'启用':'停用',`App.agsAvailability('${s.id}',${s.status==='disabled'})`]])}
        </div>`,
      },
    ],
    rows,
    '暂无 智能体演练策略',
  );
  return `${UI.pageHead('智能体演练策略', {
    actions: `
      ${UI.btn('新建演练策略', { kind: 'primary', ico: 'plus', onclick: 'App.newAgStrategy()' })}`,
  })}${flt}${UI.card('', table, '', true)}`;
}

/* 旧的详情路由保留，落到列表并打开抽屉 */
export function agentStrategyDetailPage(cur) {
  if (cur?.param) setTimeout(() => actions.openAgStrategy(cur.param), 0);
  return agentStrategyPage();
}

/* ---------------------------------------------------------------- 编辑 */
let form = null;
const req = '<span class="req">*</span>';

function blankForm() {
  return { id:'',name:'',desc:'',methodId:'',attackerModelId:'',bankId:'',count:null,banks:[{bankId:'',count:null}],status:'draft' };
}

function renderForm() {
  const f = form;
  const opt = (v, l, cur) => `<option value="${UI.esc(v)}" ${v === cur ? 'selected' : ''}>${UI.esc(l)}</option>`;
  const m = store.agentMethodOf(f.methodId);
  const attackers = store.modelsWithRole('攻击生成');
  const attackerField = m?.requiresRole
    ? `<div class="field"><label for="ags-att">攻击生成模型${req}</label>
        <select id="ags-att" onchange="App.agsSet('attackerModelId',this.value)">
          <option value="">请选择攻击生成模型</option>
          ${attackers.map((x) => opt(x.id, x.name, f.attackerModelId)).join('')}
          ${configureModelsOption}
        </select></div>`
    : '';

  const updates=f.id?strategyUpdates(store.getAgentStrategy(f.id),strategyCatalog('agent')):[];
  const body = `<div class="form-secs strategy-form">${updates.length?`<div class="strategy-upgrade-note"><span>${updates.length} 项依赖有更新</span>${UI.linkBtn('更新草稿依赖',{onclick:'App.agsUpgrade()'})}</div>`:''}
    <section class="form-sec"><h3>基本信息</h3>
      <div class="form-row"><div class="field"><label for="ags-name">策略名称${req}</label>
        <input type="text" id="ags-name" value="${UI.esc(f.name)}" placeholder="请输入策略名称" oninput="App.agsSet('name',this.value)" /></div>
      <div class="field"><label for="ags-method">演练方法${req}</label>
        <select id="ags-method" onchange="App.agsSet('methodId',this.value,true)">
          <option value="">请选择演练方法</option>
          ${selectableMethods('agent-method').map((x) => opt(x.id, x.name, f.methodId)).join('')}
        </select></div></div>
      <details class="strategy-optional" ${f.desc?'open':''}><summary>策略描述（选填）</summary><div class="field">
        <textarea id="ags-desc" aria-label="策略描述" rows="2" oninput="App.agsSet('desc',this.value)">${UI.esc(f.desc)}</textarea></div></details>
    </section>
    <section class="form-sec"><h3>场景题库</h3>${agentBankFields()}</section>
    ${attackerField?`<section class="form-sec"><h3>模型配置</h3><div class="form-row">${attackerField}</div></section>`:''}
  </div>`;
  const foot = `
    ${UI.btn('取消', { onclick: 'UI.closeModal()' })}
    ${UI.btn('保存草稿', { onclick: 'App.agsSave(false)' })}
    ${UI.btn('发布', { kind: 'primary', onclick: 'App.agsSave(true)' })}`;
  UI.modal(`${f.id ? '编辑智能体演练策略' : '新建智能体演练策略'} · ${releaseLabel(f.version)}`, body, foot, { wide: true });
}

function agentBankFields(){
  const list=[...selectableAgentBanks()];for(const ref of form.banks){const old=store.getSceneBank(ref.bankId);if(old&&!old.archived&&!list.some(row=>row.id===old.id))list.push(old);}
  return form.banks.map((ref,index)=>{const total=store.getSceneBank(ref.bankId)?.items.length||0;return `<div class="form-row"><div class="field"><label>场景题库${req}</label><select onchange="App.agsBank(${index},'bankId',this.value)"><option value="">请选择题库</option>${list.map(bank=>`<option value="${bank.id}" ${ref.bankId===bank.id?'selected':''}>${UI.esc(bank.name)} · ${bank.source==='system'?'':`${releaseLabel(bank.version)} · `}${bank.items.length} 题</option>`).join('')}</select></div><div class="field"><label>选取题数</label><div class="input-unit"><input type="number" min="1" max="${total||1}" value="${ref.count??total}" ${total?'':'disabled'} oninput="App.agsBank(${index},'count',Number(this.value))"><span>/ ${total} 题</span></div></div>${form.banks.length>1?UI.linkBtn('移除',{onclick:`App.agsRemoveBank(${index})`}):''}</div>`;}).join('')+UI.linkBtn('添加题库',{onclick:'App.agsAddBank()'});
}

/* ---------------------------------------------------------------- 草稿箱 */
export function agentStrategyDraftsPage() {
  const rows = store.agentStrategies.filter((s) => s.status === 'draft').sort((x, y) => compareValues(x.updatedAt, y.updatedAt, view.draftsSortDesc));
  const table = UI.pagedTable(
    'ag-stg-drafts',
    [
      { title: '策略名称', render: (s) => UI.linkBtn(s.name || '未命名策略', { onclick: `App.editAgStrategy('${s.id}')` }) },
      { title: '演练方法', width: '160px', render: (s) => UI.esc(store.agentMethodOf(s.methodId)?.name || '未选择') },
      { title: '场景题库', render: (s) => lines(store.agentStrategyBankLines(s)) },
      { title: '更新时间', width: '150px', cls: 'num', sort: { direction: view.draftsSortDesc ? 'descending' : 'ascending', onclick: 'App.agsSort(true)' }, render: (s) => UI.esc(s.updatedAt || '—') },
      {
        title: '操作', width: '170px', cls: 'actions',
        render: (s) => `<div class="row-actions">
          ${UI.linkBtn('编辑', { onclick: `App.editAgStrategy('${s.id}')` })}
          ${UI.linkBtn('删除', { danger: true, onclick: `App.delAgStrategy('${s.id}')` })}
        </div>`,
      },
    ],
    rows,
    '暂无草稿策略',
  );
  return `${UI.backBtn()}${UI.pageHead('策略草稿箱')}${UI.card('', table, '', true)}`;
}

export const actions = {
  agsNewVersion(id) { try { const next = store.newAgentStrategyVersion(id); UI.closeDrawer(); actions.editAgStrategy(next); } catch (error) { UI.toast(error.message); } },
  ...versionActions,
  agsVersions(id) { openStrategyVersions(id,'agent'); },
  agsAvailability(id,enabled){store.setStrategyStatus(id,enabled,'agent');UI.closeDrawer();router.nav('strategy','ag-strategy');},
  agsUpgrade(){const next=upgradedStrategy({...form,banks:form.banks},strategyCatalog('agent'));form.banks=next.banks;renderForm();UI.toast('已更新草稿依赖');},
  agsBank(index,key,value){form.banks[index][key]=value;if(key==='bankId'){form.banks[index].count=null;renderForm();}},
  agsAddBank(){form.banks.push({bankId:'',count:null});renderForm();},
  agsRemoveBank(index){form.banks.splice(index,1);renderForm();},
  agsSearch(v) { view.q = v; UI.resetPage('ag-strategies'); router.nav('strategy', 'ag-strategy'); },
  agsStatus(v) { view.status = v; UI.resetPage('ag-strategies'); router.nav('strategy', 'ag-strategy'); },
  agsSort(drafts = false) { const key = drafts ? 'draftsSortDesc' : 'sortDesc'; view[key] = !view[key]; router.nav('strategy', drafts ? 'ag-strategy-drafts' : 'ag-strategy'); },
  copyAgStrategy(id) {
    try {
      const copiedId = store.copyAgentStrategy(id);
      view.q = ''; view.status = 'all'; UI.resetPage('ag-strategies');
      UI.closeDrawer(); router.nav('strategy', 'ag-strategy');
      actions.editAgStrategy(copiedId);
      return copiedId;
    } catch (error) { UI.toast(error.message); }
  },
  /* 详情抽屉：与模型演练攻击策略详情同一写法 */
  openAgStrategy(id) {
    const s = store.getAgentStrategy(id);
    if (!s) return;
    if (s.status === 'draft') { UI.closeDrawer(); return actions.editAgStrategy(id); }
    const method = store.agentMethodOf(s.methodId);
    const body = detailContent(detailBlock('策略基础信息', detailFields([
      ['策略名称', s.name], ['策略描述', s.desc], ['版本', releaseLabel(s.version)], ['状态', store.AG_STRATEGY_STATUS[s.status]],
      [s.status === 'published' ? '发布时间' : '更新时间', s.updatedAt],
    ])) + detailBlock('详细配置信息', detailFields([
      ['题库范围', store.agentStrategyBankLines(s).join('；')], ['题目数', store.agentStrategyTaskCount(s)],
    ]) + detailTableField('演练方法', methodConfigurationTable(method ? [{ name: method.name, params: method.params,
      auxiliary: method.requiresRole ? [{ role: '攻击生成模型', name: store.modelName(s.attackerModelId) }] : [] }] : []))));
    const foot = UI.btn('版本记录',{onclick:`App.agsVersions('${s.id}')`}) + UI.btn('创建新版本',{kind:'primary',onclick:`App.agsNewVersion('${s.id}')`}) + UI.btn(s.status==='disabled'?'启用':'停用',{onclick:`App.agsAvailability('${s.id}',${s.status==='disabled'})`}) + UI.btn('关闭',{onclick:'UI.closeDrawer()'});
    openConfigDetail('智能体演练策略详情', body, foot);
  },
  newAgStrategy() { form = blankForm(); renderForm(); },
  editAgStrategy(id) {
    const old = store.getAgentStrategy(id);
    if (!old) return;
    if (old.status !== 'draft') return UI.toast('已发布的策略不可编辑，请创建新版本');
    const b = old.banks?.[0] || {};
    form = { ...blankForm(), ...old, banks:structuredClone(old.banks?.length?old.banks:[{bankId:'',count:null}]), bankId: b.bankId || '', count: b.count ?? null };
    renderForm();
  },
  /* 只有下拉改动重绘；文本与数字输入不重绘，避免失焦 */
  agsSet(k, v, rerender = false) {
    if (k === 'attackerModelId' && v === CONFIGURE_MODEL_VALUE) return configureMoreModels(renderForm, '返回策略配置');
    form[k] = v;
    if (k === 'methodId') {
      const m = store.agentMethodOf(v);
      form.attackerModelId = m?.requiresRole ? (form.attackerModelId || m.defaultModelId || '') : null;
    }
    if(k==='bankId'){form.count=null;form.banks[0]={bankId:v,count:null};}if(k==='count'&&form.banks[0])form.banks[0].count=v;
    if (rerender) renderForm();
  },
  agsSave(publish) {
    const f = form;
    if (!f.name.trim()) return UI.toast('请填写策略名称');
    if (store.agentStrategies.some(s => s.id !== f.id && (s.familyId || s.id) !== f.familyId && s.name.trim().toLowerCase() === f.name.trim().toLowerCase())) return UI.toast('策略名称重复，请修改');
    if (publish && !f.methodId) return UI.toast('请选择演练方法');
    if (publish && store.agentMethodOf(f.methodId)?.requiresRole && !f.attackerModelId) return UI.toast('请选择攻击生成模型');
    const selected=f.banks.filter(ref=>ref.bankId);
    if(publish&&!selected.length)return UI.toast('请选择场景题库');
    if(new Set(selected.map(ref=>ref.bankId)).size!==selected.length)return UI.toast('请勿重复选择题库');
    for(const ref of selected){const bank=store.getSceneBank(ref.bankId),total=bank?.items.length||0;if(!bank||bank.archived)return UI.toast('题库已移除，请重新选择');if(ref.count!==null&&(!Number.isInteger(ref.count)||ref.count<1||ref.count>total))return UI.toast(`题量需在 1–${total} 之间`);}
    store.saveAgentStrategy(freezeStrategyDependencies({
      id:f.id||undefined,familyId:f.familyId,parentId:f.parentId,version:f.version||'1.0',name:f.name.trim(),desc:f.desc,methodId:f.methodId,
      attackerModelId:f.attackerModelId||null,banks:selected.map(ref=>({...ref})),status:publish?'published':'draft',
    },strategyCatalog('agent')));
    UI.closeModal();
    UI.toast(publish ? '策略已发布' : '策略草稿已保存');
    router.nav('strategy', 'ag-strategy');
  },
  pubAgStrategy(id) {
    actions.editAgStrategy(id);
  },
  delAgStrategy(id) {
    const s = store.getAgentStrategy(id);
    if (!s) return;
    UI.modal('删除演练策略', `<p>确定删除「${UI.esc(s.name)}」？${s.status === 'published' ? '删除后不可再用于新建或开始演练，待开始任务需重新选择策略；已开始任务及历史记录保留。' : '删除后不可恢复。'}</p>`,
      `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${UI.btn('删除', { kind: 'danger', onclick: `App.delAgStrategyOk('${id}')` })}`);
  },
  delAgStrategyOk(id) {
    store.deleteAgentStrategy(id);
    UI.closeModal(); UI.closeDrawer();
    UI.toast('已删除');
    router.nav('strategy', 'ag-strategy');
  },
};
