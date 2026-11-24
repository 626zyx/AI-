import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<main id="test-root"></main><div id="modal"></div><div id="drawer"></div><div id="toast"></div>', { url: 'http://localhost/#/exercise/tasks', runScripts: 'dangerously', pretendToBeVisual: true });
globalThis.window = dom.window;
for (const key of ['document', 'location', 'history', 'HTMLElement', 'Node', 'Event', 'CustomEvent', 'localStorage']) globalThis[key] = dom.window[key];
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
const store = await import('../src/domain/store.js');
const UI = await import('../src/core/ui.js');
const router = await import('../src/core/router.js');
const wizard = await import('../src/pages/task-wizard.js');
const { taskRepository } = await import('../src/domain/task-repository.js');
const modelSource = store.models.find(row => row.id === 'mdl-qwen-flash');
const agentSource = store.agents.find(row => row.id === 'agt-qwen-ds-flash');
store.models.push(...['v1', 'v2'].map(version => ({ ...structuredClone(modelSource), id: `v3-test-model@${version}`, assetId: 'v3-test-model', assetVersion: version, version, name: `客服模型 · ${version}`, status: 'connected', roles: ['靶标'] })));
store.models.push({ ...structuredClone(modelSource), id: 'v3-disabled-model@v1', assetId: 'v3-disabled-model', assetVersion: 'v1', name: '停用版本', status: 'disabled', roles: ['靶标'] });
store.agents.push(...['v1', 'v2'].map(version => ({ ...structuredClone(agentSource), id: `v3-test-agent@${version}`, assetId: 'v3-test-agent', assetVersion: version, version, name: `客服 Agent · ${version}`, status: 'connected' })));
const errors = []; window.addEventListener('error', event => errors.push(event.error || event.message));
window.UI = UI;
window.App = { ...wizard.actions, go: router.nav, back: router.back };
for (const [page, create] of [['exercise', 'task-create'], ['agent', 'ag-task-create']]) router.register(page, create, wizard.taskWizardPage);
for (const [page, subs] of [['exercise', ['tasks', 'task-detail']], ['agent', ['ag-tasks', 'ag-task-detail']], ['home', ['home']]]) for (const sub of subs) router.register(page, sub, cur => `<div data-destination="${cur.sub}">${cur.param || ''}</div>`);
router.setRenderer(() => { UI.closeModal(); UI.closeDrawer(); const cur = router.state(); document.getElementById('test-root').innerHTML = router.resolve(cur.page, cur.sub)?.(cur) || ''; });
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const click = (label, scope = document) => { const button = [...scope.querySelectorAll('button')].find(row => row.textContent.trim() === label && !row.disabled); assert.ok(button, `missing active button ${label}`); button.click(); };
const input = (id, text) => { const el = document.getElementById(id); assert.ok(el, `missing input ${id}`); el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); };
const select = (id, text) => { const el = document.getElementById(id); assert.ok(el, `missing selector ${id}`); if(el.tagName==='BUTTON') return wizard.actions.twSelect(({ 'tw-target':'targetId','tw-strategy':'strategyId','tw-judge':'judgeId' })[id],text); el.value = text; el.dispatchEvent(new Event('change', { bubbles: true })); };
const step = () => document.querySelector('[aria-current="step"]').textContent;
async function discard() {
  const button = document.querySelector('[data-unsaved-choice="discard"]');
  if (button) { button.click(); await tick(); }
}
test.afterEach(async () => {
  if (document.querySelector('.tw-root')) { wizard.actions.twExit(); await discard(); }
  UI.closeModal(); UI.closeDrawer();
  for (const task of [...store.listTasks(), ...store.listAgentTasks()]) if (task.status === 'running' && task.id.startsWith('usr-')) store.stopTask(task.id, task.objectType);
  assert.deepEqual(errors, []);
});
test.after(() => { store.initializeTaskRuntime()(); dom.window.close(); });

test('the first step fixes object type to its entry and keeps the selected resource', () => {
  wizard.openTaskWizard('model');
  assert.equal(document.querySelector('h1').textContent, '新建演练任务');
  assert.deepEqual([...document.querySelectorAll('.tw-steps li button > span:last-child')].map(el => el.textContent), ['任务与对象', '攻击与防护策略', '评估与执行', '确认配置']);
  assert.equal(document.getElementById('tw-object-type'), null);
  assert.equal(document.getElementById('tw-target').value, ''); assert.equal(document.getElementById('tw-target').tagName, 'BUTTON');
  assert.equal(document.getElementById('tw-version'),null,'version choice belongs to the resource table');
  select('tw-target', 'v3-test-model@v2');
  assert.doesNotMatch(document.querySelector('.tw-summary').textContent,/资产版本/);
  select('tw-target', 'v3-test-model@v1');
  assert.equal(document.getElementById('tw-target').value, 'v3-test-model@v1');
  assert.doesNotMatch(document.querySelector('.tw-summary').textContent, /资产版本/);
});

