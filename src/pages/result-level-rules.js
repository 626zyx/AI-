import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import { renderLevelDefinition } from '../core/result-level-badge.js';
import {
  selectableResultLevelMetrics, resultLevelGradient, listResultLevelRules, getResultLevelRule,
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
    { title: '规则名称', width: '170px', render: rule => e(rule.name) },
    { title: '演练类型', width: '110px', render: rule => e(sourceName(rule.source)) },
    { title: '结果指标', width: '150px', render: rule => e(resultLevelMetric(rule.metricId)?.label || '旧指标') },
    { title: '等级映射', render: mapping },
    { title: '状态', width: '80px', render: rule => rule.enabled ? '<span class="metadata-text metadata-positive">启用</span>' : UI.badge('停用') },
    { title: '操作', width: '220px', cls: 'actions', render: rule => `<div class="row-actions">${UI.linkBtn('编辑', { onclick: `App.dlEdit('${rule.id}')` })}${UI.linkBtn('启用', {disabled:rule.enabled, onclick: `App.dlToggle('${rule.id}')` })}${UI.linkBtn('停用', {disabled:!rule.enabled, onclick: `App.dlToggle('${rule.id}')` })}${UI.linkBtn('删除', { danger: true, onclick: `App.dlDelete('${rule.id}')` })}</div>` },
  ], rows, '暂无匹配的数据等级规则');
  return UI.pageHead('数据等级', { actions: UI.btn('新建规则', { kind: 'primary', ico: 'plus', onclick: 'App.dlEdit()' }) }) + filters + UI.card('', table, '', true);
}
function renderForm() {
  if (!form) return;
  const metric = resultLevelMetric(form.metricId);
  const metrics = selectableResultLevelMetrics(form.source), originalMetric = form.id ? resultLevelMetric(getResultLevelRule(form.id)?.metricId) : null;
  if (originalMetric?.source === form.source && !metrics.some(item => item.id === originalMetric.id)) metrics.push({ ...originalMetric, label: originalMetric.label + '（已有规则）' });
  const metricSelect = `<select id="dl-metric" ${form.source ? '' : 'disabled'} onchange="App.dlMetric(this.value)"><option value="" ${!form.metricId ? 'selected' : ''}>请选择指标</option>${metrics.map(item => `<option value="${item.id}"${item.id === form.metricId ? ' selected' : ''}>${e(item.label)}</option>`).join('')}</select>`;
  const levels = resultRuleLevels(form);
  const thresholdInputs = form.thresholds.map((threshold, index) => field(`分界值 ${index + 1}`, `<span class="dl-percent-input"><input id="dl-threshold-${index}" aria-label="分界值 ${index + 1}" type="number" min="0" max="100" step="any" value="${e(threshold)}" oninput="App.dlThreshold(${index},this.value)"><span>%</span></span>`)).join('');
  const body = `<div class="dl-editor">
    ${field('规则名称 *', `<input id="dl-name" maxlength="60" value="${e(form.name)}" placeholder="例如：模型演练 ASR 分级" oninput="App.dlField('name',this.value)">`)}
    <div class="dl-form-grid">
      ${field('规则对象 *', select('dl-object', [['', '请选择对象'], ['model', '模型'], ['agent', '智能体']], form.source, 'App.dlSource(this.value)'))}
      ${field('结果指标 *', metricSelect)}
    </div>
    <p class="dl-metric-note">${e(metric?.note || '先选择规则对象，再选择对应的演练结果指标。')}</p>
    <section class="dl-editor-section"><h3>等级数量与配色</h3><div class="dl-colors-grid">
      ${field('等级数量', `<input id="dl-count" aria-label="等级数量" type="number" min="2" step="1" value="${e(form.countDraft ?? form.count)}" onchange="App.dlCount(this.value)">`)}
      ${field('最高等级颜色', `<span class="dl-color-control"><input id="dl-highest-color" aria-label="最高等级颜色" type="color" value="${e(form.highestColor)}" oninput="App.dlColor('highestColor',this.value)"><code id="dl-highest-color-text">${e(form.highestColor)}</code></span>`)}
      ${field('最低等级颜色', `<span class="dl-color-control"><input id="dl-lowest-color" aria-label="最低等级颜色" type="color" value="${e(form.lowestColor)}" oninput="App.dlColor('lowestColor',this.value)"><code id="dl-lowest-color-text">${e(form.lowestColor)}</code></span>`)}
      </div><p class="dl-field-note">至少设置 2 个等级，中间等级颜色按两端颜色自动渐变。</p></section>
    <section class="dl-editor-section"><div class="dl-section-heading"><h3>等级区间</h3><label class="dl-direction"><span>分级方向</span>${select('dl-direction', [['high', '数值越高，等级越高'], ['low', '数值越低，等级越高']], form.direction, 'App.dlDirection(this.value)')}</label></div>
      <div class="dl-threshold-grid">${thresholdInputs}</div>
      <p class="dl-field-note">分界值从小到大填写，相邻区间自动衔接，覆盖 0%—100%。</p>
      <div class="dl-level-table">${levels.map((level, index) => `<div class="dl-level-row"><span class="dl-level-rank" style="--result-level-color:${level.color}">${e(level.label)}</span><label class="field"><span class="sr-only">${e(level.label)}名称</span><input id="dl-level-name-${index}" aria-label="${e(level.label)}名称" maxlength="20" value="${e(level.name)}" oninput="App.dlName(${index},this.value)"></label><span class="dl-range" id="dl-level-range-${index}">${e(resultLevelRange(level))}</span></div>`).join('')}</div>
    </section>
    <section class="dl-editor-section"><h3>图标预览</h3><div id="dl-preview" class="dl-preview">${levels.map(level => renderLevelDefinition(level)).join('')}</div></section>
    <div class="dl-editor-footer"><span>未评估或不适用的指标不参与分级。</span></div>
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
  levels.forEach((level, index) => { const node = document.getElementById(`dl-level-range-${index}`); if (node) node.textContent = resultLevelRange(level); document.querySelectorAll('.dl-level-rank')[index]?.style.setProperty('--result-level-color', level.color); });
  const preview = document.getElementById('dl-preview');
  if (preview) preview.innerHTML = levels.map(level => renderLevelDefinition(level)).join('');
}
const showError = error => { const element = document.getElementById('dl-error'); if (element) element.textContent = error.message; else UI.toast(error.message); };
export const actions = {
  dlFilter(key, value) { if (!(key in view)) return; view[key] = value; UI.resetPage('result-level-rules'); refresh(); },
  dlEdit(id) {
    if (id) { form = getResultLevelRule(id); if (!form) return UI.toast('规则不存在'); }
    else form = newResultLevelRule();
    renderForm();
  },
  dlClose() { form = null; UI.closeDrawer(); },
  dlField(key, value) { if (form && key === 'name') form.name = value; },
  dlSource(source) { if (!form || !['', 'model', 'agent'].includes(source)) return; form.source = source; form.metricId = ''; renderForm(); },
  dlMetric(metricId) { const metric = resultLevelMetric(metricId); if (!form) return; if (!metricId) { form.metricId = ''; renderForm(); return; } const original = form.id ? getResultLevelRule(form.id) : null; if (!metric || metric.source !== form.source || !selectableResultLevelMetrics(form.source).some(item => item.id === metricId) && original?.metricId !== metricId) return; form.metricId = metricId; form.direction = metric.direction; renderForm(); },
  dlCount(value) { if (!form) return; form.countDraft = value; const count = Number(value); if (!Number.isSafeInteger(count) || count < 2) return showError(Error('等级数量必须是至少 2 的正整数')); if (count === form.count) return; const defaults = newResultLevelRule('', count); Object.assign(form, { count, thresholds: defaults.thresholds, names: defaults.names, colors: resultLevelGradient(count, form.highestColor, form.lowestColor), colorMode: 'gradient' }); renderForm(); document.getElementById('dl-count')?.focus(); },
  dlColor(key, value) { if (!form || !['highestColor', 'lowestColor'].includes(key)) return; try { const colors = resultLevelGradient(form.count, key === 'highestColor' ? value : form.highestColor, key === 'lowestColor' ? value : form.lowestColor); form[key] = value.toLowerCase(); form.colors = colors; form.colorMode = 'gradient'; document.getElementById(key === 'highestColor' ? 'dl-highest-color-text' : 'dl-lowest-color-text').textContent = form[key]; updatePreview(); } catch (error) { showError(error); } },
  dlDirection(direction) { if (!form || !['high', 'low'].includes(direction)) return; form.direction = direction; renderForm(); },
  dlThreshold(index, value) { if (!form || !(index in form.thresholds)) return; form.thresholds[index] = value === '' ? '' : Number(value); updatePreview(); },
  dlName(index, name) { if (!form || !(index in form.names)) return; form.names[index] = name; updatePreview(); },
  dlSave() { if (!form) return; try { const creating=!form.id; saveResultLevelRule({ ...form, count: form.countDraft ?? form.count }); form = null; UI.closeDrawer(); if(creating){Object.assign(view,{q:'',source:'all',enabled:'all'});UI.resetPage('result-level-rules');} refresh(); UI.toast('等级规则已保存'); } catch (error) { showError(error); } },
  dlToggle(id) { try { toggleResultLevelRule(id); refresh(); } catch (error) { UI.toast(error.message); } },
  dlDelete(id) {
    const rule = getResultLevelRule(id); if (!rule) return;
    UI.modal('删除数据等级规则', `<p>删除“${e(rule.name)}”后，对应指标将不再显示这条规则的等级图标。</p>`, UI.btn('取消', { onclick: 'UI.closeModal()' }) + UI.btn('删除', { kind: 'danger', onclick: `App.dlDeleteConfirm('${id}')` }));
  },
  dlDeleteConfirm(id) { try { deleteResultLevelRule(id); UI.closeModal(); refresh(); UI.toast('规则已删除'); } catch (error) { UI.toast(error.message); } },
};
