/* 新建 / 复测演练任务：单个弹窗，分区填写。
 * 取消时可保存草稿；弹窗内也可直接保存草稿。 */
import * as UI from '../core/ui.js';
import * as store from '../domain/store.js';
import { GUARD_NONE } from '../domain/constants.js';

const BLANK = {
  type: 'model', name: '', desc: '', targetId: '', strategyId: '', judgeId: '', guardId: '', guardStages: ['输入', '输出'],
  concurrency: 3, maxTokens: 2048, draftIdx: null,
};
const state = { ...BLANK };

export const drafts = [];

export function openWizard(type = 'model', preset = {}) {
  Object.assign(state, BLANK, { type }, preset);
  render();
}

/* 复测只是把原任务配置带进同一个新建弹窗，帮用户免去重新选择；
 * 弹窗标题、按钮与新建完全一致。名称原样带入，须改名后才能创建（重名检测）。 */
export function openRetest(task) {
  const target = store.models.find((m) => m.name === task.targetName);
  openWizard('model', {
    name: task.name,
    targetId: target?.id || '',
    strategyId: task.strategyId,
    judgeId: task.judgeId,
    guardId: task.guardId || '',
    guardStages: task.guardStages || ['输入', '输出'],
    concurrency: task.concurrency || BLANK.concurrency,
    maxTokens: task.maxTokens || BLANK.maxTokens,
  });
}

export function resumeDraft(idx) {
  const d = drafts[idx];
  if (!d) return;
  openWizard('model', { ...d, draftIdx: idx });
}

/* 蓝队配置位置：输入侧审提示词、输出侧审回复，可同时勾选；未选策略时置灰 */
function guardStageField() {
  const off = !state.guardId;
  return `<div class="check-row">${store.GUARD_STAGES.map((k) => `<label class="check ${off ? 'faint' : ''}">
    <input type="checkbox" ${off ? 'disabled' : ''} ${state.guardStages.includes(k) ? 'checked' : ''}
      onchange="App.wizStage('${k}',this.checked)" /> ${k}侧</label>`).join('')}</div>
    <span class="faint text-support">${off ? '选择防护策略后可设置' : '输入侧审核发给靶标的提示词，输出侧审核靶标的回复'}</span>`;
}

const section = (title, body) => `<section class="form-sec"><h3>${UI.esc(title)}</h3>${body}</section>`;
const req = '<span class="req">*</span>';

function render() {
  const targets = store.modelsWithRole('靶标').filter((m) => m.status === 'connected');
  const judges = store.modelsWithRole('裁判');
  const cfgOpt = '<option value="__cfg">+ 配置其他模型</option>';
  const cfgHint = (list, role) => (list.length ? '' : `<span class="faint text-support">暂无「${role}」角色的模型，${UI.linkBtn('去平台管理配置', { onclick: 'App.gotoRoles()' })}</span>`);
  const cfgOn = (k) => `if(this.value==='__cfg'){this.value='';App.gotoRoles()}else App.wizField('${k}',this.value)`;
  const opt = (v, label, cur) => `<option value="${UI.esc(v)}" ${v === cur ? 'selected' : ''}>${UI.esc(label)}</option>`;

  const body = `<div class="form-secs">
    ${section('任务信息', `<div class="field"><label for="wiz-name">任务名称${req}</label>
        <input type="text" id="wiz-name" value="${UI.esc(state.name)}" placeholder="请输入任务名称"
          oninput="App.wizField('name',this.value)" /></div>
      <div class="field"><label for="wiz-desc">任务描述</label>
        <textarea id="wiz-desc" rows="3" placeholder="选填，说明本次演练的目的或背景"
          oninput="App.wizField('desc',this.value)">${UI.esc(state.desc)}</textarea></div>`)}
    ${section('演练对象', `<div class="form-stack">
      <div class="field"><label for="wiz-target">靶标模型${req}</label>
        <select id="wiz-target" onchange="${cfgOn('targetId')}">
          <option value="">请选择靶标模型</option>
          ${targets.map((m) => opt(m.id, m.name, state.targetId)).join('')}${cfgOpt}
        </select>${cfgHint(targets, '靶标')}</div>
      <div class="field guard-group"><label for="wiz-guard">蓝队防护策略</label>
        <div class="guard-box">
          <select id="wiz-guard" onchange="App.wizField('guardId',this.value,true)">
            <option value="" ${state.guardId ? '' : 'selected'}>不配置蓝队（${GUARD_NONE}）</option>
            ${store.guards.map((g) => opt(g.id, g.name, state.guardId)).join('')}
          </select>
          <div class="guard-stage-row"><span class="sub-label">配置位置</span><div id="wiz-guard-stage">${guardStageField()}</div></div>
        </div></div>
    </div>`)}
    ${section('攻击策略', `<div class="field"><label for="wiz-strategy">攻击策略${req}</label>
      <select id="wiz-strategy" onchange="App.wizField('strategyId',this.value,true)">
        <option value="">请选择攻击策略</option>
        ${store.strategies.filter((s) => s.status === 'published').map((s) => opt(s.id, s.name, state.strategyId)).join('')}
      </select></div>
      <div id="wiz-strategy-detail">${strategyDetail()}</div>`)}
    ${section('裁判', `<div class="field"><label for="wiz-judge">裁判模型${req}</label>
      <select id="wiz-judge" onchange="${cfgOn('judgeId')}">
        <option value="">请选择裁判模型</option>
        ${judges.map((m) => opt(m.id, m.name, state.judgeId)).join('')}${cfgOpt}
      </select>${cfgHint(judges, '裁判')}</div>`)}
    ${section('基础参数', `<div class="form-row">
      <div class="field"><label for="wiz-concurrency">并发数</label>
        <input type="number" id="wiz-concurrency" min="1" max="10" value="${state.concurrency}"
          oninput="App.wizField('concurrency',Number(this.value))" /></div>
      <div class="field"><label for="wiz-maxtokens">单次输出上限</label>
        <div class="input-unit"><input type="number" id="wiz-maxtokens" min="256" max="8192" step="256" value="${state.maxTokens}"
          oninput="App.wizField('maxTokens',Number(this.value))" /><span>tokens</span></div></div>
    </div>`)}
  </div>`;

  const footer = `
    ${UI.btn('取消', { onclick: 'App.wizCancel()' })}
    ${UI.btn('保存草稿', { onclick: 'App.wizSaveDraft()' })}
    ${UI.btn('创建任务', { kind: 'primary', onclick: 'App.wizFinish()' })}`;
  UI.modal('新建模型演练', body, footer, { cls: 'modal-wiz' });
}

