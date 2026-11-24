import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskRepository, taskRepository, TASK_STORAGE_KEY } from '../src/domain/task-repository.js';
import { createTaskService } from '../src/domain/task-service.js';
import { buildReplayEvents, projectReplay } from '../src/domain/task-replay.js';
import { roundInfo, roundAnalysis } from '../src/domain/task-rounds.js';
import { currentTaskContent } from '../src/pages/task-content.js';
import { tasks } from '../src/data/tasks.js';
import { units } from '../src/data/units.js';
import { agentTasks } from '../src/data/agent-tasks.js';
import { agentUnits } from '../src/data/agent-units.js';

const values = new Map();
const storage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) };
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
const store = await import('../src/domain/store.js');
const source = tasks.find((t) => t.guardId);
const original = units.filter((u) => u.taskId === source.id);

test('an explicitly injected storage adapter is atomic, round-trips, and protects corrupt archives', () => {
  const key = 'test-repository';
  const repository = createTaskRepository(storage, key);
  repository.put({ id: 'test-a', name: 'Test draft', objectType: 'model', sourceTaskId: source.id, status: 'draft', total: 80, methods: source.methods, replayCursor: 0 });
  assert.equal(createTaskRepository(storage, key).get('test-a').status, 'draft');
  const denied = createTaskRepository({ getItem: () => null, setItem: () => { throw Error('quota'); } });
  assert.throws(() => denied.put({ id: 'b' }), /保存失败/);
  assert.deepEqual(denied.list(), []);
  let written = false;
  const corrupt = createTaskRepository({ getItem: () => '{bad', setItem: () => { written = true; } });
  assert.throws(() => corrupt.put({ id: 'c' }), /读取失败/);
  assert.equal(written, false);
  for (const bad of [
    { id: 'bad', sourceTaskId: source.id, objectType: 'model', status: 'ready' },
    { ...source, sourceTaskId: source.id, replayCursor: '2' },
  ]) {
    const invalid = createTaskRepository({ getItem: () => JSON.stringify({ version: 1, tasks: [bad] }), setItem: () => { written = true; } });
    assert.match(invalid.error().message, /记录损坏/);
    assert.deepEqual(invalid.list(), []);
    assert.throws(() => invalid.put({ id: 'new' }), /读取失败/);
    assert.equal(written, false);
  }
});

test('page sessions retain operations in memory and a fresh page resets tasks, progress and deletions', async () => {
  storage.setItem(TASK_STORAGE_KEY, '{legacy archive}');
  storage.setItem('unrelated-setting', 'keep');
  const firstPage = await import('../src/domain/task-repository.js?page-session=first');
  const repository = firstPage.taskRepository();
  const service = createTaskService({ modelTasks: tasks, modelUnits: units, agentTasks, agentUnits,
    nowText: () => '2026-11-19 14:00', repository: firstPage.taskRepository });
  assert.equal(storage.getItem(TASK_STORAGE_KEY), null, 'legacy task archive is discarded without being loaded');
  assert.equal(repository.error(), null);
  const id = service.saveTask({ name: 'Current-page task', sourceTaskId: source.id });
  service.startTask(id);
  const startingCursor = repository.get(id).replayCursor;
  service.advanceTaskReplay(id, 'model', 4);
  service.deleteTask(source.id);
  assert.equal(firstPage.taskRepository(), repository, 'route changes share the same page repository');
  assert.equal(repository.get(id).replayCursor, startingCursor + 4);
  assert.equal(repository.get(id).configSnapshot.targetId, source.targetId);
  assert.equal(repository.isDeleted(source.id), true);
  assert.equal(storage.getItem(TASK_STORAGE_KEY), null, 'task changes never write browser storage');

  // A browser reload evaluates a new module instance with a fresh singleton.
  const nextPage = await import('../src/domain/task-repository.js?page-session=next');
  const fresh = nextPage.taskRepository();
  assert.deepEqual(fresh.list(), []);
  assert.deepEqual(fresh.deleted(), []);
  assert.equal(fresh.get(id), null);
  assert.equal(fresh.isDeleted(source.id), false, 'historical tasks are visible again');
  assert.equal(storage.getItem('unrelated-setting'), 'keep');
});

