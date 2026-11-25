/* 策略中心底层：攻击方法 / 攻击题库（列表 + 详情 + 新建题库） */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { detailFields, detailBlock, detailContent, detailTableField, parameterTable, openConfigDetail } from '../core/config-detail.js';
import { authoringListRows } from './resource-authoring.js';
import { openRtJsonl } from '../domain/resource-authoring.js';
import { getModelBankUsage } from '../domain/model-bank-authoring.js';
import { canEditMethodDefaults, methodParameterSchema, getMethodDefaults, methodDefaultsUpdatedAt, saveMethodParameters, resetMethodParameters } from '../domain/method-defaults.js';

/* ---------------------------------------------------------------- 攻击方法 */
const mView = { q: '', family: 'all' };
function installMethodStyle() {
  if(typeof document==='undefined'||document.getElementById('method-defaults-style'))return;
  const link=document.createElement('link');link.id='method-defaults-style';link.rel='stylesheet';
  link.href=new URL('../styles/method-defaults.css',import.meta.url).href;document.head.append(link);
}
const methodTime = value => value ? new Date(value).toLocaleString('zh-CN',{hour12:false}) : '—';
const parameterValue = value => typeof value==='boolean' ? value?'开启':'关闭' : String(value);
const parameterLabel = label => String(label).replace('预置变体','系统变体');
const editableParameters = id => canEditMethodDefaults(id)&&methodParameterSchema(id).length>0;
const methodDescription = method => (method.desc||'').replace('由裁判评分','获得评分').replaceAll('裁判反馈','反馈').replace('上游预置变体','系统变体');
function shortMethodDescription(method) {
  const description = methodDescription(method), characters = Array.from(description);
  return `<span class="md-list-description" title="${UI.esc(description)}">${UI.esc(characters.length > 8 ? characters.slice(0, 8).join('') + '...' : description)}</span>`;
}
function methodParameters(method) {
  const text = method.params.length ? method.params.map(param => `${parameterLabel(param.label)}：${parameterValue(method.defaults.params[param.label])}`).join('；') : '无额外参数';
  return `<span class="md-list-params" title="${UI.esc(text)}">${UI.esc(text)}</span>`;
}
function methodModels(method) {
  const types=depsOf(method);
  return types.length?UI.esc(types.join('、')):'无';
}

export function methodsPage({ embedded = false } = {}) {
  installMethodStyle();
  let rows = store.methods.filter(m => !m.authoringId);
  if (mView.family !== 'all') rows = rows.filter((m) => m.family === mView.family);
  if (mView.q.trim()) {
    const q = mView.q.trim().toLowerCase();
    rows = rows.filter((m) => (m.name + m.desc).toLowerCase().includes(q));
  }
  const flt = UI.filters({
    search: { label: '搜索', id: 'md-q', value: mView.q, placeholder: '搜索名称或说明', oninput: 'App.mdSearch(this.value)' },
    selects: [
      {
        label: '类别', id: 'md-family', value: mView.family, onchange: 'App.mdFamily(this.value)',
        options: [['all', '全部类别'], ...store.methodFamilies.map((f) => [f, f])],
      },
    ],
  });
  rows=rows.map(method=>({...method,defaults:getMethodDefaults(method.id),defaultsUpdatedAt:methodDefaultsUpdatedAt(method.id)}));
  const table = UI.pagedTable(
    'methods',
    [
      { title: '名称', width:'170px', render: m => `<button class="link-btn" onclick="App.openMethod('${m.id}')">${UI.esc(m.name)}</button>${m.available === false ? '（需适配）' : ''}` },
      { title: '说明', width:'160px', render:shortMethodDescription },
      { title: '来源', width: '70px', render: () => '系统' },
      { title: '类别', width: '110px', render: (m) => UI.esc(m.family) },
      { title: '参数/默认值', width:'260px', render:methodParameters },
      { title: '依赖模型', width: '170px', render:methodModels },
      { title: '更新时间', width:'160px', render:m=>UI.esc(methodTime(m.defaultsUpdatedAt)) },
      {
        title: '操作', width: '260px', cls: 'actions',
        render: (m) => `<div class="row-actions md-list-actions">${UI.linkBtn('详情', { onclick: `App.openMethod('${m.id}')` })}${UI.linkBtn('编辑参数', { onclick: `App.mdEditDefaults('${m.id}')`, disabled: !editableParameters(m.id) })}${UI.linkBtn('恢复默认值', {onclick:`App.mdResetDefaults('${m.id}')`,disabled:!editableParameters(m.id)})}</div>`,
      },
    ],
    rows,
    '暂无攻击方法',
  );
  return `<section class="md-library">${embedded ? '' : UI.pageHead('方法库')}${flt}${UI.card('', table, '', true)}</section>`;
}

