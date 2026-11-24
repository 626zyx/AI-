/* 新建 / 编辑组合攻击策略：推荐路径与四步自定义路径共用一个完整页面。
 * 与新建演练任务同一套交互：可保存草稿，取消时提醒；发布后锁定不可编辑。
 * 裁判模型不属于策略，在创建演练任务时选择。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { configureMoreModels } from '../core/model-config-navigation.js';
import { openResourcePicker, listPickerResources } from '../core/resource-picker.js';
import { selectableModelBanks, selectableMethods } from '../domain/resource-authoring.js';

const st = {
  id: null, name: '', desc: '',
  methods: [],          // [{ name, params: {label: value}, generator, process, open }]
  banks: [],            // [{ bankId, all, count, open }]
  mFamily: 'all', mTurns: 'all', mOpen: false, preset: '',
  bIndustry: 'all', bSource: 'all', bOpen: true,
  step: 0, visited: 0, mode: 'preset', dirty: false, routeKey: null, readOnly: false, error: '',
};

const req = '<span class="req">*</span>';
const auxiliaryModels = () => listPickerResources('model').filter(model => model.status === 'connected');
const encodeName = name => encodeURIComponent(name).replace(/'/g, '%27');
const methodOf = (name) => store.methods.find((m) => m.name.toLowerCase() === name.toLowerCase());
/* 多模态方法需要图像靶标，本平台只演练文本模型，不提供选择 */
const pickable = () => selectableMethods('model-method').filter((m) => m.family !== '多模态' && m.available !== false);
export const methodPresets = [
  { id: 'baseline', name: '基线安全演练', methods: ['Direct'], questions: 120, desc: '直接提问，检查模型的基础安全边界。' },
  { id: 'variants', name: '轻量变体组合', methods: ['Jailbroken', 'CipherChat', 'CodeAttack', 'DeepInception'], questions: 50, desc: '四种单轮方法，覆盖编码、代码封装与语境变体。' },
  { id: 'in-depth', name: '深度安全演练', methods: ['DeepInception', 'ReNeLLM', 'PAIR', 'Crescendo'], questions: 100, desc: '结合语境嵌套、迭代优化与多轮交互。' },
];
const STEPS = ['基本信息', '攻击方法', '题库', '确认与发布'];
let pendingNavigation = null;
const edit = () => !st.readOnly;
const dirty = () => { st.dirty = true; st.error = ''; };
function presetPicker() {
  return `<div class="sa-presets">${methodPresets.map(p => `<button class="sa-preset ra-preset ${st.preset === p.id && st.mode === 'preset' ? 'active' : ''}" type="button" aria-pressed="${st.preset === p.id && st.mode === 'preset'}" onclick="App.sePreset('${p.id}')"><span class="sa-preset-top"><strong>${p.name}</strong><i>${st.preset === p.id && st.mode === 'preset' ? '✓' : ''}</i></span><span class="sa-preset-count"><b>${p.questions}</b> 题 <span>· ${p.methods.length} 种方法</span></span><span class="sa-preset-methods">${p.methods.join(' · ')}</span><small>${p.desc}</small></button>`).join('')}</div><div class="sa-custom-entry">${UI.linkBtn('需要更灵活的测试？自定义方法组合 →', { onclick: 'App.seCustom()' })}</div>`;
}

/* ---------------------------------------------------------------- 攻击方法 */
function methodPicker() {
  if (!st.mOpen) return '';
  const all = pickable();
  const fams = [...new Set(all.map((m) => m.family))];
  let list = all;
  if (st.mFamily !== 'all') list = list.filter((m) => m.family === st.mFamily);
  if (st.mTurns !== 'all') list = list.filter((m) => m.turns === st.mTurns);
  const on = new Set(st.methods.map((m) => m.name));
  const side = [['all', '全部技术路线', all.length], ...fams.map((f) => [f, f, all.filter((m) => m.family === f).length])]
    .map(([v, l, n]) => `<button class="pk-nav ${st.mFamily === v ? 'active' : ''}" onclick="App.seSet('mFamily','${v}')"><span>${UI.esc(l)}</span><span class="num faint">${n}</span></button>`).join('');
  const chips = [['all', '全部轮次'], ['单轮', '单轮'], ['多轮', '多轮']]
    .map(([v, l]) => `<button class="pk-chip ${st.mTurns === v ? 'active' : ''}" onclick="App.seSet('mTurns','${v}')">${l}</button>`).join('');
  const cards = list.map((m) => `<label class="pk-card ${on.has(m.name) ? 'on' : ''}">
      <span class="pk-card-head"><input type="checkbox" ${on.has(m.name) ? 'checked' : ''} onchange="App.seMethod('${encodeName(m.name)}',this.checked)" /><b>${UI.esc(m.name)}</b></span>
      <span class="pk-desc">${UI.esc(m.desc)}</span></label>`).join('') || '<div class="faint">暂无方法</div>';
  return picker(`已选择 ${st.methods.length} 种攻击方法`, 'mOpen', side, chips, cards);
}