test('memory task operations remain available when browser storage access is denied', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('denied'); } });
  try {
    const page = await import('../src/domain/task-repository.js?page-session=denied');
    const repository = page.taskRepository();
    const service = createTaskService({ modelTasks: tasks, modelUnits: units, agentTasks, agentUnits,
      nowText: () => '2026-11-19 14:00', repository: page.taskRepository });
    const id = service.saveTask({ name: 'Storage-independent task', sourceTaskId: source.id });
    assert.equal(repository.get(id).status, 'ready');
    assert.equal(repository.error(), null);
    assert.deepEqual(createTaskRepository().list(), []);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  }
});

test('model replay does not expose future response, protection or verdict', () => {
  const picked = original.find((u) => u.history.some((h) => h.guard?.action === 'pass'));
  const events = buildReplayEvents(source, [picked]);
  const record = { ...source, id: 'privacy-check', sourceTaskId: source.id, status: 'running', startedAt: '2026-11-19 10:00:00' };
  for (let cursor = 0; cursor < events.length; cursor++) {
    const projection = projectReplay(record, source, [picked], events, cursor);
    const unit = projection.executionUnits[0];
    const ended = events.slice(0, cursor).some((e) => e.stage === 'unit_complete');
    assert.equal(projection.units.length, ended ? 1 : 0);
    if (!ended) { assert.equal(unit.judgeSuccess, null); assert.equal(unit.judgeScore, null); assert.equal(unit.judgeReason, ''); }
    for (const h of unit.history) {
      const seen = events.slice(0, cursor).filter((e) => e.round === h.round);
      if (!seen.some((e) => ['target', 'output_guard', 'round_complete'].includes(e.stage))) {
        assert.equal(h.response, '');
        assert.ok(!h.guard?.originalResponse);
      }
      if (!seen.some((e) => ['output_guard', 'round_complete'].includes(e.stage))) assert.ok(!h.guard?.output);
    }
  }
  const complete = projectReplay(record, source, [picked], events, events.length);
  assert.equal(complete.units[0].output, picked.output);
  assert.equal(complete.units[0].judgeSuccess, picked.judgeSuccess);
});

test('canvas output follows the visible module and never previews future content', () => {
  const picked = original.find(u => u.history.some(h => h.guard?.input && h.guard?.output && h.guard.action === 'pass'));
  assert.ok(picked);
  const events = buildReplayEvents(source, [picked]);
  const record = { ...source, id: 'bubble-check', sourceTaskId: source.id, status: 'running' };
  for (const stage of ['attack', 'input_guard', 'target', 'output_guard', 'judge']) {
    const index = events.findIndex(e => e.stage === stage);
    assert.ok(index >= 0);
    const projection = projectReplay(record, source, [picked], events, index + 1);
    const unit = projection.executionUnits[0];
    const content = currentTaskContent({ ...record, ...projection }, unit);
    const h = picked.history[events[index].historyIndex];
    if (stage === 'attack') { assert.equal(content.label, '攻击生成'); assert.equal(content.text, h.prompt); assert.equal(unit.output, ''); }
    if (stage === 'input_guard') { assert.equal(content.label, '输入审核'); assert.match(content.text, new RegExp(h.guard.input.labelCn || h.guard.input.label)); }
    if (stage === 'target') { assert.equal(content.label, '靶标响应'); assert.equal(content.text, h.guard.originalResponse || h.response); }
    if (stage === 'output_guard') assert.equal(content.label, '输出审核');
    if (stage === 'judge') { assert.equal(content.label, '裁判判定'); assert.equal(content.text, picked.judgeReason); }
    else assert.equal(unit.judgeContent, undefined);
  }
  const ready = currentTaskContent({ ...record, status: 'ready' }, picked);
  assert.equal(ready.text, '—');
  const pending = currentTaskContent(record, { executionStatus: 'pending' });
  assert.equal(pending.text, '—');
  const selected = currentTaskContent({ ...record, replay: { stage: 'attack' } }, { ...picked, executionStatus: 'done' }, { selected: true });
  assert.equal(selected.label, '裁判判定');
  assert.equal(selected.text, picked.judgeReason);
});