const depsOf = method => {
  const requires=method.requires||'',types=[];
  if(method.generator)types.push(requires.includes('改写模型')?'改写模型':'攻击生成模型');
  for(const [pattern,label] of [[/嵌入/,'嵌入模型'],[/图像生成/,'图像生成模型'],[/多模态/,'多模态模型'],[/CLIP/,'CLIP 模型'],[/毒性模型/,'毒性检测模型'],[/辅助模型/,'辅助模型'],[/本地模型权重/,'本地模型']])if(pattern.test(requires))types.push(label);
  return types;
};
let defaultsEditor = null;
function releaseDefaultsEditor() {
  defaultsEditor?.observer?.disconnect();
  defaultsEditor = null;
}
function closeDefaultsEditor() {
  if(document.querySelector('#drawer.open .md-defaults-form'))UI.closeDrawer();
  releaseDefaultsEditor();
}
function defaultsParamField(param, value) {
  const id = 'md-param-'+param.key, escaped = UI.esc;
  const event = `App.mdDefaultParam('${param.key}',this.value)`;
  let control;
  if (param.type === 'boolean') control = `<select id="${id}" onchange="${event}"><option value="true" ${value===true?'selected':''}>开启</option><option value="false" ${value===false?'selected':''}>关闭</option></select>`;
  else if (param.options) control = `<select id="${id}" onchange="${event}">${param.options.map(option=>`<option value="${escaped(option)}" ${value===option?'selected':''}>${escaped(option)}</option>`).join('')}</select>`;
  else control = `<input id="${id}" type="${param.type==='number'?'number':'text'}" value="${escaped(value)}" ${param.type==='number'?`min="${param.min}" ${param.max===undefined?'':`max="${param.max}"`} step="${param.integer?'1':'any'}"`:''} oninput="${event}">`;
  return `<label class="field md-param-field" for="${id}"><span>${escaped(parameterLabel(param.label))}</span>${control}${param.type==='number'?`<small>${param.integer?'整数':'数值'} · ${param.min}${param.max===undefined?' 及以上':'–'+param.max}</small>`:''}</label>`;
}
function renderDefaultsEditor(method) {
  const value = defaultsEditor.value;
  const parameters = methodParameterSchema(method.id).map(param=>defaultsParamField(param,value.params[param.label])).join('');
  return `<form id="md-defaults-form" class="md-defaults-form" onsubmit="event.preventDefault();App.mdSaveDefaults()" novalidate><p class="md-defaults-note">保存后用于新加入策略的方法，已有策略和任务保留原配置。</p><div class="md-defaults-fields">${parameters}</div><p id="md-default-error" class="ai-error" role="alert">${UI.esc(defaultsEditor.error||'')}</p></form>`;
}
function openDefaultsEditor(id) {
  if(!editableParameters(id))return;
  const method=store.methods.find(item=>item.id===id);if(!method)return;
  const value=getMethodDefaults(id);
  closeDefaultsEditor();installMethodStyle();
  const current={id,value,error:''};defaultsEditor=current;
  UI.drawer(`编辑参数 · ${method.name}`,renderDefaultsEditor(method),UI.btn('取消',{onclick:'App.mdCancelDefaults()'})+UI.btn('保存',{kind:'primary',onclick:'App.mdSaveDefaults()'}));
  const host=document.getElementById('drawer');
  host.querySelector('.drawer')?.classList.add('md-defaults-drawer');
  host.querySelector('.modal-head .icon-btn')?.setAttribute('onclick','App.mdCancelDefaults()');
  const Observer=document.defaultView?.MutationObserver;
  if(Observer){
    current.observer=new Observer(()=>{if(defaultsEditor===current&&(!host.classList.contains('open')||!host.querySelector('.md-defaults-form')))releaseDefaultsEditor();});
    current.observer.observe(host,{attributes:true,attributeFilter:['class'],childList:true});
  }
  host.querySelector('.md-defaults-form input,.md-defaults-form select')?.focus();
}
function defaultError(error) {
  const message=parameterLabel(error.message||String(error));
  if(defaultsEditor)defaultsEditor.error=message;
  const target = document.getElementById('md-default-error');
  if (target) target.textContent = message; else UI.toast(message);
}
router.beforeNavigate(()=>{if(defaultsEditor)closeDefaultsEditor();});

/* ---------------------------------------------------------------- 攻击题库 */
const bView = { q: '' };