function picker(title, openKey, side, chips, cards) {
  return `<div class="pk">
    <button class="pk-head" onclick="App.seSet('${openKey}',${!st[openKey]})"><span>${title}</span><span class="faint">${st[openKey] ? '收起' : '展开'}</span></button>
    ${st[openKey] ? `<div class="pk-body"><div class="pk-side">${side}</div>
      <div class="pk-main"><div class="pk-chips">${chips}</div><div class="pk-grid">${cards}</div></div></div>` : ''}
  </div>`;
}

function paramInput(i, p, v) {
  const id = `se-p-${i}-${p.key}`;
  const on = `App.seParam(${i},'${UI.esc(p.label)}',`;
  if (typeof p.value === 'boolean') {
    return `<div class="field"><label for="${id}">${UI.esc(p.label)}</label>
      <select id="${id}" onchange="${on}this.value==='1')"><option value="1" ${v ? 'selected' : ''}>开启</option><option value="0" ${v ? '' : 'selected'}>关闭</option></select></div>`;
  }
  const num = typeof p.value === 'number';
  return `<div class="field"><label for="${id}">${UI.esc(p.label)}</label>
    <input type="${num ? 'number' : 'text'}" id="${id}" value="${UI.esc(v)}" oninput="${on}${num ? 'Number(this.value)' : 'this.value'})" /></div>`;
}

function methodConfigs() {
  return st.methods.map((sm, i) => {
    const m = methodOf(sm.name);
    const head = `<div class="cfg-card-head"><div><b>${UI.esc(m.name)}</b><div class="faint text-support">${UI.esc(m.desc)}</div></div>
      <span class="row-actions">${UI.linkBtn(sm.open ? '收起' : '展开', { onclick: `App.seToggle('methods',${i})` })}${UI.linkBtn('移除', { onclick: `App.seMethod('${encodeName(m.name)}',false)` })}</span></div>`;
    if (!sm.open) return `<div class="cfg-card">${head}</div>`;
    const params = m.params.length
      ? UI.kvTable(m.params.map(p => [UI.esc(p.label), UI.esc(sm.params[p.label])]))
      : '<div class="faint text-support">使用固定配置，无需填写参数。</div>';
    const sel = (key, label) => {
      const chosen = listPickerResources('model').find(model => model.id === sm[key] || model.assetId === sm[key]);
      const id = `se-${i}-${key}`;
      return `<div class="field"><label for="${id}">${label}${req}</label>
        <button type="button" id="${id}" value="${UI.esc(sm[key] || '')}" class="tw-resource-field${chosen ? ' has-value' : ''}" aria-label="${chosen ? `更换${label}` : `配置${label}`}" onclick="App.sePickAux(${i},'${key}')"><span>${UI.esc(chosen?.displayName || chosen?.name || '+ 配置模型')}</span><span class="tw-resource-action">${chosen ? '更换' : ''}</span></button>
        ${chosen ? `<span class="faint text-support">${UI.esc(chosen.apiModel || chosen.requestId || '')}</span>` : `<span class="faint text-support">从已接入模型中选择。${UI.linkBtn('配置更多模型', { onclick: 'App.seConfigureModels()' })}</span>`}</div>`;
    };
    const aux = m.generator || m.process
      ? `<div class="se-sec mt-16">辅助模型</div><div class="form-row">
          ${m.generator ? sel('generator', '攻击生成模型') : ''}${m.process ? sel('process', '过程裁判') : ''}</div>`
      : '';
    return `<div class="cfg-card">${head}<div class="cfg-card-body">${params}${aux}</div></div>`;
  }).join('');
}