/* 策略详情：攻击题库与攻击方法各一张列表，只列名称 */
function strategyDetail() {
  const s = store.strategies.find((x) => x.id === state.strategyId);
  if (!s) return '';
  const list = (title, rows) => `<div class="sd-block"><div class="sub-label">${title}</div>
    <ul class="sd-list">${rows.map((r) => `<li>${UI.esc(r)}</li>`).join('')}</ul></div>`;
  return `<div class="sd">
    <div class="sd-title">策略详情</div>
    ${list('攻击题库', store.strategyBankLines(s))}
    ${list('攻击方法', s.methods.map((m) => m.name))}
  </div>`;
}

/* 任务名称全局唯一：与任务列表、草稿箱（正在编辑的这份草稿除外）都不可重名 */
function nameTaken(name) {
  const n = name.trim();
  if (!n) return false;
  if (store.listTasks().some((t) => t.name === n)) return true;
  return drafts.some((d, i) => i !== state.draftIdx && (d.name || '').trim() === n);
}

function validate() {
  if (!state.name.trim()) return '请输入任务名称';
  if (nameTaken(state.name)) return '任务名称重复，请修改后再创建';
  if (!state.targetId) return '请选择靶标模型';
  if (!state.strategyId) return '请选择攻击策略';
  if (!state.judgeId) return '请选择裁判模型';
  if (state.guardId && !state.guardStages.length) return '请选择蓝队配置位置';
  return '';
}

function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const actions = {
  /* 只有策略切换会改变可见结构，其余字段只写状态，不重绘，避免输入丢焦点 */
  wizField(key, value, redraw = false) {
    state[key] = value;
    if (!redraw) return;
    const el = document.getElementById('wiz-strategy-detail');
    if (el) el.innerHTML = strategyDetail();
    const st = document.getElementById('wiz-guard-stage');
    if (st) st.innerHTML = guardStageField();
  },
  wizStage(k, on) {
    const set = new Set(state.guardStages);
    if (on) set.add(k); else set.delete(k);
    state.guardStages = store.GUARD_STAGES.filter((x) => set.has(x));
  },
  wizFinish() {
    const err = validate();
    if (err) return UI.toast(err);
    UI.closeModal();
    UI.toast('演示环境不执行真实演练');
  },
  wizCancel() {
    UI.modal(
      '退出新建演练',
      '<p>是否保存当前填写的内容？</p>',
      `${UI.btn('继续编辑', { onclick: 'App.wizBack()' })}${UI.btn('保存草稿', {
        onclick: 'App.wizSaveDraft()',
      })}${UI.btn('放弃退出', { kind: 'danger', onclick: 'UI.closeModal()' })}`,
    );
  },
  /* 回到任务弹窗，已填内容保留 */
  wizBack() {
    render();
  },
  wizSaveDraft() {
    if (nameTaken(state.name)) {
      render();
      return UI.toast('任务名称重复，请修改后再保存');
    }
    const { draftIdx, ...rest } = state;
    const d = { ...rest, savedAt: now() };
    if (draftIdx !== null && drafts[draftIdx]) drafts[draftIdx] = d;
    else drafts.push(d);
    UI.closeModal();
    UI.toast('已保存到草稿箱');
    App?.openDrafts();
  },
};

let App = null;
export function bindApp(app) {
  App = app;
}
