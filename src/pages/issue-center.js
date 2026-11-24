/* 问题整改、生产回流与风险配置；沿用平台表格、表单和弹窗。 */
import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import * as service from '../domain/issue-service.js';
import { listAssets, getAsset, listAssetVersions } from '../domain/asset-intake.js';
import * as store from '../domain/store.js';
import { openTaskWizard } from './task-wizard.js';
import { addFeedbackCase, getResource, regressionStrategies, createRegressionStrategy, completedTasks, recordReviewedRetest, recordFeedbackTask } from '../domain/issue-resource-bridge.js';

const esc = UI.esc;
const q = value => esc(JSON.stringify(String(value || '')));
const value = id => document.getElementById(id)?.value?.trim() || '';
const selected = (actual, expected) => actual === expected ? ' selected' : '';
const option = (id, label, current) => `<option value="${esc(id)}"${selected(id, current)}>${esc(label)}</option>`;
const field = (label, id, content, hint = '') => `<div class="field ic-field"><label for="${id}">${esc(label)}</label>${content}${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
const input = (id, val = '', extra = '') => `<input id="${id}" value="${esc(val)}" ${extra}>`;
const textarea = (id, val = '', rows = 3) => `<textarea id="${id}" rows="${rows}">${esc(val)}</textarea>`;
const text = val => `<div class="ic-prose">${esc(val || '—')}</div>`;
const badge = (map, status) => UI.badge(map[status]?.label || status, map[status]?.tone || 'gray');
const timeline = history => `<ol class="ic-timeline">${history.map(e => `<li><div>${esc(e.text)}</div><small>${esc(e.at)} · ${esc(e.actor)}</small></li>`).join('')}</ol>`;
const note = content => `<div class="ic-note">${content}</div>`;
const kinds = { model: '模型', agent: 'Agent' };
const categories = { leakage: '信息披露', unauthorized: '越权或未审批动作', refusal: '正常请求误拒', task_failure: '业务任务未完成', content: '内容安全', other: '其他业务问题' };
const issueFilter = { query: '', status: '', severity: '', source: '' };
const feedbackFilter = { query: '', status: '' };
let feedbackFiles = [];
const evaluationRules = [['eval-leak', '受保护信息披露'], ['eval-refund', '未授权业务承诺'], ['eval-refusal', '正常请求误拒'], ['content-safety', '内容安全违规'], ['task-completion', 'Agent 任务未完成'], ['custom', '自定义业务判定']];
const taskLink = (id, kind, label = id) => UI.linkBtn(label, { onclick: `App.go('${kind === 'agent' ? 'agent' : 'exercise'}','${kind === 'agent' ? 'ag-task-detail' : 'task-detail'}',${q(id)})` });

function refresh() {
  const cur = router.state();
  router.nav(cur.page, cur.sub, cur.param, { replace: true });
}
function perform(fn, message) {
  try { const result = fn(); UI.closeModal(); UI.closeDrawer(); refresh(); if (message) UI.toast(message); return result; }
  catch (error) { UI.toast(error.message); return null; }
}
function action(label, call, permission, primary = false) {
  return UI.btn(label, { onclick: call, kind: primary ? 'primary' : '', disabled: permission && !service.can(permission) });
}
function permissionNote() {
  return `<span class="ic-role">${esc(service.roleLabel())} ${UI.linkBtn('切换角色', { onclick: "App.go('platform','permissions')" })}</span>`;
}
function counts(items) {
  const pending = items.filter(f => f.status === 'pending').length;
  const active = items.filter(f => ['confirmed', 'processing'].includes(f.status)).length;
  const retest = items.filter(f => f.status === 'retest').length;
  const closed = items.filter(f => f.status === 'closed').length;
  return `<div class="ic-stats">${[['待确认', pending], ['待处理', active], ['待复测 / 验收', retest], ['已验证关闭', closed]].map(([label, count]) => `<div><span>${label}</span><strong class="num">${count}</strong></div>`).join('')}</div>`;
}
function findingPrimary(f) {
  if (f.status === 'pending') return UI.linkBtn('确认', { onclick: `App.icTransition(${q(f.id)},'confirmed')`, disabled: !service.can('confirm') });
  if (f.status === 'retest') return UI.linkBtn('复测', { onclick: `App.icRetest(${q(f.id)})`, disabled: !service.can('retest') });
  if (['confirmed', 'processing'].includes(f.status)) return UI.linkBtn('提交修复', { onclick: `App.icFix(${q(f.id)})`, disabled: !service.can('submitFix') });
  return '';
}

export function issuesPage() {
  const all = service.listFindings();
  const rows = all.filter(f => (!issueFilter.query || `${f.title} ${f.assetName} ${f.owner}`.toLowerCase().includes(issueFilter.query.toLowerCase())) && (!issueFilter.status || f.status === issueFilter.status) && (!issueFilter.severity || f.severity === issueFilter.severity) && (!issueFilter.source || f.source === issueFilter.source));
  return `<div class="ic-page">${UI.pageHead('问题整改', { actions: action('反馈生产问题', 'App.icFeedback()', 'feedback', true) })}
    <p class="ic-lead">将演练发现和生产反馈转为可分派、可复测的问题。修复后同时验证原问题与正常业务，再完成验收关闭。</p>
    ${counts(all)}
    ${UI.card('', UI.filters({ search: { id: 'ic-issue-query', label: '搜索', value: issueFilter.query, placeholder: '问题、资产或负责人', oninput: 'App.icFilter("query",this.value)' }, selects: [
      { id: 'ic-status', label: '状态', value: issueFilter.status, onchange: 'App.icFilter("status",this.value)', options: [['', '全部状态'], ...Object.entries(service.FINDING_STATUS).map(([k, v]) => [k, v.label])] },
      { id: 'ic-severity', label: '严重程度', value: issueFilter.severity, onchange: 'App.icFilter("severity",this.value)', options: [['', '全部'], ...Object.entries(service.SEVERITIES).map(([k, v]) => [k, v.label])] },
      { id: 'ic-source', label: '来源', value: issueFilter.source, onchange: 'App.icFilter("source",this.value)', options: [['', '全部'], ['validation', '安全验证'], ['production', '生产反馈']] },
    ], right: permissionNote() }) + UI.pagedTable('ic-issues', [
      { title: '问题', render: f => `<div class="ic-cell-title">${UI.linkBtn(f.title, { onclick: `App.go('risk','detail',${q(f.id)})` })}</div><small class="muted">${esc(f.ruleName)}</small>` },
      { title: '关联资产 / 版本', render: f => `${esc(f.assetName)}<div class="muted text-support">${kinds[f.assetKind]} · ${esc(f.targetVersion)}</div>` },
      { title: '严重程度', width: '92px', render: f => badge(service.SEVERITIES, f.severity) },
      { title: '状态', width: '120px', render: f => badge(service.FINDING_STATUS, f.status) },
      { title: '负责人', key: 'owner', width: '100px' },
      { title: '来源', width: '90px', render: f => f.source === 'production' ? '生产反馈' : '安全验证' },
      { title: '操作', width: '160px', render: f => `<div class="ic-actions">${findingPrimary(f)}${UI.linkBtn('详情', { onclick: `App.go('risk','detail',${q(f.id)})` })}</div>` },
    ], rows, '暂无符合条件的问题'), '', true)}</div>`;
}

export function issueDetailPage(cur) {
  const f = service.getFinding(cur.param);
  if (!f) return UI.pageHead('问题不存在', { back: UI.backBtn() });
  const ended = ['closed', 'false_positive', 'accepted'].includes(f.status);
  const last = f.retests.at(-1);
  const canClose = f.status === 'retest' && last?.passed && last?.normalPassed && last.targetVersion === f.fixVersion;
  let controls = '';
  if (f.status === 'pending') controls += action('确认问题', `App.icTransition(${q(f.id)},'confirmed')`, 'confirm', true);
  if (f.status === 'confirmed') controls += action('开始处理', `App.icTransition(${q(f.id)},'processing')`, 'confirm', true);
  if (!ended) controls += action('提交修复', `App.icFix(${q(f.id)})`, 'submitFix', f.status === 'processing');
  if (f.fixVersion && !ended) controls += action('复测与验收', `App.icRetest(${q(f.id)})`, 'retest', !canClose);
  if (canClose) controls += action('验收关闭', `App.icTransition(${q(f.id)},'closed')`, 'close', true);
  if (ended) controls += action('重新打开', `App.icTransition(${q(f.id)},'confirmed')`, 'confirm');
  const riskType = f.riskTypeSnapshot || service.getRiskType(f.riskTypeId);
  const reTests = f.retests.length ? UI.table([
    { title: '任务 / 修复版本', render: r => `${taskLink(r.taskId, f.assetKind)}<div class="muted">${esc(r.targetVersion)}</div>` },
    { title: '原问题', render: r => UI.badge(r.passed ? '通过' : '未通过', r.passed ? 'green' : 'red') },
    { title: '正常业务回归', render: r => UI.badge(r.normalPassed ? '通过' : '未通过', r.normalPassed ? 'green' : 'red') },
    { title: '复测时间', key: 'at' },
    { title: '验收依据', render: r => `${esc(r.notes)}<div class="muted">${esc(r.reviewedBy)}</div>` },
  ], f.retests) : note('提交修复版本后，从本问题发起复测；复测结论会回写这里。');
  return `<div class="ic-page">${UI.pageHead(f.title, { back: UI.backBtn(), extra: badge(service.FINDING_STATUS, f.status), actions: controls })}
    <div class="ic-detail-grid"><div class="ic-stack">
      ${UI.card('问题与证据', UI.kvTable([['业务影响', text(f.description)], ['关联资产', `${esc(f.assetName)} · ${esc(f.targetVersion)}`], ['判定规则', esc(f.ruleName)], ['原始证据', service.can('sensitive') ? `<pre class="ic-evidence">${esc(f.evidence)}</pre>` : note('当前角色可查看问题摘要；查看完整证据需安全测试权限。')], ['来源反馈', f.feedbackId ? UI.linkBtn('查看生产反馈', { onclick: `App.go('risk','feedback-detail',${q(f.feedbackId)})` }) : ''], ['来源任务', f.taskId ? UI.linkBtn('查看验证任务', { onclick: `App.icOpenTask(${q(f.taskId)})` }) : '']]))}
      ${UI.card('修复与验收', `<div class="ic-steps"><span class="done">确认问题</span><span class="${f.fixVersion ? 'done' : ''}">提交修复版本</span><span class="${last ? 'done' : ''}">原问题 + 正常回归</span><span class="${f.status === 'closed' ? 'done' : ''}">验收关闭</span></div>${f.fixVersion ? UI.kvTable([['提交版本', esc(f.fixVersion)], ['修复说明', text(f.fixNotes)]]) : ''}${reTests}${f.status === 'retest' && !canClose ? '<p class="ic-caption">只有修复版本一致，且原问题与正常业务回归均通过，才可验收关闭。</p>' : ''}${f.acceptance ? note(`风险接受：${esc(f.acceptance.reason)}<br>范围：${esc(f.acceptance.scope)} · 有效期至 ${esc(f.acceptance.expiresAt)}`) : ''}`)}
    </div><div class="ic-stack">
      ${UI.card('分派与分级', UI.kvTable([['严重程度', badge(service.SEVERITIES, f.severity)], ['风险类型', esc(riskType?.name || f.ruleName)], ['负责人', esc(f.owner)], ['发现版本', esc(f.targetVersion)], ['更新时间', esc(f.updatedAt)]]), UI.linkBtn('编辑', { onclick: `App.icAssign(${q(f.id)})`, disabled: !service.can('edit') }))}
      ${!ended ? UI.card('其他处理', `<div class="ic-actions">${UI.linkBtn('标记误报', { onclick: `App.icDecision(${q(f.id)},'false_positive')`, disabled: !service.can('confirm') })}${UI.linkBtn('接受风险', { onclick: `App.icDecision(${q(f.id)},'accepted')`, disabled: !service.can('accept') })}</div><p class="ic-caption">误报需说明依据；接受风险需记录范围、理由与到期时间。</p>`) : ''}
      ${UI.card('处理记录', timeline(f.history))}
    </div></div></div>`;
}

export function feedbackPage() {
  const all = service.listFeedback();
  const rows = all.filter(f => (!feedbackFilter.query || `${f.title} ${f.assetName} ${f.contact}`.toLowerCase().includes(feedbackFilter.query.toLowerCase())) && (!feedbackFilter.status || f.status === feedbackFilter.status));
  return `<div class="ic-page">${UI.pageHead('生产反馈', { actions: action('提交反馈', 'App.icFeedback()', 'feedback', true) })}
    <p class="ic-lead">上传线上新问题或业务验收反馈，补齐复现条件，再转成问题和可重复使用的回归用例。</p>
    <div class="ic-steps"><span>1 提交实际表现</span><span>2 确认预期与边界</span><span>3 加入回归题库</span><span>4 复测并验收</span></div>
    ${UI.card('', UI.filters({ search: { id: 'ic-feedback-query', label: '搜索', value: feedbackFilter.query, placeholder: '反馈、资产或提交人', oninput: 'App.icFeedbackFilter("query",this.value)' }, selects: [{ id: 'ic-feedback-status', label: '状态', value: feedbackFilter.status, onchange: 'App.icFeedbackFilter("status",this.value)', options: [['', '全部状态'], ...Object.entries(service.FEEDBACK_STATUS).map(([k, v]) => [k, v.label])] }], right: permissionNote() }) + UI.pagedTable('ic-feedback', [
      { title: '反馈', render: f => `<div>${UI.linkBtn(f.title, { onclick: `App.go('risk','feedback-detail',${q(f.id)})` })}</div><small class="muted">${esc(categories[f.category] || '业务问题')} · ${esc(f.createdAt)}</small>` },
      { title: '资产 / 生产版本', render: f => `${esc(f.assetName)}<div class="muted">${esc(f.productionVersion)}</div>` },
      { title: '处理状态', width: '125px', render: f => badge(service.FEEDBACK_STATUS, f.status) },
      { title: '回流去向', render: f => f.bankId ? '已关联回归题库' : f.findingId ? '已关联问题' : '待分析' },
      { title: '提交人', key: 'contact', width: '100px' },
      { title: '操作', width: '90px', render: f => UI.linkBtn('分析处理', { onclick: `App.go('risk','feedback-detail',${q(f.id)})` }) },
    ], rows, '暂无反馈。可从生产验收或用户投诉中提交第一条。'), '', true)}</div>`;
}

export function feedbackDetailPage(cur) {
  const f = service.getFeedback(cur.param);
  if (!f) return UI.pageHead('反馈不存在', { back: UI.backBtn() });
  const bank = getResource(f.bankId);
  const candidate = f.candidate;
  let controls = !f.bankId ? action(candidate ? '编辑复现用例' : '整理复现用例', `App.icPrepare(${q(f.id)})`, 'edit', true) : '';
  if (candidate && !f.bankId) controls += action('加入回归集', `App.icAddCase(${q(f.id)})`, 'edit', true);
  if (f.bankId) controls += action(bank?.status === 'draft' ? '审阅并发布题库' : '查看回归题库', `App.raOpen(${q(f.bankId)})`, 'read', bank?.status === 'draft');
  if (bank?.status === 'published') controls += action('开始回归验证', `App.icValidateFeedback(${q(f.id)})`, 'retest', true);
  return `<div class="ic-page">${UI.pageHead(f.title, { back: UI.backBtn(), extra: badge(service.FEEDBACK_STATUS, f.status), actions: controls })}
    <div class="ic-detail-grid"><div class="ic-stack">
      ${UI.card('生产反馈原始记录', UI.kvTable([['关联资产', `${esc(f.assetName)} · ${esc(f.productionVersion)}`], ['正常业务目的', text(f.purpose)], ['触发输入 / 上下文', text(f.input)], ['实际表现', text(f.actual)], ['正确预期', text(f.expected)], ['业务影响', text(f.impact)], ['业务规则', text(f.rule)], ['提交人', esc(f.contact)], ['附件', f.attachments.length ? f.attachments.map((a, index) => UI.linkBtn(a.name, { onclick: `App.icAttachment(${q(f.id)},${index})` })).join(' · ') : '无']]))}
      ${UI.card('回归用例', candidate ? `<div class="ic-comparison"><div><span class="ic-label">输入与上下文</span>${text(candidate.input)}</div><div><span class="ic-label">通过条件</span>${text(candidate.expected)}</div></div>${UI.kvTable([['用例分组', UI.badge(candidate.group === 'normal' ? '正常对照' : candidate.group === 'boundary' ? '边界用例' : '攻击用例', candidate.group === 'normal' ? 'green' : 'blue')], ['业务规则', text(candidate.rule)], ['写入题库', bank ? `${esc(bank.name)} · ${esc(bank.version)} ${UI.badge(bank.status === 'published' ? '已发布' : '草稿', bank.status === 'published' ? 'green' : 'amber')}` : '尚未加入回归集']])}${f.bankId ? note(bank?.status === 'published' ? '已发布的用例可被新验证任务引用，运行时将固定题库版本。' : '用例已进入题库草稿。请审阅输入、预期与 Agent 场景包，再发布供验证使用。') : ''}` : note('点击「整理复现用例」，确认最小触发输入和正确预期。正常业务误拒与任务失败应加入正常对照组。'))}
    </div><div class="ic-stack">
      ${UI.card('问题与闭环', f.findingId ? `${UI.linkBtn('查看关联整改问题', { onclick: `App.go('risk','detail',${q(f.findingId)})` })}<p class="ic-caption">关联问题的修复版本经过验证并验收关闭后，反馈标记为处理完成。</p>` : `<p class="ic-caption">确认存在问题后，创建或关联整改项，指定负责人。</p>${action('创建整改问题', `App.icFeedbackIssue(${q(f.id)})`, 'edit')}`)}
      ${UI.card('回流范围', `<p class="ic-caption">保留生产资产版本和原始反馈；用例整理结果单独审阅。原始反馈不会直接改写已发布题库或历史验证结果。</p>${f.validationTaskId ? UI.linkBtn('查看最近回归验证', { onclick: `App.icOpenTask(${q(f.validationTaskId)})` }) : ''}`)}
      ${UI.card('处理记录', timeline(f.history))}
    </div></div></div>`;
}

export function riskSettingsPage() {
  return `<div class="ic-page">${UI.pageHead('风险配置', { actions: action('新增风险类型', 'App.icRiskEdit()', 'manageRules', true) })}
    <p class="ic-lead">为验证发现设置业务风险名称、严重程度与默认负责人。触发条件引用评估规则，配置发布后供新任务使用；历史结果保留原版本。</p>
    ${note('选择通用判定项或填写自定义业务条件，再设置风险名称、分级和负责人。发布版本用于新问题归类，历史问题保留当时的风险配置。')}
    ${UI.card('', UI.table([
      { title: '风险类型', render: t => `${UI.linkBtn(t.name, { onclick: `App.icRiskEdit(${q(t.id)})` })}<div class="muted text-support">${esc(t.description)}</div>` },
      { title: '严重程度', width: '100px', render: t => badge(service.SEVERITIES, t.severity) },
      { title: '触发条件', render: t => t.trigger === 'single' ? '单次违规触发' : `适用用例违规率 > ${t.threshold}%` },
      { title: '范围 / 负责人', render: t => `${t.scope === 'org' ? '组织共享' : '当前项目'}<div class="muted">${esc(t.owner)}</div>` },
      { title: '版本 / 状态', width: '145px', render: t => `${esc(t.version)} ${UI.badge(!t.enabled ? '已停用' : t.status === 'published' ? '已发布' : '草稿', !t.enabled ? 'gray' : t.status === 'published' ? 'green' : 'amber')}${t.draft ? '<div class="muted text-support">有待发布草稿</div>' : ''}` },
      { title: '操作', width: '150px', render: t => `<div class="ic-actions">${UI.linkBtn('版本', { onclick: `App.icRiskHistory(${q(t.id)})` })}${UI.linkBtn(t.enabled ? '停用' : '启用', { onclick: `App.icRiskToggle(${q(t.id)})`, disabled: !service.can('manageRules', t.scope) })}</div>` },
    ], service.listRiskTypes()), '', true)}</div>`;
}

export function permissionsPage() {
  const role = service.getCurrentRole();
  const rows = [
    ['查看资产与验证摘要', [true, true, true, true]], ['查看完整验证证据', [true, true, false, false]], ['上传资产与编辑项目资源', [true, true, true, false]],
    ['发布项目资源 / 风险配置', [true, true, false, false]], ['修改组织共享配置', [true, false, false, false]], ['发起安全验证', [true, true, false, false]],
    ['提交生产反馈 / 修复', [true, true, true, false]], ['发起修复复测', [true, true, true, false]], ['确认问题 / 验收关闭', [true, true, false, false]], ['接受风险', [true, false, false, false]],
  ];
  return `<div class="ic-page">${UI.pageHead('角色与权限')}
    <p class="ic-lead">按职责控制操作，并区分项目内配置与组织共享配置。当前 Demo 可切换角色，检查各入口的权限表现。</p>
    <div class="ic-role-grid">${Object.entries(service.ROLES).map(([id, r]) => `<button class="ic-role-card ${role === id ? 'active' : ''}" onclick="App.icRole('${id}')"><strong>${esc(r.name)}</strong><span>${esc(r.description)}</span>${UI.badge(role === id ? '当前角色' : '切换体验', role === id ? 'blue' : 'gray')}</button>`).join('')}</div>
    ${UI.card('操作权限', UI.table([{ title: '操作', key: 'name' }, ...Object.values(service.ROLES).map((r, i) => ({ title: r.name, render: row => `<span class="${row.values[i] ? 'ic-allowed' : 'muted'}">${row.values[i] ? '允许' : '—'}</span>` }))], rows.map(([name, values]) => ({ name, values }))), '', true)}
    ${UI.card('权限如何作用于业务', `<div class="ic-comparison"><div><span class="ic-label">项目范围</span><p>测试人员可发布本项目资源；业务与研发协作者提交草稿、反馈和修复，安全人员负责确认与验收。</p></div><div><span class="ic-label">组织共享范围</span><p>由负责人统一管理，项目复用时固定版本。改变共享内容需要另发版本，避免影响已有任务。</p></div></div>${note('这是产品交互中的角色预览。正式接入时，项目成员与组织权限由企业身份系统授予，服务端执行相同权限校验。')}`)}
    </div>`;
}

function riskForm(id) {
  const existing = id ? service.getRiskType(id) : null;
  const t = existing ? { ...existing, ...(existing.draft || {}) } : { name: '', description: '', severity: 'medium', trigger: 'single', threshold: 10, ruleId: '', scope: 'project', owner: '安全运营', change: '' };
  const rules = evaluationRules.map(([id, name]) => ({ id, name }));
  const disabled = existing && !service.can('manageRules', existing.scope);
  const ruleOptions = [['', '选择判定项'], ...rules.map(r => [r.id, r.name])];
  if (t.ruleId && !rules.some(r => r.id === t.ruleId)) ruleOptions.push([t.ruleId, t.ruleId]);
  UI.modal(existing ? `${existing.name} · ${existing.version}` : '新增风险类型', `<div class="ic-form-grid">
    ${field('风险类型名称 *', 'ic-risk-name', input('ic-risk-name', t.name, 'maxlength="60"'))}
    ${field('默认严重程度', 'ic-risk-severity', `<select id="ic-risk-severity">${Object.entries(service.SEVERITIES).map(([key, v]) => option(key, v.label, t.severity)).join('')}</select>`)}
    <div class="ic-wide">${field('业务含义', 'ic-risk-description', textarea('ic-risk-description', t.description))}</div>
    ${field('关联判定项', 'ic-risk-rule', `<select id="ic-risk-rule">${ruleOptions.map(([key, label]) => option(key, label, t.ruleId)).join('')}</select>`, '用于归类评估发现；自定义业务条件需明确通过与违规边界。')}
    <div class="ic-wide">${field('判定条件 / 业务边界', 'ic-risk-rule-text', textarea('ic-risk-rule-text', t.ruleText || '', 3), '例如：未取得审批时不得声称退款已完成；说明退款政策属于正常回答。')}</div>
    ${field('默认负责人', 'ic-risk-owner', input('ic-risk-owner', t.owner))}
    ${field('问题触发条件', 'ic-risk-trigger', `<select id="ic-risk-trigger" onchange="App.icTrigger(this.value)">${option('single', '单次违规触发', t.trigger)}${option('threshold', '违规率超过阈值', t.trigger)}</select>`)}
    ${field('违规率阈值（%）', 'ic-risk-threshold', input('ic-risk-threshold', t.threshold, `type="number" min="0" max="100" ${t.trigger === 'single' ? 'disabled' : ''}`), '适用且可判定用例为分母。')}
    ${field('应用范围', 'ic-risk-scope', `<select id="ic-risk-scope">${option('project', '当前项目', t.scope)}<option value="org"${selected(t.scope, 'org')}${service.getCurrentRole() !== 'admin' ? ' disabled' : ''}>组织共享</option></select>`)}
    ${field('本次变更说明', 'ic-risk-change', input('ic-risk-change', t.change || '', 'placeholder="例如：新增未审批退款承诺风险"'))}
    </div>${existing?.status === 'published' ? note(`当前发布版本 ${esc(existing.version)} 仍可被任务引用。保存草稿不替换已发布内容；发布时产生新版本。`) : ''}`, `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${UI.btn('保存草稿', { onclick: `App.icRiskSave(${q(id)},false)`, disabled: disabled || !service.can('manageRules', t.scope) })}${UI.btn('发布', { kind: 'primary', onclick: `App.icRiskSave(${q(id)},true)`, disabled: disabled || !service.can('publish', t.scope) })}`, { wide: true });
}

export const actions = {
  icOpenTask(id) { const agent = store.getAgentTask(id); router.nav(agent ? 'agent' : 'exercise', agent ? 'ag-task-detail' : 'task-detail', id); },
  icRetest(id) {
    const f = service.getFinding(id); if (!f || !service.can('retest')) return UI.toast('当前角色不能登记复测');
    const tasks = completedTasks(f.assetId, f.assetKind, f.fixVersion);
    UI.modal('复测与验收', `<div class="ic-stack">${note(`修复版本 ${esc(f.fixVersion)}。新建演练验证该版本，完成后关联任务并分别确认两项结论。`)}${action('新建修复版本演练', `App.icStartRetest(${q(id)})`, 'retest')}${field('已完成的同版本任务 *', 'ic-retest-task', `<select id="ic-retest-task">${option('', tasks.length ? '请选择任务' : '暂无同版本已完成任务', '')}${tasks.map(t => option(t.id, t.name, '')).join('')}</select>`)}${field('原问题是否修复 *', 'ic-retest-passed', `<select id="ic-retest-passed">${option('', '请选择结论', '')}${option('true', '通过', '')}${option('false', '未通过', '')}</select>`)}${field('正常业务回归 *', 'ic-retest-normal', `<select id="ic-retest-normal">${option('', '请选择结论', '')}${option('true', '通过', '')}${option('false', '未通过', '')}</select>`)}${field('验收依据 *', 'ic-retest-notes', textarea('ic-retest-notes', '', 3), '记录已核对的输入、答复、轨迹或交付物；ASR 不能替代正常业务回归。')}</div>`, UI.btn('取消', { onclick: 'UI.closeModal()' }) + action('登记复测结论', `App.icRetestSave(${q(id)})`, 'retest', true));
  },
  icStartRetest(id) {
    const f = service.getFinding(id), asset = f && getAsset(f.assetId, f.fixVersion);
    if (!service.can('retest')) return UI.toast('当前角色不能发起复测');
    if (!asset || asset.status !== 'ready') return UI.toast('请先上传并连通修复后的资产版本');
    const source = f.taskId && (f.assetKind === 'agent' ? store.getAgentTask(f.taskId) : store.getTask(f.taskId));
    UI.closeModal(); openTaskWizard(f.assetKind, { targetId: `${asset.id}@${asset.version}`, name: `复测 · ${f.title} · ${Date.now().toString(36).slice(-4)}`, description: `整改问题 ${f.id}；验证原问题及正常业务回归。`, strategyId: source?.strategyId, judgeId: source?.judgeId });
  },
  icRetestSave(id) { perform(() => { const passed = value('ic-retest-passed'), normal = value('ic-retest-normal'); if (!passed || !normal) throw new Error('请分别选择原问题和正常业务回归结论'); return recordReviewedRetest(id, value('ic-retest-task'), { passed: passed === 'true', normalPassed: normal === 'true', notes: value('ic-retest-notes') }); }, '复测结论已登记，两项通过后可验收关闭'); },
  icFilter(key, val) { issueFilter[key] = val; UI.resetPage('ic-issues'); const focus = document.activeElement?.id; const pos = document.activeElement?.selectionStart; refresh(); if (focus) { const el = document.getElementById(focus); el?.focus(); if (typeof pos === 'number') el?.setSelectionRange?.(pos, pos); } },
  icFeedbackFilter(key, val) { feedbackFilter[key] = val; UI.resetPage('ic-feedback'); const focus = document.activeElement?.id; const pos = document.activeElement?.selectionStart; refresh(); if (focus) { const el = document.getElementById(focus); el?.focus(); if (typeof pos === 'number') el?.setSelectionRange?.(pos, pos); } },
  icTransition(id, status) { perform(() => service.transitionFinding(id, status), status === 'closed' ? '已验证关闭，相关反馈同步完成' : '问题状态已更新'); },
  icAssign(id) {
    const f = service.getFinding(id); if (!f) return;
    UI.modal('分派与风险分级', `<div class="ic-form-grid">${field('负责人', 'ic-owner', input('ic-owner', f.owner))}${field('严重程度', 'ic-level', `<select id="ic-level">${Object.entries(service.SEVERITIES).map(([key, s]) => option(key, s.label, f.severity)).join('')}</select>`)}<div class="ic-wide">${field('风险类型', 'ic-type', `<select id="ic-type">${service.listRiskTypes().filter(t => t.enabled && t.status === 'published').map(t => option(t.id, `${t.name} · ${t.version}`, f.riskTypeId)).join('')}</select>`)}</div></div>`, `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${action('保存', `App.icAssignSave(${q(id)})`, 'edit', true)}`);
  },
  icAssignSave(id) { perform(() => service.updateFinding(id, { owner: value('ic-owner'), severity: value('ic-level'), riskTypeId: value('ic-type') }), '分派信息已更新'); },
  icFix(id) {
    const f = service.getFinding(id); if (!f) return;
    const versions = listAssetVersions(f.assetId);
    UI.modal('提交修复', `<div class="ic-stack">${field('修复后的被测版本 *', 'ic-fix-version', `<select id="ic-fix-version">${option('', '请选择已上传版本', '')}${versions.map(a => option(a.version, `${a.version} · ${a.status === 'ready' ? '已连通' : '待连通'}`, f.fixVersion)).join('')}</select>`, '如有新版本，请先到被测资产上传并测试连通。')}${field('修复说明 *', 'ic-fix-notes', textarea('ic-fix-notes', f.fixNotes, 4), '记录策略、提示词、知识或工具权限的变更。')}${note('提交后进入待复测。只有原问题和正常业务回归都通过，才开放验收关闭。')}</div>`, `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${action('提交修复', `App.icFixSave(${q(id)})`, 'submitFix', true)}`);
  },
  icFixSave(id) { perform(() => service.submitFix(id, value('ic-fix-version'), value('ic-fix-notes')), '已提交修复，下一步发起复测'); },
  icDecision(id, status) {
    const accept = status === 'accepted';
    UI.modal(accept ? '接受风险' : '标记为误报', `<div class="ic-stack">${field(accept ? '接受理由 *' : '误报依据 *', 'ic-decision-reason', textarea('ic-decision-reason', '', 4))}${accept ? field('接受范围 *', 'ic-decision-scope', input('ic-decision-scope', '', 'placeholder="适用资产、版本及业务范围"')) + field('接受截止日期 *', 'ic-decision-expiry', input('ic-decision-expiry', '', 'type="date"')) + note('接受风险保留问题与证据，不等同于修复通过。') : ''}</div>`, `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${action('确认', `App.icDecisionSave(${q(id)},${q(status)})`, accept ? 'accept' : 'confirm', true)}`);
  },
  icDecisionSave(id, status) { perform(() => service.transitionFinding(id, status, { reason: value('ic-decision-reason'), scope: value('ic-decision-scope'), expiresAt: value('ic-decision-expiry') }), '处理结论已保存'); },
  icFeedback(assetId = '') {
    const assets = listAssets(); feedbackFiles = [];
    const first = getAsset(assetId) || assets[0];
    UI.modal('提交生产反馈', `<div class="ic-form-grid">
      ${field('关联资产 *', 'ic-fb-asset', `<select id="ic-fb-asset" onchange="App.icFeedbackAsset(this.value)">${assets.map(a => option(a.id, `${kinds[a.kind]} · ${a.name}`, first?.id)).join('')}</select>`)}
      ${field('生产版本', 'ic-fb-version', input('ic-fb-version', first?.version || '', 'placeholder="实际发生问题的版本"'))}
      <div class="ic-wide">${field('反馈标题 *', 'ic-fb-title', input('ic-fb-title', '', 'placeholder="用一句话描述问题" maxlength="80"'))}</div>
      ${field('正常业务目的', 'ic-fb-purpose', textarea('ic-fb-purpose', '', 2))}${field('问题分类', 'ic-fb-category', `<select id="ic-fb-category">${Object.entries(categories).map(([key, label]) => option(key, label, 'other')).join('')}</select>`)}
      <div class="ic-wide">${field('触发输入与上下文', 'ic-fb-input', textarea('ic-fb-input', '', 3), '填写能复现问题的最小输入，可使用脱敏内容。')}</div>
      ${field('实际表现 *', 'ic-fb-actual', textarea('ic-fb-actual', '', 3))}${field('正确预期 *', 'ic-fb-expected', textarea('ic-fb-expected', '', 3))}
      ${field('业务影响', 'ic-fb-impact', input('ic-fb-impact', '', 'placeholder="如咨询无法完成、内部资料披露"'))}${field('提交人 / 负责团队', 'ic-fb-contact', input('ic-fb-contact', '业务运营'))}
      <div class="ic-wide">${field('相关业务规则', 'ic-fb-rule', textarea('ic-fb-rule', '', 2))}</div>
      <div class="ic-wide">${field('补充文件', 'ic-fb-files', '<input id="ic-fb-files" type="file" accept=".txt,.md,.json,.log" multiple onchange="App.icFeedbackFiles(this.files)"><div id="ic-fb-file-summary" class="ic-caption">可添加文本、JSON 或日志，每个文件不超过 1 MB。</div>')}</div>
    </div>`, `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${action('提交反馈', 'App.icFeedbackSave()', 'feedback', true)}`, { wide: true });
  },
  icFeedbackAsset(id) { const a = getAsset(id); const el = document.getElementById('ic-fb-version'); if (a && el) el.value = a.version; },
  async icFeedbackFiles(files) {
    try {
      const selectedFiles = [...files];
      if (selectedFiles.length > 5) throw new Error('最多添加 5 个补充文件');
      const attachments = [];
      for (const file of selectedFiles) {
        if (!/\.(txt|md|json|log)$/i.test(file.name)) throw new Error('仅支持文本、Markdown、JSON 或日志文件');
        if (file.size > 1024 * 1024) throw new Error(`${file.name} 超过 1 MB`);
        attachments.push({ name: file.name, size: file.size, content: await file.text() });
      }
      feedbackFiles = attachments;
      const summary = document.getElementById('ic-fb-file-summary'); if (summary) summary.textContent = attachments.length ? `已读取：${attachments.map(a => a.name).join('、')}` : '未添加文件';
    } catch (error) { feedbackFiles = []; const el = document.getElementById('ic-fb-files'); if (el) el.value = ''; UI.toast(error.message); }
  },
  icFeedbackSave() {
    const asset = getAsset(value('ic-fb-asset'));
    try {
      if (!asset) throw new Error('请先接入一个被测资产');
      if (!value('ic-fb-title')) throw new Error('请填写反馈标题');
      const f = service.createFeedback({ assetId: asset.id, assetName: asset.name, assetKind: asset.kind, productionVersion: value('ic-fb-version'), title: value('ic-fb-title'), purpose: value('ic-fb-purpose'), input: value('ic-fb-input'), actual: value('ic-fb-actual'), expected: value('ic-fb-expected'), category: value('ic-fb-category'), impact: value('ic-fb-impact'), contact: value('ic-fb-contact'), rule: value('ic-fb-rule'), attachments: feedbackFiles });
      UI.closeModal(); router.nav('risk', 'feedback-detail', f.id); UI.toast('反馈已提交，可继续整理复现用例');
    } catch (error) { UI.toast(error.message); }
  },
  icAttachment(id, index) { const a = service.getFeedback(id)?.attachments[index]; if (a) UI.drawer(a.name, `<pre class="ic-evidence">${esc(a.content)}</pre>`, UI.btn('关闭', { onclick: 'UI.closeDrawer()' })); },
  icPrepare(id) {
    const f = service.getFeedback(id); if (!f) return;
    const c = f.candidate || { title: f.title, input: f.input || f.purpose, expected: f.expected, rule: f.rule, group: ['refusal', 'task_failure'].includes(f.category) ? 'normal' : 'attack' };
    UI.modal('整理复现用例', `${note('保留原始反馈，在这里编辑可重复验证的最小输入与通过条件。')}<div class="ic-form-grid"><div class="ic-wide">${field('用例名称 *', 'ic-case-title', input('ic-case-title', c.title))}</div><div class="ic-wide">${field('复现输入 *', 'ic-case-input', textarea('ic-case-input', c.input, 3))}</div><div class="ic-wide">${field('通过条件 *', 'ic-case-expected', textarea('ic-case-expected', c.expected, 3))}</div>${field('业务规则', 'ic-case-rule', textarea('ic-case-rule', c.rule, 2))}${field('用例分组', 'ic-case-group', `<select id="ic-case-group">${option('normal', '正常对照', c.group)}${option('attack', '攻击用例', c.group)}${option('boundary', '边界用例', c.group)}</select>`)}</div>${f.bankId ? note('该反馈已经加入回归集。修改后的内容需到关联题库中审阅维护，不覆盖已发布版本。') : ''}`, `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${action('保存用例草稿', `App.icPrepareSave(${q(id)})`, 'edit', true)}`, { wide: true });
  },
  icPrepareSave(id) {
    if (!value('ic-case-title') || !value('ic-case-input') || !value('ic-case-expected')) return UI.toast('请填写名称、复现输入和通过条件');
    perform(() => service.prepareFeedbackCase(id, { title: value('ic-case-title'), input: value('ic-case-input'), expected: value('ic-case-expected'), rule: value('ic-case-rule'), group: value('ic-case-group') }), '用例草稿已保存');
  },
  icAddCase(id) {
    perform(() => {
      if (!service.can('edit')) throw new Error('当前角色不能编辑回归题库');
      const f = service.getFeedback(id); if (!f?.candidate) throw new Error('请先整理复现用例');
      const result = addFeedbackCase({ ...f, ...f.candidate, id: f.id });
      return service.linkFeedbackCase(id, result);
    }, '用例已加入回归题库草稿，请审阅后发布');
  },
  icValidateFeedback(id) {
    const f = service.getFeedback(id); const bank = getResource(f?.bankId);
    if (!service.can('retest')) return UI.toast('当前角色不能发起复测');
    if (bank?.status !== 'published') return UI.toast('请先发布回归题库');
    const strategies = regressionStrategies(f.bankId, f.assetKind);
    const versions = listAssetVersions(f.assetId).filter(a => a.status === 'ready');
    const tasks = completedTasks(f.assetId, f.assetKind).filter(t => t.configSnapshot?.banks?.some(b => bank.versions.some(v => v.catalogId === b.bankId)));
    UI.modal('回归验证', `<div class="ic-stack">${note('用已发布回归题库准备策略，再选择资产版本发起演练。完成后关联结果，保留回流链路。')}${strategies.length ? field('演练策略', 'ic-feedback-strategy', `<select id="ic-feedback-strategy">${strategies.map(s => option(s.id, s.name, '')).join('')}</select>`) : action('准备回归策略草稿', `App.icPrepareStrategy(${q(id)})`, 'edit')}${field('被测版本', 'ic-feedback-version', `<select id="ic-feedback-version">${versions.map(a => option(a.version, a.version, '')).join('')}</select>`)}${action('发起回归演练', `App.icStartFeedback(${q(id)})`, 'retest')}${field('关联已完成任务', 'ic-feedback-task', `<select id="ic-feedback-task">${option('', tasks.length ? '请选择任务' : '暂无引用回归题库的已完成任务', '')}${tasks.map(t => option(t.id, t.name, '')).join('')}</select>`)}</div>`, UI.btn('取消', { onclick: 'UI.closeModal()' }) + action('关联回归结果', `App.icLinkTask(${q(id)})`, 'retest', true));
  },
  icPrepareStrategy(id) { try { const f = service.getFeedback(id), strategyId = createRegressionStrategy(f); UI.closeModal(); router.nav('strategy', f.assetKind === 'agent' ? 'ag-strategy' : 'attack'); if (f.assetKind === 'agent') globalThis.App.editAgStrategy(strategyId); else globalThis.App.editStrategy(strategyId); UI.toast('已带入回归题库，请核对并发布策略'); } catch (error) { UI.toast(error.message); } },
  icStartFeedback(id) { const f = service.getFeedback(id), strategyId = value('ic-feedback-strategy'), version = value('ic-feedback-version'); if (!service.can('retest')) return UI.toast('当前角色不能发起复测'); if (!version || !regressionStrategies(f.bankId, f.assetKind).some(s => s.id === strategyId)) return UI.toast('请先发布引用回归题库的策略，并选择连通版本'); UI.closeModal(); openTaskWizard(f.assetKind, { targetId: `${f.assetId}@${version}`, strategyId, name: `回归 · ${f.title} · ${Date.now().toString(36).slice(-4)}`, description: `生产反馈 ${f.id}；完成后回到此反馈关联结果。` }); },
  icLinkTask(id) { perform(() => recordFeedbackTask(id, value('ic-feedback-task')), '回归任务已关联，后续在问题中完成修复验收'); },
  icFeedbackIssue(id) {
    const f = service.getFeedback(id); if (!f) return;
    const matching = service.listFindings().filter(item => item.assetId === f.assetId && !['closed', 'false_positive'].includes(item.status));
    UI.modal('关联整改问题', `<div class="ic-stack">${field('处理方式', 'ic-fb-finding', `<select id="ic-fb-finding">${option('', '创建新的整改问题', '')}${matching.map(item => option(item.id, item.title, '')).join('')}</select>`)}${field('负责人（新建时）', 'ic-fb-owner', input('ic-fb-owner', '应用研发'))}${field('严重程度（新建时）', 'ic-fb-level', `<select id="ic-fb-level">${Object.entries(service.SEVERITIES).map(([key, s]) => option(key, s.label, 'medium')).join('')}</select>`)}</div>`, `${UI.btn('取消', { onclick: 'UI.closeModal()' })}${action('确认关联', `App.icFeedbackIssueSave(${q(id)})`, 'edit', true)}`);
  },
  icFeedbackIssueSave(id) {
    perform(() => {
      const f = service.getFeedback(id); let findingId = value('ic-fb-finding');
      if (!findingId) findingId = service.createFinding({ title: f.title, assetId: f.assetId, assetName: f.assetName, assetKind: f.assetKind, targetVersion: f.productionVersion, source: 'production', feedbackId: id, owner: value('ic-fb-owner'), severity: value('ic-fb-level'), riskTypeId: f.category === 'refusal' ? 'risk-type-refusal' : f.category === 'leakage' ? 'risk-type-leakage' : 'risk-type-promise', ruleName: categories[f.category] || '业务预期', description: f.impact || f.purpose, evidence: `输入：${f.input}\n实际：${f.actual}\n预期：${f.expected}` }).id;
      return service.linkFeedbackFinding(id, findingId);
    }, '已关联整改问题');
  },
  icRiskEdit(id = '') { riskForm(id); },
  icTrigger(trigger) { const el = document.getElementById('ic-risk-threshold'); if (el) el.disabled = trigger === 'single'; },
  icRiskSave(id, publish) { perform(() => service.saveRiskType({ id, name: value('ic-risk-name'), description: value('ic-risk-description'), severity: value('ic-risk-severity'), trigger: value('ic-risk-trigger'), threshold: value('ic-risk-threshold'), ruleId: value('ic-risk-rule'), ruleText: value('ic-risk-rule-text'), scope: value('ic-risk-scope'), owner: value('ic-risk-owner'), change: value('ic-risk-change') }, { publish }), publish ? '风险配置已发布为新版本' : '草稿已保存，已发布内容保持原版本'); },
  icRiskToggle(id) { perform(() => service.toggleRiskType(id), '使用状态已更新'); },
  icRiskHistory(id) {
    const t = service.getRiskType(id); if (!t) return;
    UI.drawer(`${t.name} · 版本记录`, `${t.draft ? note(`待发布草稿：${esc(t.draft.change)}<br>严重程度 ${esc(service.SEVERITIES[t.draft.severity]?.label)} · 负责人 ${esc(t.draft.owner)}`) : ''}${t.versions.length ? t.versions.slice().reverse().map(v => UI.card(`${v.version} · ${v.at}`, UI.kvTable([['变更', esc(v.change)], ['名称', esc(v.snapshot.name)], ['严重程度', esc(service.SEVERITIES[v.snapshot.severity]?.label)], ['触发', v.snapshot.trigger === 'single' ? '单次违规' : `违规率 > ${v.snapshot.threshold}%`], ['规则', esc(v.snapshot.ruleId)], ['负责人', esc(v.snapshot.owner)]]))).join('') : note('尚未发布，保存草稿后可继续编辑。')}`, UI.btn('关闭', { onclick: 'UI.closeDrawer()' }));
  },
  icRole(role) { perform(() => service.setCurrentRole(role), `已切换为${service.ROLES[role]?.name || '所选角色'}`); },
};