/* ---------------------------------------------------------------- 攻击题库 */
function bankPicker() {
  const selectable = selectableModelBanks();
  const inds = [...new Set([...store.INDUSTRIES, ...selectable.map(b => b.industry)])];
  let list = selectable;
  if (st.bIndustry !== 'all') list = list.filter((b) => b.industry === st.bIndustry);
  if (st.bSource !== 'all') list = list.filter((b) => b.source === st.bSource);
  const on = new Set(st.banks.map((b) => b.bankId));
  const side = [['all', '全部业务领域', selectable.length], ...inds.map((x) => [x, x, selectable.filter((b) => b.industry === x).length])]
    .map(([v, l, n]) => `<button class="pk-nav ${st.bIndustry === v ? 'active' : ''}" onclick="App.seSet('bIndustry','${v}')"><span>${UI.esc(l)}</span><span class="num faint">${n}</span></button>`).join('');
  const chips = [['all', '全部来源'], ['system', '系统题库'], ['custom', '自建题库']]
    .map(([v, l]) => `<button class="pk-chip ${st.bSource === v ? 'active' : ''}" onclick="App.seSet('bSource','${v}')">${l}</button>`).join('');
  const cards = list.map((b) => `<label class="pk-card ${on.has(b.id) ? 'on' : ''}">
      <span class="pk-card-head"><input type="checkbox" ${on.has(b.id) ? 'checked' : ''} onchange="App.seBank('${b.id}',this.checked)" /><b>${UI.esc(b.name)}</b></span>
      <span class="pk-desc num">${b.items.length} 题</span></label>`).join('') || '<div class="faint">该筛选下暂无题库</div>';
  return picker(`已选择 ${st.banks.length} 套攻击题库`, 'bOpen', side, chips, cards);
}

function bankConfigs() {
  return `<div class="bank-cfgs">${st.banks.map((sb, i) => {
    const b = store.getBank(sb.bankId);
    if (!b) return '<p class="sa-error">引用的题库不可用，请重新选择。</p>';
    const n = b.items.length;
    const head = `<div class="cfg-card-head"><div><b>${UI.esc(b.name)}</b><div class="faint text-support num">${sb.all ? `全部 ${n} 题` : `前 ${sb.count} 题`} · 共 ${n} 题</div></div>
      <span class="row-actions">${UI.linkBtn(sb.open ? '收起' : '展开', { onclick: `App.seToggle('banks',${i})` })}${UI.linkBtn('移除', { onclick: `App.seBank('${b.id}',false)` })}</span></div>`;
    if (!sb.open) return `<div class="cfg-card">${head}</div>`;
    return `<div class="cfg-card">${head}<div class="cfg-card-body">
      <label class="pop-opt"><input type="radio" name="se-b-${i}" ${sb.all ? 'checked' : ''} onchange="App.seBankAll(${i},true)" />全部题目（${n} 题）</label>
      <label class="pop-opt"><input type="radio" name="se-b-${i}" ${sb.all ? '' : 'checked'} onchange="App.seBankAll(${i},false)" />前
        <input type="number" class="se-n" min="1" max="${n}" value="${sb.count}" oninput="App.seBankN(${i},this.value)" /> 题</label>
    </div></div>`;
  }).join('')}</div>`;
}

