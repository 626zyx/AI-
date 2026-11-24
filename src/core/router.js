/* 路由：唯一的路由表。一个页面一条记录，没有覆盖、没有包装。 */
import { SIDE_NAV, SUB_PARENT } from '../domain/constants.js';

const routes = new Map();
/* 无侧栏栏目的默认子页 */
const DEFAULT_SUB = { assets: 'intake', exercise: 'tasks', agent: 'ag-tasks', strategy: 'attack', platform: 'intake' };
let current = { page: 'home', sub: 'home', param: null };

export function register(page, sub, render) {
  routes.set(`${page}/${sub}`, render);
}

export function resolve(page, sub) {
  const key = `${page}/${sub}`;
  if (routes.has(key)) return routes.get(key);
  const side = SIDE_NAV[page];
  if (side && side.length) return routes.get(`${page}/${DEFAULT_SUB[page] || side.find(i => !i.heading)?.id}`) || null;
  return null;
}

export function state() {
  return current;
}

/* 浏览历史：每次换到不同路由时把上一页压栈；同一路由的重绘（筛选、翻页）不压栈。
 * 返回键只做一件事：回到上一步所在的页面。 */
const stack = [];
const keyOf = (r) => `${r.page}/${r.sub}/${r.param || ''}`;
const navigationGuards = new Set();

/* Guards may defer a route change and later resume that exact destination once.
 * History and rendering are updated only after the transition is accepted. */
export function beforeNavigate(guard) {
  navigationGuards.add(guard);
  return () => navigationGuards.delete(guard);
}

function navigate(next, options = {}, consumeHistory = false) {
  const from = current;
  let committed = false;
  const proceed = () => {
    if (committed || keyOf(current) !== keyOf(from)) return false;
    committed = true;
    if (consumeHistory) stack.pop();
    else if (!options.replace && keyOf(next) !== keyOf(current)) {
      stack.push(current);
      if (stack.length > 50) stack.shift();
    }
    current = next;
    options.onCommit?.();
    render();
    return true;
  };
  if (keyOf(next) !== keyOf(from)) {
    const transition = { from: { ...from }, to: { ...next }, options, proceed };
    for (const guard of navigationGuards) {
      if (guard(transition) === false) {
        // Hash navigation already changed the address; keep it aligned with the visible form.
        if (!committed && typeof location !== 'undefined' && typeof history !== 'undefined') pushHash(from.page, from.sub, from.param);
        return committed;
      }
    }
  }
  return proceed();
}

export function nav(page, sub = null, param = null, options = {}) {
  if (page === 'assets' || page === 'posture') { page = 'platform'; sub = 'intake'; param = null; }
  const side = SIDE_NAV[page];
  const target = sub || DEFAULT_SUB[page] || side?.find(i => !i.heading)?.id || 'home';
  const next = { page, sub: target, param };
  return navigate(next, options);
}

/* 直接打开详情链接时没有历史，退回所属列表页 */
export function back() {
  const prev = stack.at(-1);
  if (prev) return navigate(prev, { replace: true }, true);
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
  if (!raw) return { page: 'home', sub: 'home', param: null };
  const parts = raw.split('/').filter(Boolean);
  const page = parts[0] || 'home';
  const sub = parts[1] || null;
  const param = parts[2] || null;
  return { page, sub, param };
}

export function pushHash(page, sub, param) {
  const h = `#/${page}/${sub}${param ? '/' + param : ''}`;
  if (location.hash !== h) history.replaceState(null, '', h);
}