test('model and Agent entries keep their own object type without a switch control', async () => {
  wizard.openTaskWizard('model'); input('tw-name', '模型任务独立入口');
  select('tw-target', 'v3-test-model@v2'); click('下一步');
  assert.equal(router.state().sub, 'task-create');
  assert.equal(document.getElementById('tw-object-type'), null);
  assert.equal(document.getElementById('tw-guard').value, '');
  assert.equal(document.querySelector('[name="tw-guard-enabled"]'), null);
  await wizard.actions.twSaveDraft();
  const modelDraft = store.listTasks().find(row => row.name === '模型任务独立入口');
  assert.equal(modelDraft.objectType, 'model');
  wizard.openTaskWizard('agent', { targetId: 'v3-test-agent@v2' }); input('tw-name', 'Agent 任务独立入口');
  assert.equal(document.getElementById('tw-object-type'), null);
  assert.equal(router.state().sub, 'ag-task-create'); click('下一步');
  assert.ok(document.getElementById('tw-target'));
  assert.equal(document.querySelectorAll('.tw-steps li').length, 3);
  assert.doesNotMatch(document.querySelector('.tw-content').textContent, /ASR|攻击成功率/);
  await wizard.actions.twSaveDraft();
  assert.equal(store.listAgentTasks().find(row => row.name === 'Agent 任务独立入口').objectType, 'agent');
});

test('model attack and guard share a page, evaluation and execution share a page, then Create saves the selected configuration ready', async () => {
  wizard.openTaskWizard('model', { targetId: 'v3-test-model@v1' }); input('tw-name', '四步模型创建任务'); click('下一步');
  assert.match(step(), /攻击与防护策略/); assert.deepEqual([...document.querySelectorAll('.tw-content h2')].map(el => el.textContent), ['选择攻击策略', '选择防护策略']);
  select('tw-strategy', 'stg-advbench-base'); select('tw-guard', store.guards[0].id); click('下一步');
  assert.match(document.getElementById('tw-save-error').textContent, /防护位置/);
  document.querySelector('input[value="输入"]').click(); click('下一步');
  assert.match(step(), /评估与执行/); assert.doesNotMatch(document.querySelector('.tw-content').textContent, /评估指标|攻击成功率|ASR/); assert.ok(document.getElementById('tw-judge')); assert.ok(document.getElementById('tw-concurrency'));
  select('tw-judge', 'mdl-deepseek-flash'); input('tw-concurrency', '0'); click('下一步');
  assert.match(document.getElementById('tw-save-error').textContent, /并发数/);
  input('tw-concurrency', '5'); input('tw-max-tokens', '4096'); click('下一步');
  assert.match(step(), /确认配置/); assert.match(document.querySelector('.tw-content').textContent, /请求标识qwen-flash/);
  assert.doesNotMatch(document.querySelector('.tw-content').textContent, /资产版本/);
  assert.ok(![...document.querySelectorAll('button')].some(el => el.textContent === '保存待开始'));
  assert.ok(![...document.querySelectorAll('button')].some(el => el.textContent === '保存并发起'));
  click('创建任务'); await tick();
  const task = store.listTasks().find(row => row.name === '四步模型创建任务');
  assert.equal(task.status, 'ready'); assert.equal(task.startedAt, ''); assert.equal(task.replay.cursor, 0);
  assert.equal(task.targetId, 'v3-test-model@v1'); assert.equal(task.configSnapshot.concurrency, 5);
  assert.deepEqual(task.guardStages, ['输入']); assert.equal(router.state().sub, 'task-detail');
});

test('strategy dropdown selects only published strategies without opening a modal and supports keyboard dismissal', () => {
  wizard.openTaskWizard('model', { name: '下拉选择策略', targetId: 'v3-test-model@v1' }); click('下一步');
  const draftId = store.saveStrategy({ name: '未发布策略不应可选', status: 'draft', banks: [], methods: [] });
  wizard.actions.twPrevious(); click('下一步');
  document.getElementById('tw-strategy').click();
  assert.equal(document.getElementById('tw-strategy').getAttribute('aria-expanded'), 'true');
  assert.equal(document.querySelector('#modal.open'), null);
  assert.equal(document.querySelector(`[data-strategy-id="${draftId}"]`), null);
  assert.equal(document.querySelector('.tw-strategy-configure').textContent, '+ 去配置攻击策略');
  document.getElementById('tw-strategy').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.equal(document.activeElement.getAttribute('role'), 'option');
  document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(document.querySelector('.tw-strategy-menu').hidden, true);
  assert.equal(document.activeElement.id, 'tw-strategy');
  document.getElementById('tw-strategy').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  assert.equal(document.activeElement, document.querySelector('.tw-strategy-configure'));
  document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  document.getElementById('tw-strategy').click();
  document.querySelector('[data-strategy-id="stg-advbench-base"]').click();
  assert.equal(document.getElementById('tw-strategy').value, 'stg-advbench-base');
  assert.equal(document.querySelector('.tw-strategy-menu').hidden, true);
  wizard.actions.twSelect('strategyId', draftId);
  assert.equal(document.getElementById('tw-strategy').value, 'stg-advbench-base');
  document.getElementById('tw-strategy').click(); document.querySelector('.tw-content h2').click();
  assert.equal(document.querySelector('.tw-strategy-menu').hidden, true);
  store.deleteStrategy(draftId);
});

