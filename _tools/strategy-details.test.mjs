import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<main></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', { url: 'http://localhost/', runScripts: 'dangerously' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const UI = await import('../src/core/ui.js');
const store = await import('../src/domain/store.js');
const { actions: strategies } = await import('../src/pages/strategy.js');
const { actions: library } = await import('../src/pages/library.js');
const { actions: agentStrategies } = await import('../src/pages/agent-strategy.js');
const { actions: agentMethods, agentMethodsPage } = await import('../src/pages/agent-methods.js');
const { SURFACE_GROUPS, SURFACE_TYPES } = await import('../src/domain/attack-surfaces.js');
const { actions: sceneBanks, sceneBanksPage } = await import('../src/pages/scene-banks.js');
const router = await import('../src/core/router.js');
const { agentEnvironmentEditorPage, agentEnvironmentActions } = await import('../src/pages/agent-environment-editor.js');
const { getAgentQuestions, exportAgentQuestionZip } = await import('../src/domain/agent-environments.js');
const { readBundleZip } = await import('../src/domain/resource-authoring.js');
const { configSummary, mountTaskConfig } = await import('../src/core/task-config.js');
window.UI = UI;
window.App = { ...strategies, ...library, ...agentStrategies, ...agentMethods, ...sceneBanks, ...agentEnvironmentActions };
router.register('strategy','scenebanks',sceneBanksPage);
router.register('strategy','authoring',agentEnvironmentEditorPage);
router.setRenderer(()=>{const route=router.state();const render=router.resolve(route.page,route.sub);if(render)document.querySelector('main').innerHTML=render(route);});
after(() => dom.window.close());
const drawer = () => document.querySelector('#drawer .drawer');
const assertCards = () => {
  assert.ok(drawer().classList.contains('tc-config-drawer'));
  assert.equal(drawer().querySelectorAll('.tc-drawer-content > .tc-detail-block').length, 2);
  assert.ok(drawer().querySelector('.tc-fields'));
};

test('all strategy center detail entry points use the task configuration drawer layout', () => {
  const opens = [
    () => strategies.openStrategy(store.strategies[0].id),
    () => strategies.openGuard(store.guards[0].id),
    () => library.openMethod(store.methods.find(m => m.name === 'PAIR').id),
    () => library.openBank(store.banks[0].id),
    () => agentStrategies.openAgStrategy(store.agentStrategies[1].id),
    () => agentMethods.openAgMethod('universal'),
  ];
  for (const open of opens) { open(); assertCards(); }
});

test('strategy methods share parameter and auxiliary columns with task configuration', () => {
  strategies.openStrategy('stg-advbench-base');
  const table = drawer().querySelector('table');
  assert.deepEqual([...table.querySelectorAll('th')].map(x => x.textContent), ['名称', '参数', '辅助模型']);
  assert.equal(table.querySelectorAll('tbody tr').length, 4);
  const pair = [...table.querySelectorAll('tbody tr')].find(row => row.children[0].textContent === 'PAIR');
  assert.match(pair.children[1].textContent, /最大迭代轮数：5/);
  assert.equal(pair.children[2].textContent, '攻击生成模型：DeepSeek-V3-Chat');
  const pairHTML = pair.innerHTML;
  const host = document.querySelector('main');
  host.innerHTML = configSummary(store.getTask('task-tgt-qwen-flash-guard'));
  const cleanup = mountTaskConfig(host);
  host.querySelector('[data-config-toggle]').click();
  assertCards();
  const taskPair = [...drawer().querySelectorAll('tbody tr')].find(row => row.children[0].textContent === 'PAIR');
  assert.equal(taskPair.innerHTML, pairHTML);
  cleanup();
  agentStrategies.openAgStrategy('agstg-cs-universal');
  assert.match(drawer().textContent, /攻击生成模型：DeepSeek-V4-Pro/);
  assert.doesNotMatch(drawer().textContent, /攻击者模型/);
});

test('method catalogs preserve parameter defaults and empty methods in readable tables', () => {
  const method = store.methods.find(m => m.name === 'PAIR');
  library.openMethod(method.id);
  assert.deepEqual([...drawer().querySelectorAll('th')].map(x => x.textContent), ['参数', '默认值']);
  assert.equal(drawer().querySelectorAll('tbody tr').length, method.params.length);
  for (const param of method.params) assert.ok(drawer().textContent.includes(String(param.label)));
  agentMethods.openAgMethod('universal');
  assert.deepEqual([...drawer().querySelector('table').querySelectorAll('th')].map(x => x.textContent), ['参数', '说明']);
  assert.deepEqual([...drawer().querySelectorAll('table')[1].querySelectorAll('th')].map(x => x.textContent), ['类型', '文件示例', '加载说明']);
  assert.match(drawer().textContent, /QWEN\.md/);
  assert.match(drawer().textContent, /记忆与历史/);
  assert.match(drawer().textContent, /推荐模型攻击生成模型：DeepSeek-V4-Pro/);
  agentMethods.openAgMethod('baseline');
  assert.match(drawer().textContent, /无可配置参数/);
});

