import * as UI from '../core/ui.js';
import * as router from '../core/router.js';
import { getPlatformConnection } from '../domain/asset-intake.js';
import * as Connection from '../domain/platform-connection.js';

const e = UI.esc;
const ROUTES = ['connection-create', 'connection-edit'];
const field = (title, body) => `<label class="field"><span>${e(title)}</span>${body}</label>`;
const input = (key, value, extra = '') => `<input id="pc-${key}" value="${e(value ?? '')}" oninput="App.pcField('${key}',this.value)" ${extra}>`;
let editor = null, pendingNavigation = null;

function createEditor(existing, options = {}) {
  return {form:Connection.newConnectionDraft(existing), testResult:null, testing:false, saving:false, dirty:false, error:'', ...options};
}
function releaseEditor(current = editor) {
  if (!current) return;
  current.form.credential = '';
  current.closeObserver?.disconnect();
  if (editor === current) {
    const secret = document.getElementById('pc-credential');
    if (secret) secret.value = '';
    editor = null;
  }
}
function cancelDrawer(current = editor, { close = true } = {}) {
  if (!current || editor !== current) return;
  releaseEditor(current);
  if (close) UI.closeDrawer();
  current.onCancel?.();
}
function form() {
  const c = editor.form;
  return `<div class="ai-form pc-simple-form">
    ${field('平台名称 *', input('name', c.name, 'placeholder="请输入平台名称" maxlength="100"'))}
    ${field('API 地址 *', input('baseUrl', c.baseUrl, 'type="url" placeholder="https://assets.company.cn/api/assets"'))}
    ${field('密钥', input('credential', '', `type="password" autocomplete="new-password" placeholder="${c.credentialConfigured?'已配置，留空保留':'选填'}"`))}
    <p id="pc-result" class="ai-help" role="status">${editor.testResult?UI.badge('已连通')+'（演示）':''}</p>
    <p id="pc-error" class="ai-error" role="alert">${e(editor.error)}</p>
  </div>`;
}
function footer() {
  return UI.btn('取消',{onclick:'App.pcCancel()',disabled:editor.saving})+
    UI.btn(editor.testing?'测试中…':'测试连通',{onclick:'App.pcTest()',disabled:editor.testing||editor.saving})+
    UI.btn(editor.saving?'保存中…':'保存连接',{kind:'primary',onclick:'App.pcSave()',disabled:editor.testing||editor.saving});
}
function renderDrawer() {
  if (!editor) return;
  UI.drawer(editor.form.id?'编辑平台连接':'连接资产平台',form(),footer());
  document.querySelector('#drawer .drawer')?.classList.add('pc-connection-drawer');
  document.querySelector('#drawer .modal-head .icon-btn')?.setAttribute('onclick','App.pcCancel()');
  // A typed secret belongs only to this editor, never an HTML attribute.
  const secret = document.getElementById('pc-credential');
  if (secret) secret.value = editor.form.credential;
  if (!editor.closeObserver) {
    const current = editor, host = document.getElementById('drawer');
    const Observer = document.defaultView?.MutationObserver;
    if (Observer) {
      current.closeObserver = new Observer(() => {
        if (!host.classList.contains('open') || !host.querySelector('.pc-simple-form')) cancelDrawer(current, { close: false });
      });
      current.closeObserver.observe(host,{attributes:true,attributeFilter:['class'],childList:true});
    }
  }
}
function refresh() {
  if (!editor) return;
  if (editor.drawer) renderDrawer();
  else {
    const cur = router.state();
    router.nav(cur.page, cur.sub, cur.param, {replace:true});
    const secret = document.getElementById('pc-credential');
    if (secret) secret.value = editor.form.credential;
  }
}
function showError(error) { if (editor) { editor.error = error.message || String(error); refresh(); } }

export function openPlatformConnection(id, {onSaved, onCancel} = {}) {
  const existing = id ? getPlatformConnection(id) : {};
  if (!existing) return UI.toast('平台连接不存在');
  UI.closeModal();
  releaseEditor();
  editor = createEditor(existing, {drawer:true, onSaved, onCancel});
  renderDrawer();
}

export function platformConnectionPage(cur = router.state()) {
  const routeKey = `${cur.sub}/${cur.param || ''}`;
  if (editor?.routeKey !== routeKey) {
    const existing = cur.sub === 'connection-edit' ? getPlatformConnection(cur.param) : {};
    if (!existing) return UI.pageHead('平台连接不存在')+'<div class="empty">连接已删除或链接无效。</div>';
    releaseEditor(); editor = createEditor(existing, {routeKey});
  }
  return `<div class="pc-page">${UI.pageHead(editor.form.id?'编辑平台连接':'连接资产平台',{back:UI.backBtn().replace('App.back()', 'App.pcCancel()')})}<section class="pc-workspace"><div class="ai-wizard-content">${form()}</div><footer class="pc-footer"><div></div><div>${footer()}</div></footer></section></div>`;
}

router.beforeNavigate(transition => {
  if (!ROUTES.includes(transition.from.sub) || !editor || editor.drawer) return;
  if (!editor.dirty) { releaseEditor(); return; }
  pendingNavigation = transition;
  UI.modal('连接信息尚未保存','<p>离开将放弃本次修改。</p>',UI.btn('继续编辑',{onclick:'App.pcStay()'})+UI.btn('放弃修改并离开',{onclick:'App.pcDiscard()'}));
  return false;
});

export const actions = {
  pcField(key, value) {
    if (!editor || !['name','baseUrl','credential'].includes(key)) return;
    editor.form[key] = value;
    editor.dirty = true; editor.error = ''; editor.testResult = null;
    const error = document.getElementById('pc-error'); if (error) error.textContent = '';
    const result = document.getElementById('pc-result'); if (result) result.textContent = '';
  },
  async pcTest() {
    if (!editor || editor.testing || editor.saving) return;
    const current = editor;
    current.testing = true; current.error = ''; refresh();
    try { current.testResult = await Connection.testConnection(current.form); }
    catch (error) { current.error = error.message; current.testResult = null; }
    finally { current.testing = false; if (editor === current) refresh(); }
  },
  async pcSave() {
    if (!editor || editor.testing || editor.saving) return;
    const current = editor;
    current.saving = true; current.error = ''; refresh();
    try {
      current.testResult = await Connection.testConnection(current.form);
      if (editor !== current) return;
      const saved = Connection.saveConnection(current.form);
      current.dirty = false;
      releaseEditor(current);
      if (current.drawer) UI.closeDrawer();
      router.nav('platform','intake');
      current.onSaved?.(saved);
      UI.toast('平台连接已保存');
    } catch (error) { if (editor === current) showError(error); }
    finally { current.saving = false; if (editor === current) refresh(); }
  },
  pcCancel() {
    if (editor?.drawer) cancelDrawer();
    else router.nav('platform','intake');
  },
  pcStay() { pendingNavigation = null; UI.closeModal(); },
  pcDiscard() { const transition = pendingNavigation; pendingNavigation = null; releaseEditor(); UI.closeModal(); transition?.proceed(); },
};
