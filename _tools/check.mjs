/* 渲染检查：jsdom 提供 DOM，Node 原生 ESM 载入真实模块，遍历所有路由。
 * 跑法：node _tools/check.mjs
 */
import { JSDOM } from 'file:///sessions/elegant-epic-sagan/mnt/AI%E5%AE%89%E5%85%A8%E5%B9%B3%E5%8F%B0demo/node_modules/jsdom/lib/api.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  runScripts: 'dangerously',
});

const errors = [];
const g = globalThis;
const def = (k, v) => Object.defineProperty(g, k, { value: v, configurable: true, writable: true });
def('window', dom.window);
for (const k of ['document', 'location', 'history', 'HTMLElement', 'Node', 'Event', 'CustomEvent', 'getComputedStyle']) {
  def(k, dom.window[k]);
}
def('navigator', dom.window.navigator);
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

const origErr = console.error;
console.error = (...a) => errors.push(a.map(String).join(' '));

await import(pathToFileURL(path.join(ROOT, 'src/main.js')).href);

const routes = [
  ['posture', 'home'],
  ['exercise', 'tasks'],
  ['exercise', 'task-detail', 'task-tgt-deepseek-chat'],
  ['exercise', 'drafts'],
  ['exercise', 'results'],
  ['exercise', 'reports'],
  ['exercise', 'report-detail', 'task-tgt-qwen-flash'],
  ['strategy', 'attack'],
  ['strategy', 'methods'],
  ['strategy', 'banks'],
  ['strategy', 'guard'],
  ['exercise', 'compare', 'task-tgt-qwen-flash~task-tgt-deepseek-chat'],
  ['assets', 'models'],
  ['risk', 'events'], ['platform', 'roles'], ['platform', 'riskrule'],
];

const rows = [];
for (const [page, sub, param] of routes) {
  try {
    dom.window.App.go(page, sub, param);
    const main = document.getElementById('app-main');
    const h1 = main.querySelector('.page-heading h1');
    rows.push({
      route: `${page}/${sub}`,
      title: (h1?.textContent || '(无标题)').trim().slice(0, 26),
      chars: (main.textContent || '').length,
      cards: main.querySelectorAll('.card').length,
      tables: main.querySelectorAll('table').length,
      buttons: main.querySelectorAll('button').length,
      empty: main.querySelectorAll('.empty').length,
      side: document.querySelectorAll('.side-nav button').length,
    });
  } catch (e) {
    rows.push({ route: `${page}/${sub}`, title: 'ERROR: ' + e.message });
  }
}

console.log = origErr;
origErr('');
origErr('route'.padEnd(30), 'title'.padEnd(28), 'chars', 'cards', 'tables', 'btns', 'empty', 'side');
for (const r of rows) {
  origErr(
    String(r.route).padEnd(30),
    String(r.title ?? '').padEnd(28),
    String(r.chars ?? '').padStart(5),
    String(r.cards ?? '').padStart(5),
    String(r.tables ?? '').padStart(6),
    String(r.buttons ?? '').padStart(4),
    String(r.empty ?? '').padStart(5),
    String(r.side ?? '').padStart(4),
  );
}
origErr(errors.length ? '\n--- 错误 ---\n' + [...new Set(errors)].slice(0, 15).join('\n') : '\n无错误');

/* ---------------- 交互检查：0.2 修改项 ---------------- */
const A = dom.window.App, $ = (s) => document.querySelector(s);
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const UI_close = () => dom.window.UI.closeModal();
const fire = (el, type) => el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));