test('Agent method catalog groups display types without implying support for every target', () => {
  const list = new JSDOM(agentMethodsPage()).window.document;
  assert.ok(list.body.textContent.includes('间接提示注入'));
  assert.doesNotMatch(list.body.textContent, /README\.md|workspace/);
  agentMethods.openAgMethod('universal');
  assertCards();
  const groups = [...drawer().querySelectorAll('[data-surface-group]')];
  assert.deepEqual(groups.map(section => section.dataset.surfaceGroup), SURFACE_GROUPS.map(group => group.id));
  for (const group of SURFACE_GROUPS) {
    const section = groups.find(item => item.dataset.surfaceGroup === group.id);
    assert.deepEqual([...section.querySelectorAll('[data-surface-type]')].map(item => item.dataset.surfaceType), SURFACE_TYPES.filter(type => type.group === group.id).map(type => type.id));
    for (const type of SURFACE_TYPES.filter(item => item.group === group.id)) {
      assert.ok(section.textContent.includes(type.loading));
      for (const file of type.examples) assert.ok(section.textContent.includes(file));
    }
  }
  assert.equal(drawer().querySelectorAll('[data-surface-type]').length, 8);
  assert.equal(SURFACE_TYPES.filter(type => type.kind === 'memory').length, 3);
  assert.match(drawer().textContent, /须由具体靶标核验/);
  assert.match(drawer().textContent, /技能被发现不等于正文被调用/);
  assert.match(drawer().textContent, /不包含平台管理的模型凭据/);
  assert.doesNotMatch(drawer().textContent, /README\.md|workspace/);
  assert.equal(drawer().querySelectorAll('input,select,textarea').length, 0);
});

test('question-bank paging and filtering preserve the two-card layout and input focus', () => {
  const bank = store.banks.find(b => b.items.length > UI.PAGE_SIZE);
  library.openBank(bank.id);
  library.bdPage(2);
  assertCards();
  assert.ok(drawer().querySelector('tbody tr').textContent.includes(bank.items[UI.PAGE_SIZE].id));
  const search = document.querySelector('#bd-q');
  search.focus(); search.value = bank.items[0].id;
  search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assertCards();
  assert.equal(document.activeElement.id, 'bd-q');
  assert.ok(drawer().querySelector('tbody tr').textContent.includes(bank.items[0].id));
  assert.match(drawer().querySelector('.pager').textContent, /1 \/ 1/);
  library.bdSearch('no-question-matches-this');
  assertCards();
  assert.match(drawer().textContent, /该筛选条件下暂无题目/);
});

test('the five-question environment table filters individual questions and opens their read-only file editor',async()=>{
  UI.closeDrawer();router.nav('strategy','scenebanks');
  const questions=getAgentQuestions();assert.equal(questions.length,5);
  assert.equal(document.querySelectorAll('main tbody tr').length,5);
  const question=questions[0];
  sceneBanks.sbCategory(encodeURIComponent(question.business));
  assert.equal(document.querySelectorAll('main tbody tr').length,questions.filter(row=>row.business===question.business).length);
  const search=document.getElementById('sb-q');search.value=question.taskId;search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  assert.equal(document.getElementById('sb-q').value,question.taskId);
  assert.equal(document.querySelectorAll('main tbody tr').length,1);
  assert.ok(document.querySelector('main tbody tr').textContent.includes(question.title));
  document.querySelector('main tbody .ae-title').click();
  assert.equal(router.state().sub,'authoring');assert.equal(router.state().param,question.id);
  assert.equal(document.getElementById('ae-code').readOnly,true);
  assert.equal(document.getElementById('ae-title').disabled,true);
  assert.ok([...document.querySelectorAll('.page-actions button')].some(button=>button.textContent==='导出 ZIP'));
  const exported=await readBundleZip(exportAgentQuestionZip(question.id));
  for(const [path,content] of Object.entries(question.files))assert.equal(exported[path],content,path);
  sceneBanks.sbSearch('no-environment-matches-this');
  assert.match(document.querySelector('main').textContent,/暂无匹配环境/);
  sceneBanks.sbSearch('');sceneBanks.sbCategory('all');
});