test('task lifecycle saves a real clone, starts once, retains progress, stops and completes truthfully', () => {
  let changed = 0;
  const unsubscribe = store.subscribeTasks(() => changed++);
  const id = store.saveTask({ name: 'Domain integration clone', objectType: 'model', sourceTaskId: source.id }, { draft: true });
  let task = store.getTask(id);
  assert.equal(task.status, 'draft');
  assert.equal(task.units.length, 0);
  assert.equal(task.executionUnits.length, 80);
  assert.equal(task.guard, null);
  assert.ok(!store.listReports().some((r) => r.taskId === id));
  assert.throws(() => store.startTask(id), /待开始/);
  assert.throws(() => store.saveTask({ name: 'Domain integration clone', sourceTaskId: source.id }), /名称已存在/);
  store.saveTask({ id, name: 'Domain integration clone', objectType: 'model', sourceTaskId: source.id });
  assert.equal(store.getTask(id).status, 'ready');
  store.startTask(id);
  assert.equal(store.getTask(id).status, 'running');
  const start = store.getTask(id).startedAt;
  store.startTask(id);
  assert.equal(store.getTask(id).startedAt, start);
  store.advanceTaskReplay(id, 'model', 13);
  task = store.getTask(id);
  assert.ok(task.progress > 0 && task.progress < 1);
  assert.equal(task.asr, 0);
  assert.equal(task.guard, null);
  assert.throws(() => store.saveTask({ id, name: 'Changed running', sourceTaskId: source.id }), /只能编辑/);
  store.stopTask(id);
  const cursor = store.getTask(id).replay.cursor;
  store.advanceTaskReplay(id, 'model', 9999);
  assert.equal(store.getTask(id).replay.cursor, cursor);
  assert.equal(store.getTask(id).status, 'stopped');
  assert.throws(() => store.startTask(id), /待开始/);
  const next = store.saveTask({ name: 'Domain complete clone', objectType: 'model', sourceTaskId: id });
  store.startTask(next);
  store.advanceTaskReplay(next, 'model', 99999);
  const done = store.getTask(next);
  assert.equal(done.status, 'done');
  assert.equal(done.units.length, original.length);
  assert.equal(done.agg.breach, source.breach);
  assert.equal(done.asr, source.asr);
  assert.equal(done.progress, 1);
  assert.deepEqual(done.guard, source.guard);
  assert.ok(store.listReports().some((r) => r.taskId === next));
  assert.equal(store.getTask(source.id).status, 'done');
  assert.equal(store.getTask(source.id).units[0].id, original[0].id);
  assert.ok(changed >= 7);
  unsubscribe();
});

test('Agent trace replay is not counted as attack rounds or leaked before it happens', () => {
  const agentSource = agentTasks.find((t) => t.id === 'task-agt-cs5-universal');
  assert.equal(agentSource.maxRounds, undefined, 'this legacy fixture has no declared attack-round budget');
  const originals = agentUnits.filter((u) => u.taskId === agentSource.id);
  const id = store.saveTask({ name: 'Agent integration clone', objectType: 'agent', sourceTaskId: agentSource.id });
  try {
    store.startTask(id, 'agent');
    store.advanceTaskReplay(id, 'agent', 2);
    const active = store.getAgentTask(id);
    assert.equal(active.units.length, 0);
    assert.equal(active.executionUnits[0].verdict, null);
    assert.deepEqual(active.executionUnits[0].outputFiles, []);
    assert.ok(active.executionUnits[0].attack.surfaces.every((s) => s.adopted === undefined && s.reaction === undefined));
    assert.equal(active.executionUnits[0].roundInfo.completedRounds, null);
    assert.equal(active.executionUnits[0].roundInfo.maxRounds, null);
    store.advanceTaskReplay(id, 'agent', 99999);
    const done = store.getAgentTask(id);
    assert.equal(done.status, 'done');
    assert.deepEqual(done.units.map((u) => u.verdict), originals.map((u) => u.verdict));
    assert.equal(roundAnalysis(done).roundSamples, 0);
  } finally {
    if (store.getAgentTask(id)?.status === 'running') store.stopTask(id, 'agent');
  }
});

