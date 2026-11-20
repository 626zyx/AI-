import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), {
  url: 'http://localhost/#/exercise/tasks', pretendToBeVisual: true, runScripts: 'dangerously',
});
globalThis.window = dom.window;
for (const key of ['document', 'location', 'history', 'HTMLElement', 'Node', 'Event', 'CustomEvent', 'getComputedStyle', 'localStorage']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
await import('../src/main.js');
const store = await import('../src/domain/store.js');
const router = await import('../src/core/router.js');
const { taskRepository } = await import('../src/domain/task-repository.js');
const { CONFIGURE_MODEL_VALUE } = await import('../src/core/model-config-navigation.js');
store.initializeTaskRuntime()();
const app = window.App;
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const prompt = () => document.querySelector('#modal.open [aria-label="保存任务配置"]');
const setField = (key, value) => {
  const input = document.getElementById(`tw-${key}`);
  assert.ok(input, `missing field ${key}`);
  input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
};
const choose = async choice => {
  const button = prompt()?.querySelector(`[data-unsaved-choice="${choice}"]`);
  assert.ok(button, `missing unsaved-change choice ${choice}`);
  button.click();
  await tick();
};

test('empty forms leave directly, while description-only changes survive cancel and save at the requested destination', async () => {
  for (const type of ['model', 'agent']) {
    const create = type === 'model' ? app.newTask : app.newAgTask;
    const sub = type === 'model' ? 'task-create' : 'ag-task-create';
    create(); app.twExit();
    assert.equal(prompt(), null);
    assert.notEqual(router.state().sub, sub);
    create();
    const description = `Description-only ${type}`;
    setField('description', description);
    app.go('assets', 'models');
    assert.equal(router.state().sub, sub);
    assert.ok(prompt());
    await choose('stay');
    assert.equal(router.state().sub, sub);
    assert.equal(document.querySelector('#tw-description').value, description);
    app.go('assets', 'models');
    await choose('save');
    assert.equal(router.state().page, 'assets');
    assert.equal(router.state().sub, 'models');
    const saved = (type === 'model' ? store.listTasks() : store.listAgentTasks()).find(task => task.description === description);
    assert.equal(saved.status, 'draft');
    assert.match(saved.name, /^未命名/);
    assert.equal(saved.wizardStep, 0);
    assert.equal(prompt(), null);
  }
});

test('a selected target alone triggers the reminder and discarding does not create or retain a task', async () => {
  for (const [type, target] of [['model', 'mdl-qwen-flash'], ['agent', 'agt-qwen-ds-flash']]) {
    const create = type === 'model' ? app.newTask : app.newAgTask;
    const list = type === 'model' ? store.listTasks : store.listAgentTasks;
    const count = list().length;
    create(); app.twSelect('targetId', target); app.twExit();
    assert.ok(prompt());
    await choose('discard');
    assert.equal(list().length, count);
    create();
    assert.equal(document.querySelector('#tw-target').value, '');
    app.twExit();
    assert.equal(prompt(), null);
  }
});

test('cancel is next to Save draft and saves the current wizard step without requiring full configuration', async () => {
  app.newTask();
  const buttons = [...document.querySelectorAll('.tw-footer-actions button')].map(button => button.textContent);
  assert.deepEqual(buttons.slice(0, 2), ['取消', '保存草稿']);
  assert.doesNotMatch(document.querySelector('.tw-footer').textContent, /返回列表/);
  setField('name', 'Leave at red-team step');
  app.twSelect('targetId', 'mdl-qwen-flash'); app.twNext();
  assert.match(document.querySelector('[aria-current="step"]').textContent, /红队配置/);
  app.twExit(); await choose('save');
  assert.equal(router.state().sub, 'tasks');
  const task = store.listTasks().find(task => task.name === 'Leave at red-team step');
  assert.equal(task.wizardStep, 1);
  app.editTaskConfig(task.id, 'model');
  assert.match(document.querySelector('[aria-current="step"]').textContent, /红队配置/);
  app.twExit();
  assert.equal(prompt(), null, 'opening an unchanged saved draft does not introduce edits');
});

test('canceling Back preserves the history entry, and hash navigation cannot drop unsaved inputs', async () => {
  app.go('risk', 'events'); app.newAgTask();
  setField('description', 'Back and hash preservation');
  app.back(); await choose('stay');
  assert.equal(router.state().sub, 'ag-task-create');
  app.back(); await choose('discard');
  assert.equal(router.state().page, 'risk');
  assert.equal(router.state().sub, 'events');
  app.newAgTask(); setField('description', 'Hash input');
  location.hash = '#/exercise/reports';
  await tick();
  assert.ok(prompt());
  assert.equal(router.state().sub, 'ag-task-create');
  assert.equal(location.hash, '#/agent/ag-task-create');
  await choose('stay');
  assert.equal(document.querySelector('#tw-description').value, 'Hash input');
  location.hash = '#/exercise/reports'; await tick(); await choose('save');
  assert.equal(router.state().sub, 'reports');
  assert.equal(location.hash, '#/exercise/reports');
});

test('saving errors keep the original form and its edits instead of continuing navigation', async () => {
  app.newTask();
  setField('name', store.listTasks()[0].name);
  setField('description', 'Keep me after save failure');
  app.go('assets', 'models'); await choose('save');
  assert.equal(router.state().sub, 'task-create');
  assert.equal(prompt(), null);
  assert.equal(document.querySelector('#tw-description').value, 'Keep me after save failure');
  assert.match(document.querySelector('#tw-save-error').textContent, /名称已存在/);
  setField('name', 'Recovered after leave save failure');
  app.go('assets', 'models'); await choose('save');
  assert.equal(router.state().sub, 'models');
  assert.ok(store.listTasks().some(task => task.name === 'Recovered after leave save failure'));
});

test('explicit saves leave once without another reminder and reverting edits makes the form clean', async () => {
  app.newTask(); setField('description', 'temporary'); setField('description', ''); app.twExit();
  assert.equal(prompt(), null);
  app.newAgTask(); setField('name', 'Explicit Agent draft');
  await app.twSaveDraft();
  assert.equal(router.state().sub, 'ag-tasks');
  assert.equal(prompt(), null);
  app.newTask(); setField('name', 'Explicit ready task');
  app.twSelect('targetId', 'mdl-qwen-flash'); app.twSelect('strategyId', 'stg-advbench-base'); app.twSelect('judgeId', 'mdl-deepseek-flash');
  await app.twSave();
  assert.equal(router.state().sub, 'task-detail');
  assert.equal(prompt(), null);
});

test('editing saved model and Agent tasks preserves the original on discard and saves changes to the same draft', async () => {
  for (const type of ['model', 'agent']) {
    const getTask = type === 'model' ? store.getTask : store.getAgentTask;
    const id = store.saveTask({ name: `Editable ${type} guard`, objectType: type,
      targetId: type === 'model' ? 'mdl-qwen-flash' : 'agt-qwen-ds-flash',
      strategyId: type === 'model' ? 'stg-advbench-base' : 'agstg-cs-baseline', judgeId: 'mdl-deepseek-flash' });
    app.editTaskConfig(id, type); setField('description', 'Discard this edit');
    app.go('risk', 'events'); await choose('discard');
    assert.equal(getTask(id).description, '');
    assert.equal(getTask(id).status, 'ready');
    app.editTaskConfig(id, type); setField('description', 'Save this edit');
    app.go('assets', 'models'); await choose('save');
    assert.equal(getTask(id).description, 'Save this edit');
    assert.equal(getTask(id).status, 'draft');
    assert.equal(router.state().sub, 'models');
  }
});

test('a persistence failure preserves entered data and permits retrying the original navigation', async context => {
  app.newAgTask(); setField('description', 'Persistence failure input');
  const put = context.mock.method(taskRepository(), 'put', () => { throw new Error('任务保存服务暂时不可用'); });
  app.go('risk', 'events'); await choose('save');
  assert.equal(router.state().sub, 'ag-task-create');
  assert.equal(document.querySelector('#tw-description').value, 'Persistence failure input');
  assert.match(document.querySelector('#tw-save-error').textContent, /保存服务暂时不可用/);
  assert.equal(document.querySelector('.tw-form').getAttribute('aria-busy'), 'false');
  put.mock.restore();
  app.go('risk', 'events'); await choose('save');
  assert.equal(router.state().sub, 'events');
  assert.ok(store.listAgentTasks().some(task => task.description === 'Persistence failure input'));
});

test('model asset detours ask first, retain unfinished inputs, and return to a newly saved draft correctly', async () => {
  app.newTask(); setField('description', 'Asset detour unsaved'); app.twSelect('targetId', 'mdl-qwen-flash');
  app.twSelect('targetId', CONFIGURE_MODEL_VALUE);
  assert.equal(router.state().sub, 'task-create');
  await choose('stay');
  assert.equal(document.querySelector('#tw-target').value, 'mdl-qwen-flash');
  app.twSelect('targetId', CONFIGURE_MODEL_VALUE); await choose('discard');
  assert.equal(router.state().sub, 'roles');
  app.returnToModelConfiguration();
  assert.equal(document.querySelector('#tw-description').value, 'Asset detour unsaved');
  assert.equal(document.querySelector('#tw-target').value, 'mdl-qwen-flash');
  app.twSelect('targetId', CONFIGURE_MODEL_VALUE); await choose('save');
  assert.equal(router.state().sub, 'roles');
  const task = store.listTasks().find(task => task.description === 'Asset detour unsaved');
  assert.equal(task.status, 'draft');
  app.returnToModelConfiguration();
  assert.equal(router.state().param, task.id);
  assert.equal(document.querySelector('#tw-description').value, 'Asset detour unsaved');
  app.twExit();
  assert.equal(prompt(), null, 'saving during the detour marks the returned form clean');
});

test('closing the reminder keeps the form, and repeated navigation uses the latest intended destination', async () => {
  app.newAgTask(); setField('description', 'Latest destination');
  app.go('assets', 'models');
  prompt().querySelector('[aria-label="关闭"]').click(); await tick();
  assert.equal(router.state().sub, 'ag-task-create');
  app.go('assets', 'models'); app.go('risk', 'events'); await choose('save');
  assert.equal(router.state().page, 'risk');
  assert.equal(router.state().sub, 'events');
});

test('refresh and tab close warn only for an active unsaved wizard', async () => {
  const unloadEvent = () => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event; };
  app.newTask();
  assert.equal(unloadEvent().defaultPrevented, false);
  setField('description', 'Before unload');
  assert.equal(unloadEvent().defaultPrevented, true);
  await app.twSaveDraft();
  assert.equal(unloadEvent().defaultPrevented, false);
  app.newAgTask(); app.twSelect('targetId', 'agt-qwen-ds-flash');
  assert.equal(unloadEvent().defaultPrevented, true);
  app.twExit(); await choose('discard');
  assert.equal(unloadEvent().defaultPrevented, false);
});

test.after(() => dom.window.close());