/* ---------------------------------------------------------------- 页面与步骤 */
function render({ top = false } = {}) {
  router.nav('strategy', 'strategy-create', st.id || null, { replace: true });
  if (top) { const main = document.getElementById('app-main'); if (main) main.scrollTop = 0; }
}
function fail(message) { st.error = message; render(); UI.toast(message); return false; }
function basicStep() {
  return `<section class="sa-section"><h2>基本信息</h2><div class="sa-basic-fields"><div class="field"><label for="se-name">策略名称${req}</label><input id="se-name" maxlength="100" value="${UI.esc(st.name)}" placeholder="请输入策略名称" oninput="App.seField('name',this.value)"></div><div class="field"><label for="se-desc">策略描述</label><textarea id="se-desc" rows="2" placeholder="选填" oninput="App.seField('desc',this.value)">${UI.esc(st.desc)}</textarea></div></div></section><section class="sa-section"><div class="sa-section-heading"><h2>推荐策略</h2><span>选择后直接确认配置</span></div>${presetPicker()}</section>`;
}
function methodStep() { return `<section class="sa-section"><h2>选择攻击方法</h2>${methodPicker()}</section>${st.methods.length ? `<section class="sa-section"><h2>方法配置</h2><div class="sa-method-configs">${methodConfigs()}</div></section>` : ''}`; }
function bankStep() { return `<section class="sa-section"><h2>选择题库</h2>${bankPicker()}</section>${st.banks.length ? `<section class="sa-section"><h2>选题范围</h2>${bankConfigs()}</section>` : ''}`; }
const modelName = id => listPickerResources('model').find(row => row.id === id || row.assetId === id)?.name || store.models.find(row => row.id === id)?.name || '待配置';
function confirmationStep() {
  const total = st.banks.reduce((sum, ref) => sum + (ref.all ? store.getBank(ref.bankId)?.items.length || 0 : ref.count), 0);
  const plan = methodPresets.find(item => item.id === st.preset);
  const methodRows = st.methods.map((method, index) => {
    const def = methodOf(method.name);
    const params = Object.entries(method.params).map(([key, value]) => `<div><span class="sa-param-key">${UI.esc(key)}</span>${UI.esc(typeof value === 'boolean' ? value ? '开启' : '关闭' : value)}</div>`).join('') || '无额外参数';
    const role = (key, label) => `<div class="sa-aux-line"><span>${label}</span>${!st.readOnly ? `<button type="button" id="se-${index}-${key}" class="link-btn" aria-label="${method[key] ? `更换${label}` : `配置${label}`}" value="${UI.esc(method[key] || '')}" onclick="App.sePickAux(${index},'${key}')">${UI.esc(method[key] ? modelName(method[key]) : '+ 配置模型')}</button>` : UI.esc(modelName(method[key]))}</div>`;
    return { name: method.name, params, aux: `${def?.generator ? role('generator', '攻击生成模型') : ''}${def?.process ? role('process', '过程裁判') : ''}` || '<span class="faint">无需辅助模型</span>' };
  });
  return `<section class="sa-section"><div class="sa-confirm-heading"><div><h2>${UI.esc(st.name || '未命名策略')}</h2><p>${UI.esc(st.desc || '未填写描述')}</p></div>${UI.badge(st.readOnly ? '已发布' : '待确认', st.readOnly ? 'green' : 'blue')}</div><div class="sa-overview"><div><span>配置方式</span><strong>${st.mode === 'preset' && plan ? plan.name : '自定义组合'}</strong></div><div><span>题目数量</span><strong>${total}<small> 题</small></strong></div><div><span>攻击方法</span><strong>${st.methods.length}<small> 种</small></strong></div><div><span>执行单元</span><strong>${total * st.methods.length}<small> 个</small></strong></div></div></section><section class="sa-section"><div class="sa-section-heading"><h2>攻击方法与执行参数</h2>${!st.readOnly ? UI.linkBtn('自定义调整', { onclick: 'App.seCustomizeStep(1)' }) : ''}</div>${UI.table([{ title: '攻击方法', width: '140px', key: 'name' }, { title: '执行参数', render: row => `<div class="sa-params">${row.params}</div>` }, { title: '辅助模型', width: '270px', render: row => row.aux }], methodRows, '尚未选择攻击方法')}</section><section class="sa-section"><div class="sa-section-heading"><h2>题库与选题范围</h2>${!st.readOnly ? UI.linkBtn('调整题库', { onclick: 'App.seCustomizeStep(2)' }) : ''}</div>${UI.table([{ title: '题库', render: ref => UI.esc(store.getBank(ref.bankId)?.name || '题库不可用') }, { title: '业务领域', render: ref => UI.esc(store.getBank(ref.bankId)?.industry || '—') }, { title: '选题范围', width: '180px', render: ref => ref.all ? `全部 ${store.getBank(ref.bankId)?.items.length || 0} 题` : `前 ${ref.count} 题` }], st.banks)}</section>`;
}
function reset(id = null) {
  Object.assign(st, { id: null, name: '', desc: '', methods: [], banks: [], mFamily: 'all', mTurns: 'all', mOpen: true, preset: '', bIndustry: 'all', bSource: 'all', bOpen: true, step: 0, visited: 0, mode: 'preset', dirty: false, readOnly: false, error: '', routeKey: id || '__new' });
  if (id) {
    const record = store.strategies.find(row => row.id === id);
    if (!record) return false;
    fromRecord(record);
    st.readOnly = record.status === 'published';
    if (st.readOnly) st.step = 3;
  }
  return true;
}
export function strategyEditorPage(cur = {}) {
  const key = cur.param || '__new';
  if (st.routeKey !== key && !reset(cur.param)) return UI.pageHead('组合攻击策略') + '<div class="empty">策略不存在或已删除</div>';
  const canOpen = step => !st.readOnly && (step === 0 || st.mode === 'custom' && step <= st.visited || step === 3 && st.visited === 3);
  const steps = `<ol class="sa-steps">${STEPS.map((label, index) => `<li class="${index === st.step ? 'active' : index < st.step ? 'complete' : ''}"><button type="button" ${canOpen(index) ? `onclick="App.seStep(${index})"` : 'disabled'} ${index === st.step ? 'aria-current="step"' : ''}><i>${index + 1}</i><span>${label}</span>${st.mode === 'preset' && (index === 1 || index === 2) ? '<small>推荐配置</small>' : ''}</button></li>`).join('')}</ol>`;
  const content = st.step === 0 ? basicStep() : st.step === 1 ? methodStep() : st.step === 2 ? bankStep() : confirmationStep();
  const previous = st.step > 0 ? UI.btn('上一步', { onclick: 'App.sePrevious()' }) : '';
  const footer = st.readOnly ? UI.btn('返回列表', { onclick: "App.go('strategy','attack')" }) : UI.btn('取消', { onclick: 'App.seCancel()' }) + previous + UI.btn('保存草稿', { onclick: 'App.seDraft()' }) + UI.btn(st.step === 3 ? '发布策略' : st.step === 0 && st.mode === 'preset' ? '确认推荐配置' : '下一步', { kind: 'primary', onclick: st.step === 3 ? 'App.sePublish()' : 'App.seNext()' });
  return UI.pageHead(st.readOnly ? '组合攻击策略详情' : st.id ? '编辑组合攻击策略' : '新建组合攻击策略', { back: UI.backBtn().replace('App.back()', 'App.seCancel()') }) + `<div class="strategy-authoring-page">${steps}<div class="sa-content">${st.error ? `<p class="sa-error" role="alert">${UI.esc(st.error)}</p>` : ''}${content}</div><footer class="sa-footer"><span>${st.readOnly ? '已发布' : st.dirty ? '有未保存的更改' : st.id ? '草稿已保存' : ''}</span><div>${footer}</div></footer></div>`;
}