// 筛选器真实生效：通过 DOM 的 onchange 属性触发
A.go('exercise', 'tasks');
let sel = $('#tk-target'); sel.value = 'tgt-qwen-flash'; fire(sel, 'change');
ok(document.querySelectorAll('#app-main tbody tr').length === 2, '任务列表靶标筛选未生效');
sel = $('#tk-target'); sel.value = 'all'; fire(sel, 'change');
sel = $('#tk-type'); sel.value = 'agent'; fire(sel, 'change');
ok($('#app-main .empty-cell'), '靶标类型筛选未生效');
sel = $('#tk-type'); sel.value = 'all'; fire(sel, 'change');
// 更多 = 下拉
A.go('exercise', 'tasks');
$('.dd .link-btn').click();
ok(!$('.dd-menu').hidden && !$('#modal').classList.contains('open'), '更多应为下拉而非弹窗');
// 复测打开单页弹窗并带入配置
A.retest('task-tgt-qwen-flash');
ok($('#modal h2').textContent === '新建模型演练' && $('#wiz-target').value === 'mdl-qwen-flash' && $('#wiz-judge').value, '复测未带入配置');
ok($('.sd') && $('.sd').textContent.includes('前20 题'), '策略详情缺失');
// 取消 → 继续编辑 回到弹窗且内容保留
A.wizField('name', '草稿X'); A.wizCancel(); A.wizBack();
ok($('#wiz-name')?.value === '草稿X', '继续编辑未回到任务弹窗');
A.wizSaveDraft();
ok(document.querySelector('#app-main tbody').textContent.includes('草稿X'), '弹窗内保存草稿失败');
// 结果按 ASR 降序
A.go('exercise', 'results');
ok(document.querySelector('#app-main tbody tr td').textContent.includes('Qwen'), '演练结果未按 ASR 降序');
A.compareOpen('task-tgt-qwen-flash'); A.comparePick('task-tgt-deepseek-chat'); A.compareGo();
ok($('.cmp') && document.querySelectorAll('.cmp .cmp-tbl').length === 3 && !$('.cmp').textContent.includes('pp'), '结果对比页结构不对');
// 详情页
A.go('exercise', 'task-detail', 'task-tgt-deepseek-chat');
const txt = $('#app-main').textContent;
ok(txt.includes('演练类型') && !txt.includes('裁判口径') && !txt.includes('有效判定') && txt.includes('PAIR（最大迭代轮数：5；攻击生成模型：DeepSeek-V3-Chat）'), '任务详情配置不对');
ok(txt.includes('待判定') && txt.includes('异常'), '演练结果缺四态');
// 题库分页
A.openBank('bank-advbench');
ok(document.querySelectorAll('#drawer table.grid tbody tr').length === 15, '题库详情未分页 15 条');
sel = $('#bd-scene'); sel.value = 'cyber-abuse'; fire(sel, 'change');
ok([...document.querySelectorAll('#drawer table.grid tbody tr')].every((r) => r.textContent.includes('网络攻击')), '题库场景筛选未生效');
// 0.3
A.retest('task-tgt-qwen-flash'); A.wizFinish();
ok($('#modal').classList.contains('open') && $('#toast').textContent.includes('重复'), '复测重名未拦截');
UI_close();
A.go('exercise', 'tasks'); A.openTask('task-tgt-qwen-flash'); A.back();
ok(dom.window.location.hash === '#/exercise/tasks', '返回未回到上一页');
A.go('exercise', 'results'); A.openTask('task-tgt-qwen-flash'); A.back();
ok(dom.window.location.hash === '#/exercise/results', '从结果进入详情后返回未回结果页');
ok(!$('#app-main').textContent.includes('任务编号'), '');
A.go('exercise', 'report-detail', 'task-tgt-deepseek-chat'); A.rpTab('analysis');
let tx = $('#app-main').textContent;
ok(tx.includes('1. 整体攻击成功率') && tx.includes('下一步建议') && $('.radar') && document.querySelectorAll('.risk-charts').length === 2, '结果分析结构不对');
A.rpTab('detail');
ok(document.querySelectorAll('#app-main tbody tr').length === 15 && $('.pager'), '攻防明细未分页 15');
ok($('#app-main thead').textContent.includes('序号') && !$('#app-main thead').textContent.includes('裁判理由'), '明细列不对');
A.rdPickAll('task-tgt-deepseek-chat');
ok($('.sel-ctl').textContent.includes('80'), '全选失败');
A.rdPickClear('task-tgt-deepseek-chat');
A.openUnit('task-tgt-deepseek-chat', 'u-task-tgt-deepseek-chat-Direct-001');
ok($('#drawer h2').textContent === '攻防明细详情' && $('#drawer').textContent.includes('判定理由'), '抽屉不对');
ok(!document.body.innerHTML.includes('已防御'), '仍有已防御');
A.go('exercise', 'reports');
ok($('.sort-btn'), '报告列表缺排序');
// 0.4
A.go('exercise', 'report-detail', 'task-tgt-deepseek-chat');
document.querySelector('.page-actions .btn.primary').click();
ok(!$('#rp-export').hidden, '报告导出按钮点不开');
A.rpTab('detail');
ok($('#app-main .clip-1') && $('.one-line'), '明细未单行截断');
A.go('strategy', 'methods');
ok(!$('#app-main').textContent.match(/。/), '攻击方法说明仍有句号');
A.openMethod('PAIR');
ok($('#drawer').classList.contains('open') && $('#drawer').textContent.includes('基本信息') && !$('#drawer').textContent.includes('实现'), '方法详情不对');
UI_close();
A.go('strategy', 'attack');
let th = $('#app-main thead').textContent;
ok(th.includes('状态') && !th.includes('裁判') && !$('#app-main').textContent.includes('删除') && $('#sg-q'), '策略列表列不对');
ok($('#app-main tbody').textContent.includes('前20 题'), '策略题库未标题量');
A.openStrategy('stg-advbench-base');
ok($('#drawer').textContent.includes('策略配置'), '策略详情不对');
UI_close();
A.newStrategy(); A.seField('name', '测试草稿'); A.seCancel(); A.seDraft();
ok(dom.window.App && $('#app-main tbody').textContent.includes('待发布'), '策略草稿未入列表');
A.newStrategy(); A.seField('name', '测试发布'); A.seMethod('PAIR', true); A.sePublish();
ok($('#toast').textContent.includes('攻击生成模型'), '辅助模型未校验');
A.seAux(0, 'generator', 'mdl-deepseek-flash'); A.seAux(0, 'process', 'mdl-deepseek-flash'); A.seBank('bank-advbench', true); A.seBankAll(0, false); A.sePublish();
ok($('#app-main tbody').textContent.includes('测试发布'), '策略发布失败');
UI_close();
origErr(fails.length ? '\n--- 交互失败 ---\n' + fails.join('\n') : '交互检查全部通过');

/* 0.5：接入模型 / 角色 / 风险规则 */
{
  const A = dom.window.App, $ = (s) => document.querySelector(s);
  A.go('assets', 'models'); A.modelForm();
  const n0 = (await import(pathToFileURL(path.join(ROOT, 'src/domain/store.js')).href)).models.length;
  A.mfField('apiModel', 'Qwen2.5-72B'); A.mfField('baseUrl', 'https://api.siliconflow.cn/v1'); A.mfField('apiKey', 'sk');
  A.mfTest(); await new Promise((r) => setTimeout(r, 700)); A.mfSave();
  const S = await import(pathToFileURL(path.join(ROOT, 'src/domain/store.js')).href);
  origErr('接入后模型数', n0, '→', S.models.length, S.models.at(-1).vendor);
  A.setRole(S.models.at(-1).id, '攻击生成', true);
  origErr('攻击生成角色', S.modelsWithRole('攻击生成').map((m) => m.name));
  A.go('risk', 'events'); origErr('风险事件行', document.querySelectorAll('#app-main tbody tr').length);
  A.go('strategy', 'attack'); A.newStrategy(); origErr('编辑器含配置项', document.getElementById('modal').innerHTML.includes('配置其他模型') || '(未选方法)');
}
