/* 新建 Agent 演练任务：单个弹窗，分区填写。取消时可存草稿。
 * 与模型演练的差异：选演练策略（题库与范围已在策略里配好），无裁判模型、无攻击方法。 */
import * as UI from '../core/ui.js';
import * as store from '../domain/store.js';

/* 单条题实测耗时约 5.3 分钟（Qwen Code + DeepSeek-Flash，单轮） */
const SEC_PER_TASK = 318;

const BLANK = {
  name: '', desc: '', targetId: '', strategyId: '',
  concurrency: 4, targetTimeout: 900, draftIdx: null,
};
const state = { ...BLANK };

export const agentDrafts = [];

export function openAgentWizard(preset = {}) {
  Object.assign(state, BLANK, preset);
  if (!state.targetId) state.targetId = store.connectedAgents()[0]?.id || '';
  if (!state.strategyId) state.strategyId = store.agentStrategies.filter((s) => s.status === 'published')[0]?.id || '';
  render();
}

export function resumeAgentDraft(idx) {
  const d = agentDrafts[idx];
  if (!d) return;
  openAgentWizard({ ...d, draftIdx: idx });
}

const section = (title, body) => `<section class="form-sec"><h3>${UI.esc(title)}</h3>${body}</section>`;
const req = '<span class="req">*</span>';

function selectedStrategy() {
  return store.getAgentStrategy(state.strategyId);
}

function taskCount() {
  const s = selectedStrategy();
  return s ? store.agentStrategyTaskCount(s) : 0;
}

function etaText() {
  const s = selectedStrategy();
  const n = taskCount();
  if (!n) return '—';
  const sec = (n * SEC_PER_TASK * Math.max(1, s?.maxIterations ?? 1)) / Math.max(1, state.concurrency);
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `约 ${h} 小时 ${m} 分钟` : `约 ${m} 分钟`;
}

function render() {
  const agents = store.connectedAgents();
  const strategies = store.agentStrategies.filter((s) => s.status === 'published');
  const s = selectedStrategy();
  const opt = (v, label, cur) => `<option value="${UI.esc(v)}" ${v === cur ? 'selected' : ''}>${UI.esc(label)}</option>`;

  const agentField = agents.length
    ? `<select id="agw-target" onchange="App.agwField('targetId',this.value)">
        ${agents.map((a) => opt(a.id, `${a.name}（${a.baseModelName}）`, state.targetId)).join('')}
      </select>`
    : `<select disabled><option>暂无已接入的智能体</option></select>
       <span class="faint text-support">请先在资产中心接入智能体</span>`;

  const strategyField = strategies.length
    ? `<select id="agw-strategy" onchange="App.agwField('strategyId',this.value)">
        ${strategies.map((x) => opt(x.id, x.name, state.strategyId)).join('')}
      </select>`
    : `<select disabled><option>暂无已发布的演练策略</option></select>
       <span class="faint text-support">请先在策略中心新建并发布 Agent 演练策略</span>`;

  const strategyInfo = s
    ? UI.kvTable([
      ['场景题库', store.agentStrategyBankLines(s).map((l) => UI.esc(l)).join('<br>') || '—'],
      ['题目数', `<span class="num">${taskCount()}</span>`],
      ['迭代轮数', `<span class="num">${s.maxIterations ?? 1}</span>`],
    ])
    : '';

  const body = `<div class="form-secs">
    ${section('任务信息', `
      <div class="field"><label for="agw-name">任务名称${req}</label>
        <input type="text" id="agw-name" value="${UI.esc(state.name)}" placeholder="请输入任务名称"
          oninput="App.agwField('name',this.value)" /></div>
      <div class="field"><label for="agw-desc">任务描述</label>
        <textarea id="agw-desc" rows="3" placeholder="选填，说明本次演练的目的或背景"
          oninput="App.agwField('desc',this.value)">${UI.esc(state.desc)}</textarea></div>`)}

    ${section('演练对象', `<div class="form-stack">
      <div class="field"><label for="agw-target">靶标智能体${req}</label>${agentField}</div>
    </div>`)}

    ${section('演练策略', `<div class="form-stack">
      <div class="field"><label for="agw-strategy">演练策略${req}</label>${strategyField}</div>
    </div>${strategyInfo}`)}

    ${section('执行参数', `<div class="form-row">
      <div class="field"><label for="agw-par">执行并发</label>
        <input type="number" id="agw-par" min="1" max="16" value="${state.concurrency}"
          oninput="App.agwField('concurrency',this.value)" /></div>
      <div class="field"><label for="agw-to">单条超时</label>
        <div class="input-unit">
          <input type="number" id="agw-to" min="60" step="60" value="${state.targetTimeout}"
            oninput="App.agwField('targetTimeout',this.value)" /><span>秒</span>
        </div></div>
    </div>
    ${UI.kvTable([['预计耗时', `<span class="num">${etaText()}</span>`]])}`)}
  </div>`;

  const foot = `
    ${UI.btn('取消', { onclick: 'App.agwCancel()' })}
    ${UI.btn('存为草稿', { onclick: 'App.agwDraft()' })}
    ${UI.btn('开始演练', { kind: 'primary', onclick: 'App.agwSubmit()' })}`;

  UI.modal('新建 Agent 演练任务', body, foot, { wide: true, cls: 'modal-wiz' });
}

function saveDraft() {
  const rec = { ...state };
  delete rec.draftIdx;
  rec.savedAt = store.nowText();
  if (state.draftIdx !== null && agentDrafts[state.draftIdx]) agentDrafts[state.draftIdx] = rec;
  else agentDrafts.push(rec);
}

export const actions = {
  agwField(key, value) {
    const numeric = ['concurrency', 'targetTimeout'];
    state[key] = numeric.includes(key) ? Number(value) || BLANK[key] : value;
    /* 文本输入不重绘，避免失焦；其余字段重绘以更新联动信息 */
    if (key !== 'name' && key !== 'desc') render();
  },
  agwCancel() {
    if (state.name.trim() || state.strategyId) {
      UI.modal('保存草稿', '<p>当前填写的内容尚未提交，是否存为草稿？</p>',
        `${UI.btn('不保存', { onclick: 'UI.closeModal()' })}${UI.btn('存为草稿', { kind: 'primary', onclick: 'App.agwDraft()' })}`);
      return;
    }
    UI.closeModal();
  },
  agwDraft() {
    if (!state.name.trim()) return UI.toast('请填写任务名称');
    saveDraft();
    UI.closeModal();
    UI.toast('已存为草稿');
  },
  agwSubmit() {
    if (!state.name.trim()) return UI.toast('请填写任务名称');
    if (!state.targetId) return UI.toast('请选择靶标智能体');
    if (!state.strategyId) return UI.toast('请选择演练策略');
    if (!taskCount()) return UI.toast('所选策略没有可跑的题目');
    UI.closeModal();
    UI.toast('demo 暂不执行真实演练，任务未创建');
  },
};