/* ---------------------------------------------------------------- 存取 */
function toRecord(status) {
  const name = (id) => store.models.find((m) => m.id === id)?.name;
  return {
    id: st.id, name: st.name.trim(), desc: st.desc.trim(), status,
    authoringMode: st.mode, authoringPreset: st.preset, authoringStep: st.step, authoringVisited: st.visited,
    banks: st.banks.map((b) => ({ bankId: b.bankId, count: b.all ? null : b.count })),
    methods: st.methods.map((sm, i) => ({
      name: sm.name, order: i + 1,
      params: [
        ...Object.entries(sm.params),
        ...(sm.generator ? [['攻击生成模型', name(sm.generator)]] : []),
        ...(sm.process ? [['过程裁判', name(sm.process)]] : []),
      ],
      aux: { generator: sm.generator, process: sm.process },
    })),
  };
}
function fromRecord(s) {
  const byName = (n) => store.models.find((m) => m.name === n)?.id || '';
  Object.assign(st, {
    id: s.id, name: s.name, desc: s.desc || '',
    mode: s.authoringMode || 'custom', preset: s.authoringPreset || '', step: s.authoringStep || 0, visited: s.authoringVisited || 0,
    banks: s.banks.map((b) => ({ bankId: b.bankId, all: !b.count, count: b.count || 20, open: true })),
    methods: s.methods.filter((m) => methodOf(m.name)).map((m) => {
      const def = methodOf(m.name);
      const params = Object.fromEntries(def.params.map((p) => [p.label, p.value]));
      m.params.forEach(([k, v]) => { if (k in params) params[k] = v; });
      const get = (k) => m.aux?.[k] || byName(m.params.find(([x]) => x === (k === 'generator' ? '攻击生成模型' : '过程裁判'))?.[1]);
      return { name: def.name, params, generator: get('generator'), process: get('process'), open: false };
    }),
  });
}
const nameTaken = () => store.strategies.some((s) => s.id !== st.id && s.name === st.name.trim());