test('breach rounds use judged evidence without inventing earlier cumulative outcomes', () => {
  const multi = original.find((u) => u.judgeSuccess && u.rounds > 1);
  assert.ok(multi.judgedRound > 0);
  assert.equal(roundInfo(source, multi).firstBreachRound, null);
  assert.equal(roundInfo(source, multi).breachRound, multi.judgedRound, 'the successful judged response identifies its attack round');
  assert.equal(roundInfo(source, { ...multi, judgeSuccess:false }).breachRound, null);
  assert.equal(roundInfo(source, { ...multi, judgedRound:999 }).breachRound, null, 'a missing round is not invented');
  const one = { method: 'Direct', rounds: 1, judgeSuccess: true, history: [{ round: 1 }] };
  assert.equal(roundInfo(source, one).firstBreachRound, 1);
  const known = { method: 'PAIR', rounds: 3, judgeSuccess: true, history: [{ round: 1, judgeSuccess: false }, { round: 2, judgeSuccess: true }, { round: 3, judgeSuccess: true }] };
  assert.equal(roundInfo(source, known).firstBreachRound, 2);
  assert.equal(roundInfo(source, { ...known, history: [{ round: 1 }, { round: 2, judgeSuccess: true }] }).firstBreachRound, null);
  const report = roundAnalysis({ ...source, units: original });
  assert.equal(report.methods.find((m) => m.name === 'PAIR').unknownBreachRound, 0);
  assert.equal(report.methods.find((m) => m.name === 'PAIR').breachRoundSamples, original.filter((u) => u.method === 'PAIR' && u.judgeSuccess).length);
});

test('runtime is idempotent, resumes the current page cursor, and cancels stopped work', () => {
  const pending = new Map();
  const nativeSet = globalThis.setTimeout, nativeClear = globalThis.clearTimeout;
  let serial = 0;
  globalThis.setTimeout = (fn) => { pending.set(++serial, fn); return serial; };
  globalThis.clearTimeout = (id) => pending.delete(id);
  let cleanup;
  try {
    const id = store.saveTask({ name: 'Runtime lifecycle', sourceTaskId: source.id });
    store.startTask(id);
    assert.equal(pending.size, 0, 'no implicit timers before runtime assembly');
    cleanup = store.initializeTaskRuntime();
    store.initializeTaskRuntime();
    store.startTask(id);
    assert.equal(pending.size, 1, 'one task owns exactly one timer');
    const [handle, callback] = [...pending][0];
    pending.delete(handle); callback();
    assert.equal(pending.size, 1);
    assert.equal(taskRepository().get(id).replayCursor, store.getTask(id).replay.cursor);
    assert.equal(storage.getItem(TASK_STORAGE_KEY), null);
    cleanup(); assert.equal(pending.size, 0);
    cleanup = store.initializeTaskRuntime();
    assert.equal(pending.size, 1, 'saved active task resumes when runtime is assembled');
    store.stopTask(id);
    assert.equal(pending.size, 0);
  } finally { cleanup?.(); globalThis.setTimeout = nativeSet; globalThis.clearTimeout = nativeClear; }
});

test('model configuration is saved independently and binds real replay evidence only when started', () => {
  const input = { name: 'Selected model configuration', objectType: 'model', targetId: 'mdl-qwen-flash',
    strategyId: 'stg-advbench-base', guardEnabled: true, guardStages: ['输入', '输出'], judgeId: 'mdl-deepseek-flash' };
  const id = store.saveTask(input);
  const ready = store.getTask(id);
  assert.equal(ready.sourceTaskId, null);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.targetId, input.targetId);
  assert.equal(ready.units.length, 0);
  assert.equal(ready.executionUnits.length, 80);
  assert.ok(ready.executionUnits.every(u => !u.target && !u.output && u.history.length === 0));
  assert.equal(ready.methods.find(m => m.name === 'PAIR').auxiliaryModels[0].name, 'DeepSeek-V3-Chat');
  assert.deepEqual(ready.methods.find(m => m.name === 'DeepInception').params, [['情境类型', 'stage scene'], ['嵌套层数', 5], ['角色数量', 8]]);
  assert.equal(taskRepository().get(id).sourceTaskId, null);
  store.startTask(id);
  const started = store.getTask(id);
  assert.equal(started.sourceTaskId, source.id);
  assert.equal(started.replayConfigMatches, true);
  assert.deepEqual(started.configSnapshot, ready.configSnapshot);
  assert.equal(started.executionSnapshot.targetName, source.targetName);
  store.advanceTaskReplay(id, 'model', 99999);
  assert.equal(store.getTask(id).agg.breach, 7);

  const different = store.saveTask({ ...input, name: 'Independent input guard configuration', targetId: 'mdl-deepseek-chat', guardStages: ['输入'], judgeId: 'mdl-deepseek-v4-pro' });
  store.startTask(different);
  const demonstration = store.getTask(different);
  assert.equal(demonstration.targetId, 'mdl-deepseek-chat');
  assert.equal(demonstration.judgeId, 'mdl-deepseek-v4-pro');
  assert.deepEqual(demonstration.guardStages, ['输入']);
  assert.equal(demonstration.replayConfigMatches, false);
  assert.equal(demonstration.sourceTaskId, source.id);
  assert.deepEqual(demonstration.executionSnapshot.guardStages, ['输入', '输出']);
  store.stopTask(different);
});