export function banksPage({ embedded = false } = {}) {
  let rows = [...store.banks.filter(b => !b.authoringId), ...authoringListRows('model')];
  if (bView.q.trim()) {
    const q = bView.q.trim().toLowerCase();
    rows = rows.filter((b) => b.name.toLowerCase().includes(q));
  }
  const flt = UI.filters({
    search: { label: '搜索', id: 'bk-q', value: bView.q, placeholder: '搜索题库名称', oninput: 'App.bkSearch(this.value)' },
    right: embedded ? UI.btn('新建题库', { onclick: 'App.newBank()' }) : '',
  });
  const table = UI.pagedTable(
    'banks',
    [
      { title: '名称', width: '200px', render: (b) => `<button class="link-btn" onclick="App.${b.userResource ? 'mbOpen' : 'openBank'}('${b.id}')">${UI.esc(b.name)}</button>` },
      { title: '来源', width: '80px', render: (b) => b.source === 'system' ? '系统' : '自建' },
      { title: '业务领域', width: '100px', render: (b) => UI.esc(b.industry) },
      { title: '场景标签', render: (b) => UI.tagList(b.scenes.map((id) => store.sceneLabel(id))) },
      { title: '数量', width: '80px', cls: 'num', render: (b) => `<span class="num">${b.items.length}</span>` },
      { title: '版本', width: '70px', render: b => b.userResource ? `<span class="mono">${UI.esc(b.version)}</span>` : '<span class="faint">—</span>' },
      { title: '状态', width: '85px', render: b => UI.badge(b.status === 'draft' ? '草稿' : '已发布') },
      { title: '创建时间', width: '150px', cls: 'num', render: (b) => UI.esc(b.createdAt || '—') },
      {
        title: '操作', width: '120px', cls: 'actions',
        render: bankActions,
      },
    ],
    rows,
    '暂无场景题库',
  );
  return `${embedded ? '' : UI.pageHead('场景题库', {
    actions: UI.btn('新建题库', { kind: 'primary', ico: 'plus', onclick: 'App.newBank()' }),
  })}${flt}${UI.card('', table, '', true)}`;
}

function bankActions(b) {
  const more = b.userResource ? [
    ['版本更新', `App.mbNewVersion('${b.id}')`, { disabled: b.status === 'draft' }],
    ['导出', `App.mbExport('${b.id}')`],
    ['删除', `App.mbDelete('${b.id}')`, { danger: true, disabled: getModelBankUsage(b.id).used }],
  ] : [
    ['导出', `App.exportBank('${b.id}')`],
  ];
  return `<div class="row-actions">${UI.linkBtn('详情', { onclick: `App.${b.userResource ? 'mbOpen' : 'openBank'}('${b.id}')` })}${UI.moreMenu(more)}</div>`;
}

/* ---------------------------------------------------------------- 题库详情（右侧抽屉） */
const PAGE = UI.PAGE_SIZE;
const dView = { id: null, q: '', scene: 'all', page: 1 };

function bankBody(b) {
  let items = b.items;
  if (dView.scene !== 'all') items = items.filter((i) => i.scene === dView.scene);
  if (dView.q.trim()) {
    const q = dView.q.trim().toLowerCase();
    items = items.filter((i) => (i.id + i.prompt).toLowerCase().includes(q));
  }
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  dView.page = Math.min(dView.page, pages);
  const slice = items.slice((dView.page - 1) * PAGE, dView.page * PAGE);
  const table = UI.table(
    [
      { title: '编号 / 题目', render: (i) => `<div class="mono faint text-support">${UI.esc(i.id)}</div>${UI.esc(i.prompt)}` },
      { title: '攻击场景', width: '30%', render: (i) => UI.badge(store.sceneLabel(i.scene), 'gray') },
    ],
    slice,
    '该筛选条件下暂无题目',
  );
  return detailContent(detailBlock('题库基础信息', detailFields([
    ['题库名称', b.name], ['来源', b.source === 'system' ? '系统' : '自建'],
    ['业务领域', b.industry], ['题目数', b.items.length], ['创建时间', b.createdAt],
  ])) + detailBlock('题目内容', UI.filters({
      search: { label: '搜索', id: 'bd-q', value: dView.q, placeholder: '搜索编号或题目', oninput: 'App.bdSearch(this.value)' },
      selects: [{
        label: '攻击场景', id: 'bd-scene', value: dView.scene, onchange: 'App.bdScene(this.value)',
        options: [['all', '全部场景'], ...b.scenes.map((id) => [id, store.sceneLabel(id)])],
      }],
    }) + table + UI.pager({ total: items.length, page: dView.page, count: pages }, 'App.bdPage({p})')));
}

