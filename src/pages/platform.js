/* 设置：数据等级规则与资产接入。保留旧页面导出以兼容已有链接。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { assetIntakePage, selectIntakeTab, actions as intakeActions } from './asset-intake.js';
import { openResourcePicker } from '../core/resource-picker.js';
import { modelConfigurationReturnButton, returnToModelConfiguration } from '../core/model-config-navigation.js';
import { listRiskRules, getRiskRule, saveRiskRule, publishRiskRule, toggleRiskRule, updateBuiltinRule, RISK_METRICS, COMPARISONS, RULE_LEVELS, riskRuleCondition } from '../domain/risk-rules.js';
import { listAssets } from '../domain/asset-intake.js';
import { can } from '../domain/issue-service.js';
export { dataRulePage } from './result-level-rules.js';


// Legacy model-management links resolve to the unified connection catalog.
export function rolesPage() {
  return assetIntakePage({ tab: 'models' });
}

/* ---------------------------------------------------------------- 风险管理 */
const rv = { q: '', state: 'all', source: 'all' };
const pc = (v) => `${Math.round(v * 100)}%`;
const gradeText = (t) => `低危 ${pc(t.rule.trigger)}–${pc(t.rule.high)} · 中危 ${pc(t.rule.high)}–${pc(t.rule.critical)} · 高危 ≥ ${pc(t.rule.critical)}`;
const esc = UI.esc;
const quote = value => esc(JSON.stringify(value || ''));
const options = (values, current) => values.map(([value, label]) => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`).join('');
const value = id => document.getElementById(id)?.value ?? '';
const field = (label, body) => `<label class="field"><span>${esc(label)}</span>${body}</label>`;
const input = (id, content, extra = '') => `<input id="${id}" value="${esc(content)}" ${extra}>`;
const currentRiskForm = () => ({ id: value('rr-id'), name: value('rr-name'), description: value('rr-description'), source: value('rr-source'), metricKey: value('rr-metric'), comparison: value('rr-comparison'), threshold: value('rr-threshold') === '' ? '' : Number(value('rr-threshold')) / 100, severity: value('rr-severity'), scope: value('rr-scope'), targetId: value('rr-target'), owner: value('rr-owner'), change: value('rr-change') });
function customRuleForm(id = '', override) {
  const existing = id && getRiskRule(id);
  if (existing?.builtin) return;
  const rule = override || (existing ? { ...existing, ...(existing.draft || {}) } : { id: '', name: '', description: '', source: 'model', metricKey: 'asr', comparison: 'gt', threshold: 0.3, severity: 'high', scope: 'project', targetId: '', owner: '安全运营' });
  const assets = listAssets({ kind: rule.source });
  const targetOptions = [['', `全部${rule.source === 'agent' ? ' Agent' : '模型'}资产`], ...assets.map(asset => [asset.id, asset.name])];
  if (rule.targetId && !assets.some(asset => asset.id === rule.targetId)) targetOptions.push([rule.targetId, rule.targetId]);
  const metrics = RISK_METRICS.filter(metric => metric.source === rule.source);
  const body = `<input type="hidden" id="rr-id" value="${esc(id)}"><div class="rr-form-grid">
    ${field('风险规则名称 *', input('rr-name', rule.name, 'maxlength="60" placeholder="例如：Agent 业务完成率过低"'))}
    ${field('演练类型', `<select id="rr-source" onchange="App.rrSource(this.value)">${options([['model', '模型演练'], ['agent', 'Agent 演练']], rule.source)}</select>`)}
    ${field('联动指标', `<select id="rr-metric" onchange="App.rrMetric(this.value)">${options(metrics.map(metric => [metric.key, metric.label]), rule.metricKey)}</select>`)}
    ${field('比较方向', `<select id="rr-comparison">${options(Object.entries(COMPARISONS), rule.comparison)}</select>`)}
    ${field('阈值（%）*', input('rr-threshold', rule.threshold === '' ? '' : Math.round(rule.threshold * 1000) / 10, 'type="number" min="0" max="100" step="0.1"'))}
    ${field('触发后的风险等级', `<select id="rr-severity">${options(Object.entries(RULE_LEVELS), rule.severity)}</select>`)}
    ${field('适用资产', `<input type="hidden" id="rr-target" value="${esc(rule.targetId)}"><button type="button" class="ai-resource-field" onclick="App.rrPickTarget()"><span id="rr-target-name">${esc(targetOptions.find(([id])=>id===rule.targetId)?.[1] || '全部同类资产')}</span><span>选择</span></button>`)}
    ${field('共享范围', `<select id="rr-scope">${options([['project', '当前项目'], ...(can('manageRules', 'org') ? [['org', '组织共享']] : [])], rule.scope)}</select>`)}
    ${field('负责人', input('rr-owner', rule.owner))}
    ${field('本次变更说明', input('rr-change', rule.change || '', 'placeholder="说明阈值或适用范围的调整"'))}
    <label class="field rr-wide"><span>业务含义</span><textarea id="rr-description" rows="2">${esc(rule.description)}</textarea></label>
  </div><p class="rr-note">完成率通常设置为「低于」阈值；泄露率、注入响应率、失误率和攻破率通常设置为「高于」。无有效判定的指标不参与触发，也不会按 0% 处理。</p>
  ${existing?.status === 'published' ? `<p class="rr-note">当前发布版本 ${esc(existing.version)} 继续生效。保存草稿后可继续修改，发布时生成新版本并按新规则检查已完成任务。</p>` : '<p class="rr-note">草稿不触发风险；发布后才参与风险检查。</p>'}<p id="rr-error" class="rr-error" role="alert"></p>`;
  const disabled = !can('manageRules', existing?.scope || rule.scope);
  UI.modal(existing ? `编辑风险规则 · ${existing.name}` : '自定义风险规则', body, UI.btn('取消', { onclick: 'UI.closeModal()' }) + UI.btn('保存草稿', { onclick: 'App.rrCustomSave(false)', disabled }) + UI.btn('发布', { kind: 'primary', onclick: 'App.rrCustomSave(true)', disabled: disabled || !can('publish', rule.scope) }), { wide: true });
}

export function riskRulePage() {
  let rows = listRiskRules();
  if (rv.state !== 'all') rows = rows.filter((t) => (rv.state === 'on') === t.enabled);
  if (rv.source !== 'all') rows = rows.filter(t => t.source === rv.source);
  if (rv.q.trim()) rows = rows.filter((t) => (t.name + (t.description || '')).toLowerCase().includes(rv.q.trim().toLowerCase()));
  const flt = UI.filters({
    search: { label: '搜索', id: 'rr-q', value: rv.q, placeholder: '搜索风险规则', oninput: 'App.rrFilter("q",this.value)' },
    selects: [
      { label: '状态', id: 'rr-state', value: rv.state, onchange: 'App.rrFilter("state",this.value)', options: [['all', '全部状态'], ['on', '启用'], ['off', '停用']] },
      { label: '演练类型', id: 'rr-source-filter', value: rv.source, onchange: 'App.rrFilter("source",this.value)', options: [['all', '全部类型'], ['model', '模型演练'], ['agent', 'Agent 演练']] },
    ],
  });
  const table = UI.pagedTable(
    'riskrule',
    [
      { title: '风险规则', render: t => `<strong>${esc(t.name)}</strong><div class="muted text-support">${t.source === 'agent' ? 'Agent 演练' : '模型演练'} · ${t.builtin ? '系统' : '用户自建'}${t.version ? ` · ${esc(t.version)}` : ''}</div>` },
      { title: '触发条件', render: t => esc(riskRuleCondition(t)) + (t.draft ? '<div class="muted text-support">有待发布草稿</div>' : '') },
      { title: '风险等级', render: t => t.builtin ? gradeText(t) : UI.badge(RULE_LEVELS[t.severity], t.severity === 'critical' ? 'red' : t.severity === 'high' ? 'amber' : 'blue') },
      { title: '适用范围', render: t => `${t.targetId ? esc(listAssets({ kind: t.source }).find(asset => asset.id === t.targetId)?.name || t.targetId) : '全部同类资产'}<div class="muted text-support">${t.scope === 'org' ? '组织共享' : '当前项目'}</div>` },
      { title: '状态', width: '100px', render: t => UI.badge(!t.enabled ? '停用' : t.status === 'published' ? '已发布 · 启用' : '草稿', !t.enabled ? 'gray' : t.status === 'published' ? 'green' : 'amber') },
      { title: '操作', width: '200px', cls: 'actions', render: t => `<div class="row-actions">${t.builtin ? UI.linkBtn('触发规则', { onclick: `App.rrEdit('${t.id}','trigger')`, disabled: !can('manageRules', 'org') }) + UI.linkBtn('分级标准', { onclick: `App.rrEdit('${t.id}','grade')`, disabled: !can('manageRules', 'org') }) : UI.linkBtn('编辑', { onclick: `App.rrCustom(${quote(t.id)})`, disabled: !can('manageRules', t.scope) }) + UI.linkBtn('版本', { onclick: `App.rrHistory(${quote(t.id)})` })}${!t.builtin && (t.status === 'draft' || t.draft) ? UI.linkBtn('发布', { onclick: `App.rrPublish(${quote(t.id)})`, disabled: !can('publish', t.scope) }) : ''}${UI.linkBtn(t.enabled ? '停用' : '启用', { onclick: `App.rrToggle('${t.id}')`, disabled: !can('manageRules', t.scope) })}</div>` },
    ],
    rows,
    '无匹配的风险事件类型',
  );
  return `${UI.pageHead('风险管理', { actions: UI.btn('查看风险', { onclick: "App.go('risk','events')" }) + UI.btn('自定义规则', { kind: 'primary', onclick: 'App.rrCustom()', disabled: !can('manageRules') }) })}
  <p class="rr-note">使用任务指标设置风险条件。系统规则直接调整阈值；用户规则可保存草稿、发布版本，并指定资产范围。当前启用的发布规则检查已完成演练，原任务报告保留原始结果。</p>${flt}${UI.card('', table, '', true)}`;
}

export const actions = {
  returnToModelConfiguration,
  gotoRoles() { UI.closeModal(); selectIntakeTab('models'); router.nav('platform', 'intake'); },
  roleForm(id) { const [assetId,version]=id.split('@'); selectIntakeTab('models'); intakeActions.aiEdit(assetId,version||'V1'); },
  roleSave() { UI.closeModal(); selectIntakeTab('models'); router.nav('platform','intake'); UI.toast('模型用途在任务中选择，无需永久分配角色'); },
  rrPickTarget() { const form=currentRiskForm(); openResourcePicker({kind:form.source,value:form.targetId,title:'选择适用资产',onSelect:resource=>{document.getElementById('rr-target').value=resource.assetId||resource.id;document.getElementById('rr-target-name').textContent=resource.displayName||resource.name;}}); },
  rrFilter(k, v) { rv[k] = v; UI.resetPage('riskrule'); router.nav('platform', 'riskrule'); },
  rrToggle(id) { try { toggleRiskRule(id); router.nav('platform', 'riskrule'); } catch (error) { UI.toast(error.message); } },
  rrCustom(id = '') { customRuleForm(id); },
  rrSource(source) { const form = currentRiskForm(); Object.assign(form, { source, metricKey: source === 'agent' ? 'leakRate' : 'asr', comparison: 'gt', targetId: '' }); customRuleForm(form.id, form); },
  rrMetric(metricKey) { const form = currentRiskForm(), metric = RISK_METRICS.find(metric => metric.key === metricKey && metric.source === form.source); form.comparison = metric?.comparison || 'gt'; customRuleForm(form.id, form); },
  rrCustomSave(publish,confirmed=false) { if(publish&&!confirmed)return UI.confirmPublication({kind:'风险规则',name:currentRiskForm().name,message:'发布后当前版本固定。后续修改将形成新的发布版本，历史结果继续保留原规则。',onConfirm:()=>actions.rrCustomSave(true,true)});try { saveRiskRule(currentRiskForm(), { publish }); UI.closeModal(); UI.toast(publish ? '规则已发布，风险中心已更新' : '草稿已保存'); router.nav('platform', 'riskrule'); } catch (error) { document.getElementById('rr-error').textContent = error.message; } },
  rrPublish(id,confirmed=false) { if(!confirmed)return UI.confirmPublication({kind:'风险规则',name:getRiskRule(id)?.name,message:'发布后当前版本固定。后续修改将形成新的发布版本，历史结果继续保留原规则。',onConfirm:()=>actions.rrPublish(id,true)});try { publishRiskRule(id); UI.toast('规则已发布，风险中心已更新'); router.nav('platform', 'riskrule'); } catch (error) { UI.toast(error.message); } },
  rrHistory(id) { const rule = getRiskRule(id); if (!rule) return; UI.modal(`${rule.name} · 发布版本`, UI.table([{ title: '版本', key: 'version' }, { title: '发布条件', render: item => esc(riskRuleCondition(item.snapshot)) }, { title: '等级', render: item => esc(RULE_LEVELS[item.snapshot.severity]) }, { title: '变更说明', render: item => esc(item.change) }, { title: '时间', key: 'at' }], [...rule.versions].reverse(), '尚未发布'), UI.btn('关闭', { onclick: 'UI.closeModal()' }), { wide: true }); },
  rrEdit(id, kind) {
    const t = store.riskTypes.find((x) => x.id === id);
    const num = (i, v) => `<div class="input-unit"><input type="number" id="${i}" min="0" max="100" step="1" value="${Math.round(v * 100)}" /><span>%</span></div>`;
    const body = kind === 'trigger'
      ? `<div class="field"><label for="rr-trigger">单个演练任务 ${t.metric} 大于</label>${num('rr-trigger', t.rule.trigger)}
          <span class="faint text-support">任务完成后计算 ${t.metric}，超过该值即生成一条风险事件。</span></div>`
      : `<div class="form-row"><div class="field"><label for="rr-high">中危下限（${t.metric} ≥）</label>${num('rr-high', t.rule.high)}</div>
          <div class="field"><label for="rr-critical">高危下限（${t.metric} ≥）</label>${num('rr-critical', t.rule.critical)}</div></div>
          <span class="faint text-support">低于中危下限、但已触发的事件为低危。</span>`;
    UI.modal(`${kind === 'trigger' ? '触发规则' : '分级标准'} · ${t.name}`, body,
      `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${UI.btn('保存', { kind: 'primary', onclick: `App.rrSave('${id}','${kind}')` })}`);
  },
  rrSave(id, kind) {
    const t = store.riskTypes.find((x) => x.id === id);
    const v = (i) => Number(document.getElementById(i).value) / 100;
    const n = { ...t.rule };
    if (kind === 'trigger') n.trigger = v('rr-trigger'); else { n.high = v('rr-high'); n.critical = v('rr-critical'); }
    if ([n.trigger, n.high, n.critical].some((x) => Number.isNaN(x) || x < 0 || x > 1)) return UI.toast('阈值需在 0–100% 之间');
    if (!(n.trigger < n.high && n.high < n.critical)) return UI.toast('需满足：触发值 < 中危下限 < 高危下限');
    try { updateBuiltinRule(id, n); } catch (error) { return UI.toast(error.message); }
    UI.closeModal(); UI.toast('已保存，风险中心按新规则重新分级'); router.nav('platform', 'riskrule');
  },
};