test('guard dropdown restores saved positions and disabling it clears both input and output', async () => {
  wizard.openTaskWizard('model', { name: '防护下拉恢复', targetId: 'v3-test-model@v1' }); click('下一步');
  select('tw-strategy', 'stg-advbench-base'); select('tw-guard', store.guards[0].id);
  document.querySelector('input[value="输入"]').click(); document.querySelector('input[value="输出"]').click();
  await wizard.actions.twSaveDraft();
  const draft = store.listTasks().find(row => row.name === '防护下拉恢复'); wizard.editTaskConfig(draft.id);
  assert.equal(document.getElementById('tw-guard').value, store.guards[0].id);
  assert.equal(document.querySelector('input[value="输入"]').checked, true);
  assert.equal(document.querySelector('input[value="输出"]').checked, true);
  select('tw-guard', ''); assert.equal(document.querySelector('input[value="输入"]'), null);
  await wizard.actions.twSaveDraft();
  assert.equal(store.getTask(draft.id).guardId, null); assert.deepEqual(store.getTask(draft.id).guardStages, []);
});

test('model Create task waits at detail and only binds an available archive after explicit start', async () => {
  wizard.openTaskWizard('model', { name: '创建后手动开始', sourceTaskId: 'task-tgt-qwen-flash-guard' });
  click('下一步'); click('下一步'); click('下一步');
  click('创建任务'); await tick();
  const task = store.listTasks().find(row => row.name === '创建后手动开始');
  assert.equal(task.status, 'ready'); assert.equal(task.startedAt, ''); assert.equal(task.replay.cursor, 0);
  assert.equal(task.sourceTaskId, null);
  assert.equal(router.state().sub, 'task-detail');
  store.startTask(task.id);
  assert.equal(store.getTask(task.id).status, 'running');
  assert.equal(store.getTask(task.id).sourceTaskId, 'task-tgt-qwen-flash-guard');
});

test('drafts resume the same fourth step, lock saved type and preserve unsaved navigation guards', async () => {
  wizard.openTaskWizard('model', { targetId: 'v3-test-model@v2' }); input('tw-name', '四步草稿恢复'); click('下一步');
  select('tw-strategy', 'stg-advbench-base'); click('下一步'); select('tw-judge', 'mdl-deepseek-flash'); click('下一步');
  click('保存草稿'); await tick();
  const draft = store.listTasks().find(row => row.name === '四步草稿恢复');
  assert.equal(draft.wizardStep, 3);
  wizard.editTaskConfig(draft.id); assert.match(step(), /确认配置/);
  wizard.actions.twStep(0); assert.equal(document.getElementById('tw-object-type'), null);
  assert.equal(wizard.actions.twType, undefined); assert.equal(router.state().page, 'exercise');
  input('tw-description', '未保存的修订'); router.nav('home', 'home');
  assert.ok(document.querySelector('[data-unsaved-choice="stay"]'));
  document.querySelector('[data-unsaved-choice="stay"]').click(); await tick();
  assert.equal(document.getElementById('tw-description').value, '未保存的修订');
  router.nav('home', 'home'); await discard();
  assert.equal(store.getTask(draft.id).description, '');
});

test('Agent three-step creation stays ready, then explicitly starts its matching archive', async () => {
  wizard.openTaskWizard('agent', { targetId: 'agt-deepagents-code-0210' }); input('tw-name', 'Agent 三步创建'); click('下一步');
  await wizard.actions.twValidateSandbox(); click('下一步'); wizard.actions.twQuestionFilter('questionBusiness', (await import('../src/domain/agent-environments.js')).getAgentQuestions()[0].business);
  wizard.actions.twQuestionsAll(true); assert.ok(document.getElementById('tw-judge'));
  assert.equal(document.querySelector('[name="tw-evaluation-mode"]'), null);
  select('tw-judge', 'mdl-deepseek-flash');
  click('创建任务'); await tick();
  const task = store.listAgentTasks().find(row => row.name === 'Agent 三步创建');
  assert.equal(task.status, 'ready'); assert.equal(task.targetId, 'agt-deepagents-code-0210'); assert.equal(router.state().sub, 'ag-task-detail');
  assert.equal(task.evaluationMode, 'llm'); assert.equal(task.judgeId, 'mdl-deepseek-flash');
  store.startTask(task.id,'agent'); assert.equal(taskRepository().get(task.id).sourceTaskId,'task-agt-b5-dc-baseline'); store.stopTask(task.id, 'agent');
});