/* 抽屉内局部重绘：只换 body，保留输入焦点 */
function redrawBank() {
  const b = store.getBank(dView.id);
  const el = document.querySelector('#drawer .modal-body');
  if (!b || !el) return;
  const f = document.activeElement?.id;
  const pos = document.activeElement?.selectionStart;
  el.innerHTML = bankBody(b);
  const n = f && document.getElementById(f);
  if (n) { n.focus(); if (pos != null && n.setSelectionRange) n.setSelectionRange(pos, pos); }
}


/* ---------------------------------------------------------------- 操作 */

export const actions = {
  mdSearch(v) { closeDefaultsEditor();mView.q = v; UI.resetPage('methods'); router.nav('strategy', 'methods'); },
  mdFamily(v) { closeDefaultsEditor();mView.family = v; UI.resetPage('methods'); router.nav('strategy', 'methods'); },
  openMethod(id) {
    const m = store.methods.find((x) => x.id === id);
    if (!m) return;
    let defaults; try { defaults=getMethodDefaults(id); } catch(error) { return UI.toast(error.message); }
    releaseDefaultsEditor();
    openConfigDetail('攻击方法详情', detailContent(
      detailBlock('方法基础信息', detailFields([
        ['方法名称', m.name], ['说明', methodDescription(m)], ['来源', '系统'], ['技术路线', m.family], ['更新时间',methodTime(methodDefaultsUpdatedAt(m.id))],
      ])) + detailBlock('详细配置信息', detailFields([
        ['交互轮次', m.turns], ['依赖模型', depsOf(m).join('、') || '无'],
      ]) + detailTableField('参数/默认值', parameterTable(m.params.map(p => [parameterLabel(p.label), defaults.params[p.label]]))))));
  },
  mdEditDefaults(id) {try{openDefaultsEditor(id);}catch(error){defaultError(error);} },
  mdDefaultParam(key,value) {
    if(!defaultsEditor)return;
    const param=methodParameterSchema(defaultsEditor.id).find(item=>item.key===key);if(!param)return;
    defaultsEditor.value.params[param.label]=param.type==='boolean'?value==='true':param.type==='number'?(value.trim()===''?NaN:Number(value)):value;
    defaultsEditor.error='';
    const error=document.getElementById('md-default-error');if(error)error.textContent='';
  },
  mdResetDefaults(id) {
    if(!editableParameters(id))return;
    const method=store.methods.find(item=>item.id===id);if(!method)return;
    UI.modal('恢复默认值',`<p>确认将 ${UI.esc(method.name)} 的参数恢复为系统默认值？</p><p class="ai-help">已有策略和任务保留原配置。</p><p id="md-reset-error" class="ai-error" role="alert"></p>`,UI.btn('取消',{onclick:'UI.closeModal()'})+UI.btn('恢复默认值',{kind:'primary',onclick:`App.mdConfirmResetDefaults('${id}')`}));
  },
  mdConfirmResetDefaults(id) {
    if(!editableParameters(id))return;
    try{resetMethodParameters(id);closeDefaultsEditor();UI.closeModal();router.nav('strategy','methods');UI.toast('已恢复默认值');}
    catch(error){const target=document.getElementById('md-reset-error');if(target)target.textContent=error.message;else UI.toast(error.message);}
  },
  mdCancelDefaults() {closeDefaultsEditor();},
  mdSaveDefaults() {if(!defaultsEditor||!document.querySelector('#drawer.open .md-defaults-form'))return;try{saveMethodParameters(defaultsEditor.id,defaultsEditor.value.params);closeDefaultsEditor();router.nav('strategy','methods');UI.toast('参数已保存');}catch(error){defaultError(error);}},

  bkSearch(v) { bView.q = v; UI.resetPage('banks'); router.nav('strategy', 'banks'); },
  openBank(id) {
    const b = store.getBank(id);
    if (!b) return;
    Object.assign(dView, { id, q: '', scene: 'all', page: 1 });
    openConfigDetail('场景题库详情', bankBody(b), `${UI.btn('导出', { onclick: `App.exportBank('${id}')` })}${UI.btn('关闭', { onclick: 'UI.closeDrawer()' })}`);
  },
  bdSearch(v) { dView.q = v; dView.page = 1; redrawBank(); },
  bdScene(v) { dView.scene = v; dView.page = 1; redrawBank(); },
  bdPage(p) { dView.page = p; redrawBank(); },
  exportBank(id) {
    const b = store.getBank(id);
    if (!b) return;
    const data = b.items.map((i) => ({ id: i.id, prompt: i.prompt, scene: store.sceneLabel(i.scene) }));
    UI.download(`${b.name}.jsonl`, openRtJsonl(data));
  },

  newBank() {
    window.App.mbCreate();
  },
};
