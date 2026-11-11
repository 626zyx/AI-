/* 新建 / 编辑攻击策略：单个弹窗。从已有攻击方法与攻击题库中选取并配置。
 * 与新建演练任务同一套交互：可保存草稿（待发布），取消时提醒；发布后锁定不可编辑。
 * 裁判模型不属于策略，在创建演练任务时选择。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';

const st = {
  id: null, name: '', desc: '',
  methods: [],          // [{ name, params: {label: value}, generator, process, open }]
  banks: [],            // [{ bankId, all, count, open }]
  mFamily: 'all', mTurns: 'all', mOpen: true,
  bIndustry: 'all', bSource: 'all', bOpen: true,
};

const req = '<span class="req">*</span>';
const genModels = () => store.modelsWithRole('攻击生成');
const procModels = () => store.modelsWithRole('裁判');
const methodOf = (name) => store.methods.find((m) => m.name.toLowerCase() === name.toLowerCase());
/* 多模态方法需要图像靶标，本平台只演练文本模型，不提供选择 */
const pickable = () => store.methods.filter((m) => m.family !== '多模态');

/* ---------------------------------------------------------------- 攻击方法 */
function methodPicker() {
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
      <span class="pk-card-head"><input type="checkbox" ${on.has(m.name) ? 'checked' : ''} onchange="App.seMethod('${m.name}',this.checked)" /><b>${UI.esc(m.name)}</b></span>
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
      <span class="row-actions">${UI.linkBtn(sm.open ? '收起' : '展开', { onclick: `App.seToggle('methods',${i})` })}${UI.linkBtn('移除', { onclick: `App.seMethod('${m.name}',false)` })}</span></div>`;
    if (!sm.open) return `<div class="cfg-card">${head}</div>`;
    const params = m.params.length
      ? `<div class="se-sec">基本参数</div><div class="form-row">${m.params.map((p) => paramInput(i, p, sm.params[p.label])).join('')}</div>`
      : '<div class="faint text-support">该方法无可配置参数</div>';
    const sel = (key, label, list) => `<div class="field"><label>${label}${req}</label>
      <select onchange="if(this.value==='__cfg'){this.value='';App.gotoRoles()}else App.seAux(${i},'${key}',this.value)"><option value="">${list.length ? `请选择${label}` : `暂无可用的${label}模型`}</option>
      ${list.map((x) => `<option value="${x.id}" ${sm[key] === x.id ? 'selected' : ''}>${UI.esc(x.name)}</option>`).join('')}
      <option value="__cfg">+ 配置其他模型</option></select>
      ${list.length ? '' : `<span class="faint text-support">需先在平台管理中为模型配置「${label === '过程裁判' ? '裁判' : '攻击生成'}」角色，${UI.linkBtn('去配置', { onclick: 'App.gotoRoles()' })}</span>`}</div>`;
    const aux = m.generator || m.process
      ? `<div class="se-sec mt-16">辅助模型</div><div class="form-row">
          ${m.generator ? sel('generator', '攻击生成模型', genModels()) : ''}${m.process ? sel('process', '过程裁判', procModels()) : ''}</div>`
      : '';
    return `<div class="cfg-card">${head}<div class="cfg-card-body">${params}${aux}</div></div>`;
  }).join('');
}

/* ---------------------------------------------------------------- 攻击题库 */
function bankPicker() {
  const inds = store.INDUSTRIES;
  let list = store.banks;
  if (st.bIndustry !== 'all') list = list.filter((b) => b.industry === st.bIndustry);
  if (st.bSource !== 'all') list = list.filter((b) => b.source === st.bSource);
  const on = new Set(st.banks.map((b) => b.bankId));
  const side = [['all', '全部行业', store.banks.length], ...inds.map((x) => [x, x, store.banks.filter((b) => b.industry === x).length])]
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

/* ---------------------------------------------------------------- 渲染 */
function render() {
  const keep = document.querySelector('#modal .modal-body')?.scrollTop || 0;
  const body = `<div class="form-secs">
    <section class="form-sec"><h3>基本信息</h3>
      <div class="field"><label for="se-name">策略名称${req}</label>
        <input type="text" id="se-name" value="${UI.esc(st.name)}" placeholder="请输入策略名称" oninput="App.seField('name',this.value)" /></div>
      <div class="field"><label for="se-desc">策略描述</label>
        <textarea id="se-desc" rows="2" placeholder="选填" oninput="App.seField('desc',this.value)">${UI.esc(st.desc)}</textarea></div>
    </section>
    <section class="form-sec"><div class="flex between"><h3>攻击方法${req}</h3><span class="faint text-support">每种方法单独配置参数与所需辅助模型</span></div>
      ${methodPicker()}${methodConfigs()}</section>
    <section class="form-sec"><h3>攻击题库${req}</h3>${bankPicker()}${bankConfigs()}
      <p class="faint text-support">策略名称唯一，发布后内容固定；需要调整时新建策略。裁判模型在创建演练任务时选择。</p></section>
  </div>`;
  const footer = `${UI.btn('取消', { onclick: 'App.seCancel()' })}${UI.btn('保存草稿', { onclick: 'App.seDraft()' })}${UI.btn('发布', { kind: 'primary', onclick: 'App.sePublish()' })}`;
  UI.modal(st.id ? '编辑攻击策略' : '新建攻击策略', body, footer, { wide: true });
  const el = document.querySelector('#modal .modal-body');
  if (el) el.scrollTop = keep;
}

/* ---------------------------------------------------------------- 存取 */
function toRecord(status) {
  const name = (id) => store.models.find((m) => m.id === id)?.name;
  return {
    id: st.id, name: st.name.trim(), desc: st.desc.trim(), status,
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

function validate() {
  if (!st.name.trim()) return '请输入策略名称';
  if (nameTaken()) return '策略名称重复，请修改';
  if (!st.methods.length) return '请至少选择一种攻击方法';
  for (const sm of st.methods) {
    const m = methodOf(sm.name);
    if (m.generator && !sm.generator) return `请为 ${m.name} 选择攻击生成模型`;
    if (m.process && !sm.process) return `请为 ${m.name} 选择过程裁判`;
  }
  if (!st.banks.length) return '请至少选择一套攻击题库';
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
  Object.assign(st, { id: null, name: '', desc: '', methods: [], banks: [], mFamily: 'all', mTurns: 'all', mOpen: true, bIndustry: 'all', bSource: 'all', bOpen: true });
  if (id) {
    const s = store.strategies.find((x) => x.id === id);
    if (!s || s.status === 'published') return UI.toast('已发布的策略不支持编辑');
    fromRecord(s);
  }
  render();
}

export const actions = {
  newStrategy() { openEditor(); },
  editStrategy(id) { openEditor(id); },
  seField(k, v) { st[k] = v; },
  seSet(k, v) { st[k] = v; render(); },
  seMethod(name, on) {
    st.methods = st.methods.filter((m) => m.name !== name);
    if (on) {
      const m = methodOf(name);
      st.methods.push({ name: m.name, params: Object.fromEntries(m.params.map((p) => [p.label, p.value])), generator: '', process: '', open: true });
    }
    render();
  },
  seParam(i, label, v) { st.methods[i].params[label] = v; },
  seAux(i, k, v) { st.methods[i][k] = v; },
  seToggle(kind, i) { st[kind][i].open = !st[kind][i].open; render(); },
  seBank(id, on) {
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