test('model drafts retain incomplete selections while ready tasks require a published strategy and existing models', () => {
  const id = store.saveTask({ name: 'Incomplete configured draft', targetId: '', strategyId: '', judgeId: '', guardEnabled: false }, { draft: true });
  assert.equal(store.getTask(id).status, 'draft');
  assert.equal(store.getTask(id).sourceTaskId, null);
  assert.deepEqual(store.getTask(id).executionUnits, []);
  assert.equal(taskRepository().get(id).status, 'draft');
  assert.throws(() => store.saveTask({ id, name: 'Incomplete configured draft' }), /靶标模型/);
  const config = { name: 'Invalid model configuration', targetId: 'mdl-qwen-flash', strategyId: 'stg-advbench-base', judgeId: 'mdl-deepseek-flash', guardEnabled: true, guardStages: [] };
  assert.throws(() => store.saveTask(config), /蓝队防护位置/);
  assert.throws(() => store.saveTask({ ...config, guardEnabled: false, judgeId: 'missing-model' }), /裁判模型/);
  const unpublished = store.saveStrategy({ name: 'Not available for tasks', status: 'draft', banks: [], methods: [] });
  assert.throws(() => store.saveTask({ ...config, guardEnabled: false, strategyId: unpublished }), /已发布/);
  store.deleteStrategy(unpublished);
  store.saveTask({ ...config, id, name: 'Incomplete configured draft', guardStages: ['输出'] });
  assert.equal(store.getTask(id).status, 'ready');
  assert.deepEqual(store.getTask(id).guardStages, ['输出']);
});

test('model execution settings validate, persist through edits, and copy with the configuration', () => {
  const input = { name: 'Execution settings', targetId: 'mdl-qwen-flash', strategyId: 'stg-advbench-base', judgeId: 'mdl-deepseek-flash', guardEnabled: false, concurrency: 6, maxTokens: 4096 };
  for (const [key, value, pattern] of [['concurrency', 0, /并发数/], ['concurrency', 1.5, /并发数/], ['maxTokens', '', /Token/], ['maxTokens', -1, /Token/]]) {
    assert.throws(() => store.saveTask({ ...input, [key]: value }), pattern);
  }
  const id = store.saveTask(input);
  assert.equal(store.getTask(id).configSnapshot.concurrency, 6);
  assert.equal(store.getTask(id).configSnapshot.maxTokens, 4096);
  store.saveTask({ id, name: input.name, concurrency: 8, maxTokens: 8192 });
  const changed = store.getTask(id);
  assert.equal(changed.configSnapshot.concurrency, 8);
  assert.equal(changed.configSnapshot.maxTokens, 8192);
  const copied = store.getTask(store.copyTask(id));
  assert.equal(copied.status, 'draft');
  assert.equal(copied.configSnapshot.concurrency, 8);
  assert.equal(copied.configSnapshot.maxTokens, 8192);
});

