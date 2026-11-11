/* 平台管理：面向全平台的规则设置。
 * 模型管理：给资产中心已接入的模型配置角色，配置后才会出现在策略 / 任务的模型下拉里。
 * 风险管理：风险事件的触发条件与分级阈值。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as store from '../domain/store.js';
import { MODEL_ROLE, MODEL_ROLE_DESC, MODEL_STATUS } from '../domain/constants.js';

const ROLES = Object.values(MODEL_ROLE);

export function rolesPage() {
  const table = UI.pagedTable(
    'roles',
    [
      { title: '模型名称', render: (m) => UI.esc(m.name) },
      { title: '厂商', width: '120px', render: (m) => UI.esc(m.vendor) },
      { title: '状态', width: '100px', render: (m) => UI.badge(MODEL_STATUS[m.status], m.status === 'connected' ? 'green' : m.status === 'error' ? 'red' : 'gray') },
      { title: '平台用途', width: '300px', cls: 'nowrap', render: (m) => (m.roles.length ? m.roles.map((r) => UI.badge(r, 'blue')).join(' ') : UI.badge('未配置', 'gray')) },
      { title: '操作', width: '100px', cls: 'actions', render: (m) => UI.linkBtn('配置用途', { onclick: `App.roleForm('${m.id}')` }) },
    ],
    store.models,
    '暂无已接入的模型，请先在资产中心接入',
  );
  return `${UI.pageHead('模型管理', { actions: UI.btn('去添加模型', { onclick: "App.go('assets','models')" }) })}
  ${UI.card('', table, '', true)}`;
}

/* ---------------------------------------------------------------- 风险管理 */
const rv = { q: '', domain: 'all', state: 'all' };
const pc = (v) => `${Math.round(v * 100)}%`;
const ruleText = (t) => `单个演练任务 ${t.metric} &gt; ${pc(t.rule.trigger)}`;
const gradeText = (t) => `低危 ${pc(t.rule.trigger)}–${pc(t.rule.high)} · 中危 ${pc(t.rule.high)}–${pc(t.rule.critical)} · 高危 ≥ ${pc(t.rule.critical)}`;

export function riskRulePage() {
  let rows = store.riskTypes;
  if (rv.domain !== 'all') rows = rows.filter((t) => t.domain === rv.domain);
  if (rv.state !== 'all') rows = rows.filter((t) => (rv.state === 'on') === t.enabled);
  if (rv.q.trim()) rows = rows.filter((t) => (t.name + t.category).toLowerCase().includes(rv.q.trim().toLowerCase()));
  const domains = [...new Set(store.riskTypes.map((t) => t.domain))];
  const flt = UI.filters({
    search: { label: '搜索', id: 'rr-q', value: rv.q, placeholder: '搜索风险事件或风险类别', oninput: 'App.rrFilter("q",this.value)' },
    selects: [
      { label: '风险域', id: 'rr-domain', value: rv.domain, onchange: 'App.rrFilter("domain",this.value)', options: [['all', '全部风险域'], ...domains.map((d) => [d, d])] },
      { label: '状态', id: 'rr-state', value: rv.state, onchange: 'App.rrFilter("state",this.value)', options: [['all', '全部状态'], ['on', '启用'], ['off', '停用']] },
    ],
  });
  const table = UI.pagedTable(
    'riskrule',
    [
      { title: '风险事件', render: (t) => UI.esc(t.name) },
      { title: '风险域', width: '190px', render: (t) => UI.esc(t.domain) },
      { title: '触发规则', render: (t) => ruleText(t) },
      { title: '分级标准', render: (t) => gradeText(t) },
      { title: '状态', width: '80px', render: (t) => UI.badge(t.enabled ? '启用' : '停用', t.enabled ? 'green' : 'gray') },
      { title: '操作', width: '170px', cls: 'actions', render: (t) => `<div class="row-actions">${UI.linkBtn('触发规则', { onclick: `App.rrEdit('${t.id}','trigger')` })}${UI.linkBtn('分级标准', { onclick: `App.rrEdit('${t.id}','grade')` })}${UI.linkBtn(t.enabled ? '停用' : '启用', { onclick: `App.rrToggle('${t.id}')` })}</div>` },
    ],
    rows,
    '无匹配的风险事件类型',
  );
  return `${UI.pageHead('风险管理')}
  ${flt}${UI.card('', table, '', true)}`;
}

export const actions = {
  gotoRoles() { UI.closeModal(); router.nav('platform', 'roles'); },
  roleForm(id) {
    const m = store.models.find((x) => x.id === id);
    if (!m) return;
    const body = `<p class="muted text-support mb-12">选择「${UI.esc(m.name)}」在平台中的用途，可多选。配置后才会出现在策略与任务的对应模型下拉里。</p>
      <div class="form-secs">${ROLES.map((r) => `<label class="check"><input type="checkbox" name="rf-role" value="${r}" ${m.roles.includes(r) ? 'checked' : ''} /> <b>${UI.esc(r)}</b> <span class="faint text-support">${UI.esc(MODEL_ROLE_DESC[r])}</span></label>`).join('')}</div>`;
    UI.modal('配置用途', body, `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${UI.btn('保存', { kind: 'primary', onclick: `App.roleSave('${id}')` })}`);
  },
  roleSave(id) {
    const m = store.models.find((x) => x.id === id);
    m.roles = [...document.querySelectorAll('input[name=rf-role]:checked')].map((x) => x.value);
    UI.closeModal(); UI.toast('已保存'); router.nav('platform', 'roles');
  },
  rrFilter(k, v) { rv[k] = v; UI.resetPage('riskrule'); router.nav('platform', 'riskrule'); },
  rrToggle(id) { const t = store.riskTypes.find((x) => x.id === id); t.enabled = !t.enabled; router.nav('platform', 'riskrule'); },
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
    Object.assign(t.rule, n);
    UI.closeModal(); UI.toast('已保存，风险中心按新规则重新分级'); router.nav('platform', 'riskrule');
  },
};