function validateBasic() { if (!st.name.trim()) return '请输入策略名称'; if (nameTaken()) return '策略名称重复，请修改'; return ''; }
function validate() {
  if (!st.name.trim()) return '请输入策略名称';
  if (nameTaken()) return '策略名称重复，请修改';
  if (!st.methods.length) return '请至少选择一种攻击方法';
  for (const sm of st.methods) {
    const m = methodOf(sm.name);
    if (!m || m.available === false) return '所选攻击方法不可用，请重新选择';
    if (m.generator && !auxiliaryModels().some(model => model.id === sm.generator || model.assetId === sm.generator)) return `请为 ${m.name} 选择可用的攻击生成模型`;
    if (m.process && !auxiliaryModels().some(model => model.id === sm.process || model.assetId === sm.process)) return `请为 ${m.name} 选择可用的过程裁判`;
  }
  if (!st.banks.length) return '请至少选择一套攻击题库';
  for (const sb of st.banks) {
    const bank = store.getBank(sb.bankId);
    if (!bank || bank.status === 'draft') return '所选题库不可用，请重新选择已发布题库';
    const n = bank.items.length;
    if (!sb.all && !(Number.isInteger(sb.count) && sb.count >= 1 && sb.count <= n)) return `题量需在 1–${n} 之间`;
  }
  return '';
}
function done(msg) {
  st.dirty = false; st.routeKey = null; pendingNavigation = null;
  UI.closeModal();
  UI.toast(msg);
  UI.resetPage('strategies');
  router.nav('strategy', 'attack');
}