test('deleting local and historical tasks retains page visibility while preserving replay sources and restoration', () => {
  const id = store.saveTask({ name: 'Delete independent task', sourceTaskId: source.id });
  store.deleteTask(id);
  assert.equal(store.getTask(id), null);
  assert.ok(!store.listTasks().some(t => t.id === id));
  const restoredRepository = taskRepository();
  assert.equal(restoredRepository.get(id), null);
  assert.equal(restoredRepository.get(id, { includeDeleted: true }).status, 'ready');
  assert.equal(restoredRepository.isDeleted(id), true);
  store.restoreTask(id);
  assert.equal(store.getTask(id).status, 'ready');
  store.deleteTask(source.id);
  assert.equal(store.getTask(source.id), null);
  assert.ok(!store.listReports().some(r => r.taskId === source.id));
  assert.ok(store.listTaskTemplates().some(t => t.id === source.id));
  store.startTask(id);
  store.advanceTaskReplay(id, 'model', 99999);
  assert.equal(store.getTask(id).agg.breach, source.breach);
  store.restoreTask(source.id);
  assert.equal(store.getTask(source.id).units.length, 80);

  const agentSource = agentTasks.find(task => task.id === 'task-agt-b5-dc-baseline');
  store.deleteTask(agentSource.id, 'agent');
  assert.equal(store.getAgentTask(agentSource.id), null);
  assert.ok(!store.listAgentTasks().some(t => t.id === agentSource.id));
  store.restoreTask(agentSource.id, 'agent');
  assert.equal(store.getAgentTask(agentSource.id).id, agentSource.id);
});

test('running deletion is atomic, cancels its timer and restores without restarting', () => {
  const memory = new Map(), pending = new Map();
  let denied = false, serial = 0;
  const localStorage = { getItem: key => memory.get(key) ?? null, setItem(key, value) { if (denied) throw Error('quota'); memory.set(key, value); } };
  const repository = createTaskRepository(localStorage);
  const service = createTaskService({ modelTasks: tasks, modelUnits: units, agentTasks, agentUnits,
    nowText: () => '2026-11-19 14:00', repository: () => repository });
  const nativeSet = globalThis.setTimeout, nativeClear = globalThis.clearTimeout;
  globalThis.setTimeout = fn => { pending.set(++serial, fn); return serial; };
  globalThis.clearTimeout = id => pending.delete(id);
  let cleanup;
  try {
    const id = service.saveTask({ name: 'Delete active task', sourceTaskId: source.id });
    cleanup = service.initializeTaskRuntime();
    service.startTask(id);
    assert.equal(repository.get(id).status, 'running');
    assert.equal(pending.size, 1);
    denied = true;
    assert.throws(() => service.deleteTask(id), /保存失败/);
    assert.equal(repository.get(id).status, 'running');
    assert.equal(pending.size, 1);
    denied = false;
    service.deleteTask(id);
    assert.equal(pending.size, 0);
    assert.equal(repository.get(id), null);
    assert.equal(createTaskRepository(localStorage).get(id), null);
    service.initializeTaskRuntime();
    assert.equal(pending.size, 0);
    service.restoreTask(id);
    assert.equal(repository.get(id).status, 'stopped');
    assert.equal(pending.size, 0);
  } finally { cleanup?.(); globalThis.setTimeout = nativeSet; globalThis.clearTimeout = nativeClear; }
});

test('legacy starting archives normalize to running before runtime or pages read them', () => {
  const record = { ...source, id: 'legacy-starting', sourceTaskId: source.id, status: 'starting', replayCursor: 1 };
  const legacy = createTaskRepository({ getItem: () => JSON.stringify({ version: 1, tasks: [record] }), setItem() {} });
  assert.equal(legacy.get(record.id).status, 'running');
  assert.equal(legacy.list()[0].status, 'running');
});

