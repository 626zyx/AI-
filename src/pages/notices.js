/* 消息通知：右上角铃铛打开的右侧抽屉。消息由 store.notifications() 从任务与风险事件生成。
 * 已读状态只存在内存里；铃铛角标 = 未读条数。 */
import * as UI from '../core/ui.js';
import * as store from '../domain/store.js';

const TYPE = {
  all: '全部',
  start: '任务开始',
  done: '任务完成',
  report: '报告生成',
  risk: '风险事件',
};
const view = { type: 'all' };
const read = new Set();
const keyOf = (n) => `${n.type}|${n.at}|${n.title}`;

export function unreadCount() {
  return store.notifications().filter((n) => !read.has(keyOf(n))).length;
}

function body() {
  const all = store.notifications();
  const list = view.type === 'all' ? all : all.filter((n) => n.type === view.type);
  const tabs = Object.entries(TYPE).map(([k, l]) => {
    const n = k === 'all' ? all.length : all.filter((x) => x.type === k).length;
    return `<button class="${view.type === k ? 'active' : ''}" onclick="App.ntType('${k}')">${l}<span class="num">${n}</span></button>`;
  }).join('');
  let day = '';
  const rows = list.map((n) => {
    const d = n.at.slice(0, 10);
    const head = d !== day ? `<div class="nt-day num">${(day = d)}</div>` : '';
    const unread = !read.has(keyOf(n));
    return `${head}<button class="nt-item ${n.type}${n.riskKey ? ` ${n.riskKey}` : ''}${unread ? ' unread' : ''}" onclick="UI.closeDrawer();${n.go}">
      <span class="nt-ico"></span>
      <span class="nt-main"><b>${UI.esc(n.title)}</b><span>${UI.esc(TYPE[n.type])} · ${UI.esc(n.meta)}</span></span>
      <span class="nt-at num">${UI.esc(n.at.slice(11, 16))}</span>
    </button>`;
  }).join('') || '<div class="empty"><strong>暂无消息</strong></div>';
  return `<div class="seg nt-tabs">${tabs}</div><div class="nt-list">${rows}</div>`;
}

function refreshBadge() {
  const n = unreadCount();
  const b = document.querySelector('.bell-badge');
  if (b) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; }
}

export const actions = {
  ntUnread: unreadCount,
  openNotices() {
    view.type = 'all';
    UI.drawer('消息通知', body(), `${UI.btn('全部标为已读', { onclick: 'App.ntReadAll()' })}${UI.btn('关闭', { onclick: 'UI.closeDrawer()' })}`);
  },
  ntType(k) {
    view.type = k;
    const el = document.querySelector('#drawer .modal-body');
    if (el) el.innerHTML = body();
  },
  ntReadAll() {
    store.notifications().forEach((n) => read.add(keyOf(n)));
    const el = document.querySelector('#drawer .modal-body');
    if (el) el.innerHTML = body();
    refreshBadge();
    UI.toast('已全部标为已读');
  },
};