export function openEditor(id = null) {
  if (id && !store.strategies.some(row => row.id === id && row.status === 'draft')) return UI.toast('仅草稿策略可编辑');
  if (router.state().sub === 'strategy-create' && (router.state().param || null) === id && st.dirty) return render();
  return router.nav('strategy', 'strategy-create', id, { onCommit: () => { reset(id); UI.closeModal(); UI.closeDrawer(); } });
}
function saveDraft() {
  const error = validateBasic(); if (error) throw Error(error);
  const id = store.saveStrategy(toRecord('draft')); st.id = id; st.routeKey = id; st.dirty = false; return id;
}
router.beforeNavigate(transition => {
  if (transition.from.sub !== 'strategy-create' || !st.dirty || st.readOnly || transition.options.purpose === 'configure-models') return;
  pendingNavigation = transition;
  UI.modal('保存策略更改', '<p>当前策略还有未保存的更改。</p>', UI.btn('继续编辑', { onclick: 'App.seBack()' }) + UI.btn('放弃更改', { onclick: 'App.seLeave(false)' }) + UI.btn('保存并离开', { kind: 'primary', onclick: 'App.seLeave(true)' }));
  return false;
});
export const actions = {
  newStrategy() { openEditor(); },
  editStrategy(id) { openEditor(id); },
  seField(k, v) { if (edit() && ['name', 'desc'].includes(k)) { st[k] = v; dirty(); } },
  seSet(k, v) { if (!edit()) return; if (k === 'mOpen' && v && st.step === 0) return actions.seCustom(); if (!['mFamily', 'mTurns', 'mOpen', 'bIndustry', 'bSource', 'bOpen'].includes(k)) return; st[k] = v; render(); },
  sePreset(id) {
    if (!edit()) return;
    const preset = methodPresets.find(p => p.id === id); if (!preset) return;
    const available = pickable();
    if (preset.methods.some(name => !available.some(method => method.name.toLowerCase() === name.toLowerCase()))) return fail('该推荐组合中的方法不可用，请选择其他组合');
    const banks = selectableModelBanks(), bank = banks.find(b => b.id === 'bank-advbench');
    if (!bank || bank.items.length < preset.questions) return fail('推荐题库的有效题量不足，请使用自定义组合');
    st.methods = preset.methods.map(name => { const method = methodOf(name); return { name: method.name, params: Object.fromEntries(method.params.map(p => [p.label, p.value])), generator: '', process: '', open: true }; });
    st.banks = [{ bankId: bank.id, all: false, count: preset.questions, open: true }];
    st.mode = 'preset'; st.preset = id; st.mOpen = true; st.bOpen = true; st.visited = 0; dirty(); render();
  },
  seCustom() { if (!edit()) return; const error = validateBasic(); if (error) return fail(error); st.mode = 'custom'; st.preset = ''; st.step = 1; st.visited = Math.max(st.visited, 1); st.mOpen = true; dirty(); render({ top: true }); },
  seCustomizeStep(step) { if (!edit() || ![1, 2].includes(step)) return; st.mode = 'custom'; st.preset = ''; st.step = step; st.visited = Math.max(st.visited, step); st.mOpen = true; st.bOpen = true; dirty(); render({ top: true }); },
  seNext() {
    if (!edit()) return;
    const basic = validateBasic(); if (basic) return fail(basic);
    if (st.step === 0 && st.mode === 'preset') { if (!st.preset) return fail('请选择推荐策略，或使用自定义方法组合'); st.step = 3; }
    else if (st.step === 0) st.step = 1;
    else if (st.step === 1) { if (!st.methods.length) return fail('请至少选择一种攻击方法'); st.step = 2; }
    else if (st.step === 2) { const error = validate(); if (error) return fail(error); st.step = 3; }
    st.visited = Math.max(st.visited, st.step); st.error = ''; render({ top: true });
  },
  sePrevious() { if (!edit()) return; st.step = st.mode === 'preset' ? 0 : Math.max(0, st.step - 1); st.error = ''; render({ top: true }); },
  seStep(step) { if (!edit() || !Number.isInteger(step) || step < 0 || step > st.visited || st.mode === 'preset' && ![0, 3].includes(step)) return; if (step > st.step) { const error = step === 3 ? validate() : validateBasic(); if (error) return fail(error); } st.step = step; st.error = ''; render({ top: true }); },
  seMethod(name, on) {
    if (!edit()) return; name = decodeURIComponent(name); const method = pickable().find(item => item.name.toLowerCase() === name.toLowerCase()); if (!method) return fail('该攻击方法不可用');
    st.mode = 'custom'; st.preset = ''; st.methods = st.methods.filter(item => item.name !== method.name);
    if (on) st.methods.push({ name: method.name, params: Object.fromEntries(method.params.map(p => [p.label, p.value])), generator: '', process: '', open: true });
    dirty(); render();
  },
  seParam(i, label, v) { if (!edit() || !st.methods[i] || !(label in st.methods[i].params)) return; st.methods[i].params[label] = v; dirty(); },
  seConfigureModels() { configureMoreModels(render, '返回策略配置'); },
  sePickAux(i, key) {
    const method = st.methods[i]; if (!edit() || !method || !['generator', 'process'].includes(key)) return;
    openResourcePicker({ kind: 'model', value: method[key], title: key === 'generator' ? '选择攻击生成模型' : '选择过程裁判模型', onSelect: resource => { method[key] = resource.id; dirty(); render(); } });
  },
  seAux(i, key, value) { if (edit() && st.methods[i] && ['generator', 'process'].includes(key)) { st.methods[i][key] = value; dirty(); } },
  seToggle(kind, i) { if (!['methods', 'banks'].includes(kind) || !st[kind][i]) return; st[kind][i].open = !st[kind][i].open; render(); },
  seBank(id, on) { if (!edit()) return; const bank = store.getBank(id); if (!bank) return fail('题库不可用'); st.mode = 'custom'; st.preset = ''; st.banks = st.banks.filter(b => b.bankId !== id); if (on) st.banks.push({ bankId: id, all: true, count: Math.min(20, bank.items.length), open: true }); dirty(); render(); },
  seBankAll(i, all) { if (!edit() || !st.banks[i]) return; st.banks[i].all = all; dirty(); render(); },
  seBankN(i, value) { if (!edit() || !st.banks[i]) return; st.banks[i].count = Number(value); dirty(); },
  sePublish() { if (!edit()) return; const error = validate(); if (error) return fail(error); if (st.step !== 3) return fail('请先进入确认步骤审阅配置'); try { store.saveStrategy(toRecord('published')); done('策略已发布'); } catch (error) { fail(error.message); } },
  seDraft() { if (!edit()) return; try { saveDraft(); done('已保存为草稿'); } catch (error) { fail(error.message); } },
  seCancel() { router.nav('strategy', 'attack'); },
  seBack() { pendingNavigation = null; UI.closeModal(); },
  seLeave(save) { try { if (save) saveDraft(); else st.dirty = false; st.routeKey = null; UI.closeModal(); const pending = pendingNavigation; pendingNavigation = null; pending?.proceed(); } catch (error) { UI.toast(error.message); } },
};