test('copying every task state creates a clean independent draft with the complete configuration', () => {
  for (const type of ['model', 'agent']) {
    const template = type === 'model' ? source : agentTasks.find(t => t.id === 'task-agt-b5-dc-universal');
    const id = store.saveTask({ name: `Copy source ${type}`, objectType: type, sourceTaskId: template.id });
    const repository = taskRepository(), originalRecord = repository.get(id);
    const config = structuredClone(originalRecord.configSnapshot);
    if (type === 'agent') { config.evaluationMode = 'llm'; config.evalStrategy = 'llm'; }
    config.concurrency = 7;
    config.targetTimeout = 321;
    if (type === 'model') config.methods[0].params = [['自定义参数', '保留原始快照']];
    else { config.injectionSurfaceIds=['dcode-user']; config.requestedSurfaces=template.requestedSurfaces.filter(surface=>surface.id==='dcode-user'); }
    for (const status of ['draft','ready','running','done','stopped','error']) {
      repository.put({ ...originalRecord, ...config, configSnapshot: config, status, replayCursor: 4, wizardStep: 4, wizardVisited: 4,
        executionSnapshot: { sentinel: 'do not copy' }, replaySourceName: 'do not copy', startedAt: 'old-start', finishedAt: 'old-finish' });
      const copiedId = store.copyTask(id, type), record = repository.get(copiedId);
      assert.equal(record.status,'draft');
      assert.equal(record.sourceTaskId,null);
      assert.equal(record.replayCursor,0);
      assert.equal(record.wizardStep,0);
      assert.equal(record.wizardVisited,0);
      assert.equal(record.startedAt,'');assert.equal(record.finishedAt,'');
      assert.equal(record.executionSnapshot,undefined);
      assert.equal(record.replaySourceName,undefined);
      assert.deepEqual(record.configSnapshot,config);
      const projected=type==='agent'?store.getAgentTask(copiedId):store.getTask(copiedId);
      assert.equal(projected.status,'draft');assert.equal(projected.units.length,0);assert.deepEqual(projected.logs,[]);
      assert.equal(repository.get(id).status,status,'copy must leave its source unchanged');
      record.configSnapshot.concurrency=88;
      assert.equal(repository.get(copiedId).configSnapshot.concurrency,7,'repository values are independent');
    }
    const one=store.copyTask(id,type),two=store.copyTask(id,type);
    assert.notEqual(repository.get(one).name,repository.get(two).name);
    assert.match(repository.get(two).name,/副本 \d+$/);
    store.saveTask({ id: one, name: `Confirmed copy ${type}`, objectType: type, ...(type==='agent'?{evaluationMode:'llm',judgeId:'mdl-qwen-flash'}:{}) });
    if(type==='agent') {
      assert.deepEqual(repository.get(one).configSnapshot.injectionSurfaceIds,config.injectionSurfaceIds);
      assert.throws(()=>store.startTask(one,type),/注入范围.*历史案例/);
      assert.equal(repository.get(one).status,'ready');
      continue;
    }
    assert.deepEqual(repository.get(one).configSnapshot,config,'confirmation keeps copied method parameters');
    store.startTask(one,type);
    assert.equal(repository.get(one).status,'running');
    assert.equal(repository.get(one).sourceTaskId,template.id);
    assert.deepEqual(repository.get(one).configSnapshot,config,'starting binds evidence without replacing configuration');
    store.stopTask(one,type);
  }
});

test('editing copied roles preserves red-team snapshot until the strategy changes', () => {
  const id = store.copyTask(source.id), repository = taskRepository();
  const originalRecord = repository.get(id), snapshot = structuredClone(originalRecord.configSnapshot);
  snapshot.bankName = 'Saved bank scope'; snapshot.bankCount = 7; snapshot.total = 28;
  snapshot.methods[0].params = [['快照参数', 'saved-only']];
  snapshot.concurrency = 7;
  repository.put({ ...originalRecord, ...snapshot, configSnapshot: snapshot });
  store.saveTask({ id, name: 'Snapshot roles changed', objectType: 'model', targetId: 'mdl-deepseek-chat',
    judgeId: 'mdl-deepseek-v4-pro', guardEnabled: false, guardStages: [] });
  const changed = repository.get(id).configSnapshot;
  assert.equal(changed.targetId, 'mdl-deepseek-chat');
  assert.equal(changed.judgeId, 'mdl-deepseek-v4-pro');
  assert.equal(changed.guardId, null);
  for (const key of ['methods', 'bankName', 'bankCount', 'total', 'concurrency']) assert.deepEqual(changed[key], snapshot[key]);
  const alternate = { ...structuredClone(store.strategies[0]), id: 'snapshot-alternate', name: 'Alternate snapshot strategy' };
  alternate.banks[0].count = 3;
  store.strategies.push(alternate);
  try {
    store.saveTask({ id, name: 'Snapshot strategy changed', objectType: 'model', strategyId: alternate.id });
    const updated = repository.get(id).configSnapshot;
    assert.equal(updated.strategyId, alternate.id);
    assert.equal(updated.bankCount, 3);
    assert.equal(updated.total, 12);
    assert.doesNotMatch(JSON.stringify(updated.methods), /saved-only/);
    assert.equal(updated.concurrency, 7);
    assert.equal(updated.targetId, changed.targetId);
    assert.equal(updated.judgeId, changed.judgeId);
  } finally { store.strategies.splice(store.strategies.indexOf(alternate), 1); }
});
