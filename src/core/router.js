/* 路由：唯一的路由表。一个页面一条记录，没有覆盖、没有包装。 */
import { SIDE_NAV, SUB_PARENT } from '../domain/constants.js';

const routes = new Map();
/* 无侧栏栏目的默认子页 */
const DEFAULT_SUB = { risk: 'events' };
let current = { page: 'posture', sub: 'home', param: null };

export function register(page, sub, render) {
  routes.set(`${page}/${sub}`, render);
}

export function resolve(page, sub) {
  const key = `${page}/${sub}`;
  if (routes.has(key)) return routes.get(key);
  const side = SIDE_NAV[page];
  if (side && side.length) return routes.get(`${page}/${side[0].id}`) || null;
  return null;
}

export function state() {
  return current;
}

/* 浏览历史：每次换到不同路由时把上一页压栈；同一路由的重绘（筛选、翻页）不压栈。
 * 返回键只做一件事：回到上一步所在的页面。 */
const stack = [];
const keyOf = (r) => `${r.page}/${r.sub}/${r.param || ''}`;

export function nav(page, sub = null, param = null, { replace = false } = {}) {
  const side = SIDE_NAV[page];
  const target = sub || (side && side.length ? side[0].id : DEFAULT_SUB[page] || 'home');
  const next = { page, sub: target, param };
  if (!replace && keyOf(next) !== keyOf(current)) {
    stack.push(current);
    if (stack.length > 50) stack.shift();
  }
  current = next;
  render();
}

/* 直接打开详情链接时没有历史，退回所属列表页 */
export function back() {
  const prev = stack.pop();
  if (prev) return nav(prev.page, prev.sub, prev.param, { replace: true });
  const parent = SUB_PARENT[current.sub];
  nav(current.page, parent || null, null, { replace: true });
}

let renderFn = null;
export function setRenderer(fn) {
  renderFn = fn;
}

function render() {
  if (renderFn) renderFn();
}

/* hash 支持三段：#/page/sub/id
 * 详情类页面用 sub 带 /detail 后缀，id 放第三段。 */
export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw) return { page: 'posture', sub: 'home', param: null };
  const parts = raw.split('/').filter(Boolean);
  const page = parts[0] || 'posture';
  const sub = parts[1] || null;
  const param = parts[2] || null;
  return { page, sub, param };
}

export function pushHash(page, sub, param) {
  const h = `#/${page}/${sub}${param ? '/' + param : ''}`;
  if (location.hash !== h) history.replaceState(null, '', h);
}
