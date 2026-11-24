import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import { renderLevelDefinition } from '../core/result-level-badge.js';
import {
  RESULT_LEVEL_METRICS, RESULT_LEVEL_PALETTES, listResultLevelRules, getResultLevelRule,
  newResultLevelRule, resultLevelMetric, resultRuleLevels, resultLevelRange,
  saveResultLevelRule, toggleResultLevelRule, deleteResultLevelRule,
} from '../domain/result-level-rules.js';

const e = UI.esc;
const sourceName = source => source === 'agent' ? '智能体演练' : '模型演练';
const view = { q: '', source: 'all', enabled: 'all' };
let form = null;
const refresh = () => router.nav('platform', 'datarule', null, { replace: true });
const field = (label, control) => `<label class="field"><span>${e(label)}</span>${control}</label>`;
const select = (id, values, current, action) => `<select id="${id}" onchange="${action}">${values.map(([value, label]) => `<option value="${e(value)}" ${value === current ? 'selected' : ''}>${e(label)}</option>`).join('')}</select>`;
function mapping(rule) {
  return `<div class="dl-rule-mapping">${resultRuleLevels(rule).map(level => `<div>${renderLevelDefinition(level)}<span class="dl-range">${e(resultLevelRange(level))}</span></div>`).join('')}</div>`;
}
export function dataRulePage() {
  let rows = listResultLevelRules();
  if (view.q.trim()) rows = rows.filter(rule => `${rule.name} ${resultLevelMetric(rule.metricId)?.label}`.toLowerCase().includes(view.q.trim().toLowerCase()));
  if (view.source !== 'all') rows = rows.filter(rule => resultLevelMetric(rule.metricId)?.source === view.source);
  if (view.enabled !== 'all') rows = rows.filter(rule => rule.enabled === (view.enabled === 'on'));
  const filters = UI.filters({
    search: { label: '搜索', id: 'dl-q', value: view.q, placeholder: '规则名称、指标名称', oninput: "App.dlFilter('q',this.value)" },
    selects: [
      { label: '演练类型', id: 'dl-source', value: view.source, options: [['all', '全部类型'], ['model', '模型演练'], ['agent', '智能体演练']], onchange: "App.dlFilter('source',this.value)" },
      { label: '状态', id: 'dl-enabled', value: view.enabled, options: [['all', '全部状态'], ['on', '启用'], ['off', '停用']], onchange: "App.dlFilter('enabled',this.value)" },
    ],
  });
  const table = UI.pagedTable('result-level-rules', [
    { title: '规则名称', width: '190px', render: rule => `<span>${e(rule.name)}</span><div class="dl-source">${sourceName(resultLevelMetric(rule.metricId).source)}</div>` },
    { title: '结果指标', width: '150px', render: rule => e(resultLevelMetric(rule.metricId).label) },
    { title: '等级映射', render: mapping },
    { title: '状态', width: '80px', render: rule => UI.badge(rule.enabled ? '启用' : '停用', rule.enabled ? 'green' : 'gray') },
    { title: '操作', width: '150px', cls: 'actions', render: rule => `<div class="row-actions">${UI.linkBtn('编辑', { onclick: `App.dlEdit('${rule.id}')` })}${UI.linkBtn(rule.enabled ? '停用' : '启用', { onclick: `App.dlToggle('${rule.id}')` })}${UI.linkBtn('删除', { danger: true, onclick: `App.dlDelete('${rule.id}')` })}</div>` },
  ], rows, '暂无匹配的数据等级规则');
  return UI.pageHead('数据等级规则', { actions: UI.btn('新建规则', { kind: 'primary', ico: 'plus', onclick: 'App.dlEdit()' }) }) + filters + UI.card('', table, '', true);
}
function renderForm() {
  if (!form) return;
  const metric = resultLevelMetric(form.metricId);
  const metricSelect = `<select id="dl-metric" onchange="App.dlMetric(this.value)">${['model', 'agent'].map(source => `<optgroup label="${sourceName(source)}">${RESULT_LEVEL_METRICS.filter(item => item.source === source).map(item => `<option value="${item.id}"${item.id === form.metricId ? ' selected' : ''}>${e(item.label)}</option>`).join('')}</optgroup>`).join('')}</select>`;
  const palettes = `<div class="dl-palette-choices" role="group" aria-label="等级数量与配色">${[3, 4, 5].map(count => `<button type="button" class="dl-palette-choice ${count === form.count ? 'active' : ''}" aria-pressed="${count === form.count}" onclick="App.dlCount(${count})"><span>${count} 个等级</span><span class="dl-swatches">${RESULT_LEVEL_PALETTES[count].map(color => `<i style="background:${color}"></i>`).join('')}</span></button>`).join('')}</div>`;
  const levels = resultRuleLevels(form);
  const thresholdInputs = form.thresholds.map((threshold, index) => field(`分界值 ${index + 1}`, `<span class="dl-percent-input"><input id="dl-threshold-${index}" aria-label="分界值 ${index + 1}" type="number" min="0.1" max="99.9" step="0.1" value="${e(threshold)}" oninput="App.dlThreshold(${index},this.value)"><span>%</span></span>`)).join('');
  const body = `<div class="dl-editor">
    <div class="dl-form-grid">
      ${field('规则名称 *', `<input id="dl-name" maxlength="60" value="${e(form.name)}" placeholder="例如：模型演练 ASR 分级" oninput="App.dlField('name',this.value)">`)}
      ${field('演练结果指标 *', metricSelect)}
    </div>
    <p class="dl-metric-note">${e(metric.note)}</p>
    <section class="dl-editor-section"><h3>等级数量与配色</h3>${palettes}</section>
    <section class="dl-editor-section"><div class="dl-section-heading"><h3>等级区间</h3><label class="dl-direction"><span>分级方向</span>${select('dl-direction', [['high', '数值越高，等级越高'], ['low', '数值越低，等级越高']], form.direction, 'App.dlDirection(this.value)')}</label></div>
      <div class="dl-threshold-grid">${thresholdInputs}</div>
      <p class="dl-field-note">分界值从小到大填写，相邻区间自动衔接，覆盖 0%—100%。</p>
      <div class="dl-level-table">${levels.map((level, index) => `<div class="dl-level-row"><span class="dl-level-rank" style="--result-level-color:${level.color}">${e(level.label)}</span><label class="field"><span class="sr-only">${e(level.label)}名称</span><input id="dl-level-name-${index}" aria-label="${e(level.label)}名称" maxlength="20" value="${e(level.name)}" oninput="App.dlName(${index},this.value)"></label><span class="dl-range" id="dl-level-range-${index}">${e(resultLevelRange(level))}</span></div>`).join('')}</div>
    </section>
    <section class="dl-editor-section"><h3>图标预览</h3><div id="dl-preview" class="dl-preview">${levels.map(level => renderLevelDefinition(level)).join('')}</div></section>
    <div class="dl-editor-footer"><label class="check"><input id="dl-form-enabled" type="checkbox" ${form.enabled ? 'checked' : ''} onchange="App.dlField('enabled',this.checked)">启用规则</label><span>未评估或不适用的指标不参与分级。</span></div>
    <p class="dl-error" id="dl-error" role="alert"></p>
  </div>`;
  UI.closeModal();
  UI.drawer(form.id ? '编辑数据等级规则' : '新建数据等级规则', body,
    UI.btn('取消', { onclick: 'App.dlClose()' }) + UI.btn('保存', { kind: 'primary', onclick: 'App.dlSave()' }));
  const panel = document.querySelector('#drawer .drawer');
  panel.classList.add('dl-drawer');
  panel.setAttribute('aria-label', form.id ? '编辑数据等级规则' : '新建数据等级规则');
  panel.querySelector('.modal-head .icon-btn').setAttribute('onclick', 'App.dlClose()');
}
function updatePreview() {
  const levels = resultRuleLevels(form);
  levels.forEach((level, index) => { const node = document.getElementById(`dl-level-range-${index}`); if (node) node.textContent = resultLevelRange(level); });
  const preview = document.getElementById('dl-preview');
  if (preview) preview.innerHTML = levels.map(level => renderLevelDefinition(level)).join('');
}
const showError = error => { const element = document.getElementById('dl-error'); if (element) element.textContent = error.message; else UI.toast(error.message); };
export const actions = {
  dlFilter(key, value) { if (!(key in view)) return; view[key] = value; UI.resetPage('result-level-rules'); refresh(); },
  dlEdit(id) {
    if (id) { form = getResultLevelRule(id); if (!form) return UI.toast('规则不存在'); }
    else {
      const used = new Set(listResultLevelRules().filter(rule => rule.enabled).map(rule => rule.metricId));
      const metric = RESULT_LEVEL_METRICS.find(item => !used.has(item.id)) || RESULT_LEVEL_METRICS[0];
      form = newResultLevelRule(metric.id);
    }
    renderForm();
  },
  dlClose() { form = null; UI.closeDrawer(); },
  dlField(key, value) { if (form && ['name', 'enabled'].includes(key)) form[key] = value; },
  dlMetric(metricId) { const metric = resultLevelMetric(metricId); if (!form || !metric) return; form.metricId = metricId; form.direction = metric.direction; renderForm(); },
  dlCount(count) { if (!form || ![3, 4, 5].includes(count) || count === form.count) return; const defaults = newResultLevelRule(form.metricId, count); Object.assign(form, { count, thresholds: defaults.thresholds, names: defaults.names }); renderForm(); },
  dlDirection(direction) { if (!form || !['high', 'low'].includes(direction)) return; form.direction = direction; renderForm(); },
  dlThreshold(index, value) { if (!form || !(index in form.thresholds)) return; form.thresholds[index] = value === '' ? '' : Number(value); updatePreview(); },
  dlName(index, name) { if (!form || !(index in form.names)) return; form.names[index] = name; updatePreview(); },
  dlSave() { if (!form) return; try { saveResultLevelRule(form); form = null; UI.closeDrawer(); refresh(); UI.toast('等级规则已保存'); } catch (error) { showError(error); } },
  dlToggle(id) { try { toggleResultLevelRule(id); refresh(); } catch (error) { UI.toast(error.message); } },
  dlDelete(id) {
    const rule = getResultLevelRule(id); if (!rule) return;
    UI.modal('删除数据等级规则', `<p>删除“${e(rule.name)}”后，对应指标将不再显示这条规则的等级图标。</p>`, UI.btn('取消', { onclick: 'UI.closeModal()' }) + UI.btn('删除', { kind: 'danger', onclick: `App.dlDeleteConfirm('${id}')` }));
  },
  dlDeleteConfirm(id) { try { deleteResultLevelRule(id); UI.closeModal(); refresh(); UI.toast('规则已删除'); } catch (error) { UI.toast(error.message); } },
};
