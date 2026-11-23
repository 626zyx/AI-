/* 新建 / 编辑模型演练策略：单个弹窗。从已有攻击方法与场景题库中选取并配置。
 * 与新建演练任务同一套交互：可保存草稿（待发布），取消时提醒；发布后锁定不可编辑。
 * 防护方法随策略发布固定；裁判模型在创建演练任务时配置。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { CONFIGURE_MODEL_VALUE, configureModelsOption, configureMoreModels } from '../core/model-config-navigation.js';
import { selectableModelBanks, selectableMethods } from '../domain/resource-authoring.js';
import { releaseLabel, freezeStrategyDependencies, strategyUpdates, upgradedStrategy } from '../domain/strategy-service.js';
import { methodDependencies } from '../domain/method-catalog.js';

const st = {
  id: null, name: '', desc: '', guardId: '', guardStages: [], targetCapability: 'text', parentId: null,
  methods: [],          // [{ name, params: {label: value}, generator, process, open }]
  banks: [],            // [{ bankId, all, count, open }]
  mFamily: 'all', mTurns: 'all', mOpen: false, preset: '', familyId: null, version: '1.0',
  bIndustry: 'all', bSource: 'all', bOpen: true,
};

const req = '<span class="req">*</span>';
const genModels = () => store.modelsWithRole('攻击生成');
const encodeName = name => encodeURIComponent(name).replace(/'/g, '%27');
const methodOf = (name) => store.methods.find((m) => m.name.toLowerCase() === name.toLowerCase());
/* 所有方法均进入目录，按靶标的输入能力与内部访问能力限制选择。 */
const pickable = () => selectableMethods('model-method');
const compatible = m => m.family === '白盒优化' ? st.targetCapability === 'local' : m.family === '多模态' ? ['image','local'].includes(st.targetCapability) : true;
const catalog = () => ({ banks:store.banks,guards:store.guards,models:store.models });
const additionalDependencies = m => methodDependencies(m).filter(role => !['攻击生成模型','裁判模型'].includes(role)).map(role => ({role,key:role==='文本嵌入模型'||role==='图文嵌入模型'?'embedding':role==='图像生成模型'?'imageGenerator':'vision',models:store.modelsWithRole(role==='图文嵌入模型'?'文本嵌入':role.replace(/模型$/, ''))}));
const methodPresets = [
  { id: 'baseline', name: '直接基线', methods: ['Direct'], questions: 20, desc: '20 题 · 原样测试' },
  { id: 'variants', name: '轻量变体', methods: ['Direct', 'Jailbroken'], questions: 50, desc: '50 题 · 编码与表达变体' },
  { id: 'in-depth', name: '深入演练', methods: ['Direct', 'DeepInception', 'PAIR'], questions: 100, desc: '100 题 · 语境嵌套与迭代优化' },
];
function presetPicker() {
  return `<div class="ra-preset-grid">${methodPresets.map(p => `<button class="ra-preset ${st.preset === p.id ? 'active' : ''}" type="button" onclick="App.sePreset('${p.id}')"><strong>${p.name}</strong><span>${p.methods.join(' + ')}</span><small>${p.desc}</small></button>`).join('')}</div>${UI.linkBtn(st.mOpen ? '收起方法组合' : '自定义方法组合', { onclick: `App.seSet('mOpen',${!st.mOpen})` })}`;
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
      <span class="pk-card-head"><input type="checkbox" ${on.has(m.name) ? 'checked' : ''} ${compatible(m)?'':'disabled'} onchange="App.seMethod('${encodeName(m.name)}',this.checked)" /><b>${UI.esc(m.name)}</b></span>
      <span class="pk-desc">${UI.esc(m.desc)}</span>${compatible(m)?'':`<small class="text-support faint">${UI.esc(m.requirements)}</small>`}</label>`).join('') || '<div class="faint">暂无方法</div>';
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
    const head = `<div class="cfg-card-head"><div><b>${UI.esc(m.name)}</b></div>
      <span class="row-actions">${UI.linkBtn(sm.open ? '收起' : '展开', { onclick: `App.seToggle('methods',${i})` })}${UI.linkBtn('移除', { onclick: `App.seMethod('${encodeName(m.name)}',false)` })}</span></div>`;
    if (!sm.open) return `<div class="cfg-card">${head}</div>`;
    const params = m.params.length
      ? `<details><summary class="faint text-support">查看固定执行参数</summary>${UI.kvTable(m.params.map(p => [UI.esc(p.label), UI.esc(sm.params[p.label])]))}</details>`
      : '';
    const sel = (key, label, list) => `<div class="field"><label>${label}${req}</label>
      <select onchange="App.seAux(${i},'${key}',this.value)"><option value="">${list.length ? `请选择${label}` : `暂无可用的${label}模型`}</option>
      ${list.map((x) => `<option value="${x.id}" ${sm[key] === x.id ? 'selected' : ''}>${UI.esc(x.name)}</option>`).join('')}
      ${configureModelsOption}</select>
      ${list.length ? '' : `<span class="faint text-support">需先在平台管理中为模型配置「${label === '裁判模型' ? '裁判' : '攻击生成'}」角色，${UI.linkBtn('去配置', { onclick: 'App.seConfigureModels()' })}</span>`}</div>`;
    const aux = m.generator || additionalDependencies(m).length
      ? `<div class="se-sec mt-16">辅助模型</div><div class="form-row">
          ${m.generator ? sel('generator', '攻击生成模型', genModels()) : ''}${additionalDependencies(m).map(dep=>sel(dep.key,dep.role,dep.models)).join('')}</div>`
      : '';
    return `<div class="cfg-card">${head}${params||aux?`<div class="cfg-card-body">${params}${aux}</div>`:''}</div>`;
  }).join('');
}

/* ---------------------------------------------------------------- 场景题库 */
function bankPicker() {
  const selectable = [...selectableModelBanks()]; for(const ref of st.banks){const old=store.getBank(ref.bankId);if(old&&!selectable.some(b=>b.id===old.id))selectable.push(old);}
  const inds = [...new Set([...store.INDUSTRIES, ...selectable.map(b => b.industry)])];
  let list = selectable;
  if (st.bIndustry !== 'all') list = list.filter((b) => b.industry === st.bIndustry);
  if (st.bSource !== 'all') list = list.filter((b) => b.source === st.bSource);
  const on = new Set(st.banks.map((b) => b.bankId));
  const side = [['all', '全部行业', selectable.length], ...inds.map((x) => [x, x, selectable.filter((b) => b.industry === x).length])]
    .map(([v, l, n]) => `<button class="pk-nav ${st.bIndustry === v ? 'active' : ''}" onclick="App.seSet('bIndustry','${v}')"><span>${UI.esc(l)}</span><span class="num faint">${n}</span></button>`).join('');
  const chips = [['all', '全部来源'], ['system', '系统题库'], ['custom', '自建题库']]
    .map(([v, l]) => `<button class="pk-chip ${st.bSource === v ? 'active' : ''}" onclick="App.seSet('bSource','${v}')">${l}</button>`).join('');
  const cards = list.map((b) => `<label class="pk-card ${on.has(b.id) ? 'on' : ''}">
      <span class="pk-card-head"><input type="checkbox" ${on.has(b.id) ? 'checked' : ''} onchange="App.seBank('${b.id}',this.checked)" /><b>${UI.esc(b.name)}</b></span>
      <span class="pk-desc num">${b.source==='system'?'':`${releaseLabel(b.version)} · `}${b.items.length} 题</span></label>`).join('') || '<div class="faint">该筛选下暂无题库</div>';
  return picker(`已选择 ${st.banks.length} 套场景题库`, 'bOpen', side, chips, cards);
}

function bankConfigs() {
  return `<div class="bank-cfgs">${st.banks.map((sb, i) => {
    const b = store.getBank(sb.bankId);
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

function upgradeNotice() {
  const source=st.id&&store.strategies.find(s=>s.id===st.id);if(!source)return '';
  const updates=strategyUpdates(source,catalog());
  return updates.length?`<div class="strategy-upgrade-note"><span>${updates.length} 项依赖有更新</span>${UI.linkBtn('更新草稿依赖',{onclick:'App.seUpgradeResources()'})}</div>`:'';
}
function guardConfiguration() {
  const guard=store.guards.find(g=>g.id===st.guardId);
  return `<section class="form-sec"><h3>防护配置</h3><div class="form-row"><div class="field"><label>防护方法</label><select onchange="App.seGuard(this.value)"><option value="">不启用防护</option>${store.guards.filter(g=>g.status==='published').map(g=>`<option value="${g.id}" ${st.guardId===g.id?'selected':''}>${UI.esc(g.name)}${g.builtin?'':` · ${releaseLabel(g.version)}`}</option>`).join('')}</select></div>${guard?`<div class="field"><label>审核位置${req}</label><div class="tw-choices">${guard.stages.map(stage=>`<label><input type="checkbox" ${st.guardStages.includes(stage)?'checked':''} onchange="App.seGuardStage('${stage}',this.checked)">${stage}审核</label>`).join('')}</div></div>`:''}</div>${guard?`<div class="faint text-support">${guard.builtin?'':`防护模型：${UI.esc(store.modelName(guard.modelId))} · `}${guard.stages.includes('输入')?'输入：请求送达靶标前审核':''}${guard.stages.length===2?'；':''}${guard.stages.includes('输出')?'输出：回复交付前审核':''}</div>`:''}</section>`;
}

/* ---------------------------------------------------------------- 渲染 */
function render() {
  const keep = document.querySelector('#modal .modal-body')?.scrollTop || 0;
  const body = `<div class="form-secs strategy-form">${upgradeNotice()}
    <section class="form-sec"><h3>基本信息</h3>
      <div class="form-row"><div class="field"><label for="se-name">策略名称${req}</label>
        <input type="text" id="se-name" value="${UI.esc(st.name)}" placeholder="请输入策略名称" oninput="App.seField('name',this.value)" /></div>
      <div class="field"><label for="se-capability">靶标能力</label><select id="se-capability" onchange="App.seSet('targetCapability',this.value)">${[['text','文本接口'],['image','图像与文本接口'],['local','本地模型内部访问']].map(([id,label])=>`<option value="${id}" ${st.targetCapability===id?'selected':''}>${label}</option>`).join('')}</select></div></div>
      <details class="strategy-optional" ${st.desc?'open':''}><summary>策略描述（选填）</summary><div class="field">
        <textarea id="se-desc" aria-label="策略描述" rows="2" oninput="App.seField('desc',this.value)">${UI.esc(st.desc)}</textarea></div></details>
    </section>
    <section class="form-sec"><h3>演练方法${req}</h3>
      ${presetPicker()}${methodPicker()}${methodConfigs()}</section>
    <section class="form-sec"><h3>场景题库${req}</h3>${bankPicker()}${bankConfigs()}</section>${guardConfiguration()}
  </div>`;
  const footer = `${UI.btn('取消', { onclick: 'App.seCancel()' })}${UI.btn('保存草稿', { onclick: 'App.seDraft()' })}${UI.btn('发布', { kind: 'primary', onclick: 'App.sePublish()' })}`;
  UI.modal(`${st.id ? '编辑模型演练策略' : '新建模型演练策略'} · ${releaseLabel(st.version)}`, body, footer, { wide: true });
  const el = document.querySelector('#modal .modal-body');
  if (el) el.scrollTop = keep;
}

/* ---------------------------------------------------------------- 存取 */
function toRecord(status) {
  const name = (id) => store.models.find((m) => m.id === id)?.name;
  return freezeStrategyDependencies({
    guardId:st.guardId||null, guardEnabled:!!st.guardId, guardStages:[...st.guardStages], targetCapability:st.targetCapability, parentId:st.parentId,
    id: st.id, familyId: st.familyId || undefined, version: st.version, name: st.name.trim(), desc: st.desc.trim(), status,
    banks: st.banks.map((b) => ({ bankId: b.bankId, count: b.all ? null : b.count })),
    methods: st.methods.map((sm, i) => ({
      name: sm.name, order: i + 1,
      params: [
        ...Object.entries(sm.params),
        ...(sm.generator ? [['攻击生成模型', name(sm.generator)]] : []),
        ...additionalDependencies(methodOf(sm.name)).filter(dep=>sm[dep.key]).map(dep=>[dep.role,name(sm[dep.key])]),
      ],
      aux: { generator: sm.generator, ...Object.fromEntries(additionalDependencies(methodOf(sm.name)).map(dep=>[dep.key,sm[dep.key]||''])) },
    })),
  }, catalog());
}
function fromRecord(s) {
  const byName = (n) => store.models.find((m) => m.name === n)?.id || '';
  Object.assign(st, {
    id: s.id, familyId: s.familyId, parentId:s.parentId, guardId:s.guardId||'',guardStages:[...(s.guardStages||[])],targetCapability:s.targetCapability||'text', version: s.version || '1.0', name: s.name, desc: s.desc || '',
    banks: s.banks.map((b) => ({ bankId: b.bankId, all: !b.count, count: b.count || 20, open: true })),
    methods: s.methods.filter((m) => methodOf(m.name)).map((m) => {
      const def = methodOf(m.name);
      const params = Object.fromEntries(def.params.map((p) => [p.label, p.value]));
      m.params.forEach(([k, v]) => { if (k in params) params[k] = v; });
      const generator = m.aux?.generator || byName(m.params.find(([label]) => label === '攻击生成模型')?.[1]);
      return { name: def.name, params, generator, ...Object.fromEntries(additionalDependencies(def).map(dep=>[dep.key,m.aux?.[dep.key]||''])), open: false };
    }),
  });
}
const nameTaken = () => store.strategies.some((s) => s.id !== st.id && (s.familyId || s.id) !== st.familyId && s.name === st.name.trim());

function validate() {
  if (!st.name.trim()) return '请输入策略名称';
  if (nameTaken()) return '策略名称重复，请修改';
  if (!st.methods.length) return '请至少选择一种攻击方法';
  for (const sm of st.methods) {
    const m = methodOf(sm.name);
    if (m.generator && !sm.generator) return `请为 ${m.name} 选择攻击生成模型`;
    if (!compatible(m)) return `${m.name} 与所选靶标能力不兼容`;
    for(const dep of additionalDependencies(m))if(!sm[dep.key])return `请为 ${m.name} 选择${dep.role}`;
  }
  if(st.guardId && (!store.guards.some(g=>g.id===st.guardId&&g.status==='published')||!st.guardStages.length)) return '请选择防护方法及审核位置';
  if (!st.banks.length) return '请至少选择一套场景题库';
  for (const sb of st.banks) {
    const n = store.getBank(sb.bankId).items.length;
    if (!sb.all && !(sb.count >= 1 && sb.count <= n)) return `题量需在 1–${n} 之间`;
  }
  return '';
}
function done(msg) {
  UI.closeModal();
  UI.toast(msg);
  UI.resetPage('strategies');
  router.nav('strategy', 'attack');
}

export function openEditor(id = null) {
  Object.assign(st, { id: null, familyId: null, version: '1.0', name: '', desc: '', guardId:'',guardStages:[],targetCapability:'text',parentId:null, methods: [], banks: [], mFamily: 'all', mTurns: 'all', mOpen: false, preset: '', bIndustry: 'all', bSource: 'all', bOpen: true });
  if (id) {
    const s = store.strategies.find((x) => x.id === id);
    if (!s || s.status !== 'draft') return UI.toast('已发布的策略不支持编辑，请创建新版本');
    fromRecord(s);
  }
  render();
}

export const actions = {
  newStrategy() { openEditor(); },
  editStrategy(id) { openEditor(id); },
  seField(k, v) { st[k] = v; },
  seSet(k, v) { st[k] = v; render(); },
  seGuard(id){st.guardId=id;st.guardStages=[...(store.guards.find(g=>g.id===id)?.stages||[])];render();},
  seGuardStage(stage,on){st.guardStages=on?[...new Set([...st.guardStages,stage])]:st.guardStages.filter(s=>s!==stage);},
  seUpgradeResources(){const updated=upgradedStrategy(toRecord('draft'),catalog());fromRecord(updated);render();UI.toast('已更新草稿依赖，请检查后发布');},
  sePreset(id) {
    const preset = methodPresets.find(p => p.id === id);
    if (!preset) return;
    const existing = new Map(st.methods.map(m => [m.name, m]));
    st.methods = preset.methods.map(name => {
      const m = methodOf(name), previous = existing.get(m.name);
      return previous || { name: m.name, params: Object.fromEntries(m.params.map(p => [p.label, p.value])), generator: m.generator ? genModels()[0]?.id || '' : '', open: true };
    });
    if (!st.banks.length) {
      const banks = selectableModelBanks(), bank = banks.find(b => b.id === 'bank-advbench') || banks[0];
      st.banks = bank ? [{ bankId: bank.id, all: false, count: Math.min(preset.questions, bank.items.length), open: true }] : [];
      st.bIndustry = bank?.industry || 'all'; st.bSource = bank?.source || 'all';
    }
    st.preset = id; st.mOpen = false; st.bOpen = true; render();
  },
  seMethod(name, on) {
    name = decodeURIComponent(name);
    st.preset = '';
    st.methods = st.methods.filter((m) => m.name !== name);
    if (on) {
      const m = methodOf(name);
      if(!compatible(m))return UI.toast(m.requirements);
      st.methods.push({ name: m.name, params: Object.fromEntries(m.params.map((p) => [p.label, p.value])), generator: m.generator ? genModels()[0]?.id || '' : '', open: true });
    }
    render();
  },
  seParam(i, label, v) { st.methods[i].params[label] = v; },
  seConfigureModels() { configureMoreModels(render, '返回策略配置'); },
  seAux(i, k, v) { if (v === CONFIGURE_MODEL_VALUE) return actions.seConfigureModels(); st.methods[i][k] = v; },
  seToggle(kind, i) { st[kind][i].open = !st[kind][i].open; render(); },
  seBank(id, on) {
    st.preset = '';
    st.banks = st.banks.filter((b) => b.bankId !== id);
    if (on) st.banks.push({ bankId: id, all: true, count: Math.min(20, store.getBank(id).items.length), open: true });
    render();
  },
  seBankAll(i, all) { st.banks[i].all = all; render(); },
  seBankN(i, v) { st.banks[i].count = Number(v); },
  sePublish() {
    const err = validate();
    if (err) return UI.toast(err);
    store.saveStrategy(toRecord('published'));
    done('策略已发布');
  },
  /* 草稿只要求名称不重复，其余可不完整 */
  seDraft() {
    if (!st.name.trim()) { render(); return UI.toast('请先填写策略名称再保存草稿'); }
    if (nameTaken()) { render(); return UI.toast('策略名称重复，请修改后再保存'); }
    store.saveStrategy(toRecord('draft'));
    done('已保存为待发布策略');
  },
  seCancel() {
    UI.modal('退出编辑策略', '<p>是否保存当前填写的内容？保存后在策略列表中为「待发布」状态。</p>',
      `${UI.btn('继续编辑', { onclick: 'App.seBack()' })}${UI.btn('保存草稿', { onclick: 'App.seDraft()' })}${UI.btn('放弃退出', { kind: 'danger', onclick: 'UI.closeModal()' })}`);
  },
  seBack() { render(); },
};
