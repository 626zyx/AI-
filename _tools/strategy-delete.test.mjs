import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as store from '../src/domain/store.js';
import { taskRepository } from '../src/domain/task-repository.js';
import { reportDetailPage } from '../src/pages/reports.js';
import { agentReportDetailPage } from '../src/pages/agent-reports.js';
import { configSummary, mountTaskConfig } from '../src/core/task-config.js';
import { taskWizardPage } from '../src/pages/task-wizard.js';

for (const type of ['model', 'agent']) {
  test(`${type} published strategy deletion blocks new use while preserving active and historical evidence`, () => {
    const catalog = type === 'agent' ? store.agentStrategies : store.strategies;
    const getTask = type === 'agent' ? store.getAgentTask : store.getTask;
    const remove = type === 'agent' ? store.deleteAgentStrategy : store.deleteStrategy;
    const saveStrategy = type === 'agent' ? store.saveAgentStrategy : store.saveStrategy;
    const historical = store.listTaskTemplates(type).find(task => type === 'model' || task.technique === 'universal');
    const strategy = catalog.find(item => item.id === historical.strategyId);
    const index = catalog.indexOf(strategy);
    const originalHistory = getTask(historical.id);
    const originalUnits = structuredClone(originalHistory.units);
    const input = type === 'model'
      ? { objectType: type, targetId: 'mdl-qwen-flash', strategyId: strategy.id, judgeId: 'mdl-deepseek-flash', guardEnabled: false }
      : { objectType: type, targetId: 'agt-qwen-ds-flash', strategyId: strategy.id, judgeId: 'mdl-deepseek-v4-pro', injectionSurfaceIds: ['qwen-project'] };
    const ready = store.saveTask({...input, name: `${type} removed strategy ready`});
    const draft = store.saveTask({...input, name: `${type} removed strategy draft`, wizardStep:1, wizardVisited:1}, {draft:true});
    const running = store.saveTask({...input, name: `${type} removed strategy running`});
    const legacy = store.saveTask({objectType:type, sourceTaskId:historical.id, name:`${type} removed strategy legacy`});
    store.startTask(running, type);
    const before = structuredClone(getTask(running).configSnapshot);
    let replacement;
    try {
      remove(strategy.id);
      assert.equal(catalog.some(item => item.id === strategy.id), false);
      const wizard = taskWizardPage({page:type === 'agent' ? 'agent' : 'exercise',param:draft});
      assert.match(wizard, /原红队策略已删除或不可用，请重新选择已发布策略/);
      assert.match(wizard, /已删除或不可用，请重选/);
      const readyWizard = taskWizardPage({page:type === 'agent' ? 'agent' : 'exercise',param:ready});
      assert.match(readyWizard, /已删除或不可用，请重选/);
      assert.throws(() => store.saveTask({...input, name:`${type} removed new`}), /已发布|已删除|不可用/);
      assert.throws(() => store.saveTask({objectType:type, sourceTaskId:historical.id, name:`${type} removed legacy new`}), /已删除|不可用/);
      for (const id of [ready, legacy]) {
        assert.throws(() => store.startTask(id, type), /已删除或不可用/);
        assert.equal(getTask(id).status, 'ready');
        assert.equal(taskRepository().get(id).replayCursor, 0);
      }
      assert.throws(() => store.saveTask({...input, id:draft, name:`${type} removed strategy draft`}), /已发布|已删除|不可用/);
      assert.equal(store.startTask(running, type), running, 'repeated start remains idempotent for an active run');
      store.advanceTaskReplay(running, type, 99999);
      assert.equal(getTask(running).status, 'done');
      assert.deepEqual(getTask(running).configSnapshot, before);
      assert.deepEqual(getTask(historical.id).units, originalUnits);
      const html = (type === 'agent' ? agentReportDetailPage : reportDetailPage)({param:historical.id});
      assert.match(html, /核心发现/);
      assert.ok(html.includes(historical.strategyName));
      if (type === 'model') {
        assert.deepEqual(store.recordedModelStrategy(strategy.id).methods, strategy.methods);
        const dom = new JSDOM(`${configSummary(originalHistory)}<div id="drawer"></div>`);
        const previousDocument = globalThis.document, previousWindow = globalThis.window;
        globalThis.document = dom.window.document; globalThis.window = dom.window;
        let cleanup;
        try {
          cleanup = mountTaskConfig(document);
          document.querySelector('[data-config-toggle]').click();
          assert.match(document.querySelector('#drawer').textContent, /攻击生成模型：DeepSeek-V3-Chat/);
          assert.match(document.querySelector('#drawer').textContent, /嵌套层数：5/);
        } finally { cleanup?.(); globalThis.document = previousDocument; globalThis.window = previousWindow; dom.window.close(); }
      }
      const {id, ...copy} = structuredClone(strategy);
      replacement = saveStrategy({...copy, name:`${type} replacement strategy`, status:'published'});
      store.saveTask({...input, id:ready, name:`${type} removed strategy ready`, strategyId:replacement});
      store.startTask(ready, type);
      assert.equal(getTask(ready).status, 'running');
      assert.equal(getTask(ready).configSnapshot.strategyId, replacement);
      store.stopTask(ready, type);
    } finally {
      if (!catalog.some(item => item.id === strategy.id)) catalog.splice(index, 0, strategy);
      if (replacement) remove(replacement);
    }
  });
}
