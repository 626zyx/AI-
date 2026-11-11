/* 应用外壳：顶栏（品牌 + 主导航 + 三个图标）+ 侧栏 + 主内容区。
 * 页面只返回内容 HTML，不碰外壳。 */
import { icon } from './icons.js';
import { esc } from './ui.js';
import { NAV, SIDE_NAV, SUB_PARENT, EXTRA_PAGES } from '../domain/constants.js';
import * as router from './router.js';

let shellEl = null;
let headerEl = null;
let sidebarEl = null;
let mainEl = null;

export function mount() {
  shellEl = document.getElementById('app');
  headerEl = document.getElementById('app-header');
  sidebarEl = document.getElementById('app-sidebar');
  mainEl = document.getElementById('app-main');
}

function renderHeader(cur) {
  const nav = NAV.map(
    (n) =>
      `<button class="${cur.page === n.id ? 'active' : ''}" onclick="Shell.go('${n.id}')">${esc(n.label)}</button>`,
  ).join('');
  headerEl.innerHTML = `
    <button class="brand" onclick="Shell.go('posture')">AI安全演练平台</button>
    <nav class="top-nav" aria-label="平台主导航">${nav}</nav>
    <div class="header-actions">
      <button class="icon-btn" title="消息提醒" aria-label="消息提醒" onclick="Shell.notify()">${icon('bell', 18)}</button>
      <button class="icon-btn" title="平台设置" aria-label="平台设置" onclick="Shell.settings()">${icon('settings', 18)}</button>
      <button class="icon-btn" title="账户" aria-label="账户" onclick="Shell.account()">${icon('user', 18)}</button>
    </div>`;
}

function renderSidebar(cur) {
  const items = SIDE_NAV[cur.page] || [];
  if (!items.length) {
    sidebarEl.innerHTML = '';
    shellEl.classList.add('side-collapsed');
    return;
  }
  shellEl.classList.remove('side-collapsed');
  const activeId = SUB_PARENT[cur.sub] || cur.sub;
  const nav = items
    .map(
      (i) => `<button class="${activeId === i.id ? 'active' : ''} ${i.child ? 'child' : ''}" onclick="Shell.go('${cur.page}','${i.id}')">
        ${i.child ? '' : icon(i.icon, 16)}${esc(i.label)}</button>`,
    )
    .join('');
  sidebarEl.innerHTML = `<div class="side-title">${esc(NAV.find((n) => n.id === cur.page)?.label || EXTRA_PAGES[cur.page] || '')}</div>
    <nav class="side-nav" aria-label="当前栏目导航">${nav}</nav>`;
}

/* 重绘会重建整棵 DOM。列表筛选靠 oninput 触发重绘，
 * 所以重绘前后要把焦点和光标位置还原，否则搜索框每敲一个字就失焦。 */
function captureFocus() {
  const el = document.activeElement;
  if (!el || !el.id || !mainEl.contains(el)) return null;
  const isField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  return { id: el.id, start: isField ? el.selectionStart : null, end: isField ? el.selectionEnd : null };
}

function restoreFocus(snap) {
  if (!snap) return;
  const el = document.getElementById(snap.id);
  if (!el) return;
  el.focus();
  if (snap.start !== null && typeof el.setSelectionRange === 'function') {
    try {
      el.setSelectionRange(snap.start, snap.end);
    } catch {
      /* 部分 input 类型不支持选区，忽略 */
    }
  }
}

let lastKey = null;

export function render(cur) {
  const key = `${cur.page}/${cur.sub}/${cur.param || ''}`;
  /* 同一条路由的重绘（筛选、切标签）保留焦点与滚动位置；换页则从头开始。 */
  const samePage = key === lastKey;
  const snap = samePage ? captureFocus() : null;
  const scroll = samePage ? mainEl.scrollTop : 0;
  lastKey = key;
  renderHeader(cur);
  renderSidebar(cur);
  /* 切页即收起所有覆盖层：弹窗/抽屉属于上一个页面的上下文 */
  document.querySelectorAll('.overlay.open').forEach((el) => el.classList.remove('open'));
  const fn = router.resolve(cur.page, cur.sub);
  mainEl.innerHTML = `<div class="page">${fn ? fn(cur) : ''}</div>`;
  mainEl.scrollTop = scroll;
  restoreFocus(snap);
  router.pushHash(cur.page, cur.sub, cur.param);
}

/* 供 onclick 调用的全局入口 */
export const api = {
  go(page, sub = null, param = null) {
    router.nav(page, sub, param);
  },
  notify() {
    import('./ui.js').then((ui) => ui.toast('暂无新消息'));
  },
  settings() {
    router.nav('platform', 'roles');
  },
  account() {
    import('./ui.js').then((ui) =>
      ui.modal(
        '账户',
        `<table class="kv"><tbody>
           <tr><th>当前账号</th><td>安全运营</td></tr>
           <tr><th>权限</th><td>演练任务、策略、资产、风险全部可读</td></tr>
         </tbody></table>`,
        `${ui.btn('关闭', { onclick: "UI.closeModal()" })}
         ${ui.btn('退出登录', { kind: 'danger', onclick: "UI.closeModal();UI.toast('demo 不支持真实退出登录')" })}`,
      ),
    );
  },
};
