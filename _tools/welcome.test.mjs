import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { initialResources } from '../src/domain/welcome.js';
import { welcomePage, mountWelcome } from '../src/pages/welcome.js';
import { listPlatformConnections, getPlatformConnection, listPlatformSyncedAssets } from '../src/domain/asset-intake.js';
import { listResultLevelRules, toggleResultLevelRule } from '../src/domain/result-level-rules.js';
import * as router from '../src/core/router.js';

test('workbench renders time filters, connected platforms and model/Agent average columns', () => {
  const dom = new JSDOM(welcomePage());
  const doc = dom.window.document;
  try {
    assert.equal(doc.querySelector('h1').textContent, '首页');
    assert.equal(doc.querySelector('#ps-arena, canvas'), null);
    assert.equal(doc.querySelector('.wb-type-seg'), null);
    assert.deepEqual([...doc.querySelectorAll('.wb-time-seg button')].map(button => button.textContent), ['近3天', '7天', '1个月']);
    assert.equal(doc.querySelector('.wb-time-seg [aria-pressed="true"]').textContent, '1个月');
    assert.equal(doc.querySelectorAll('.wb-kpi').length, 4);
    assert.match(doc.querySelector('.wb-kpi').textContent, /演练对象数量.*模型 \d+ 个.*智能体 \d+ 个.*代码包 \d+ 个.*代码包为演示数量/s);
    assert.match(doc.querySelectorAll('.wb-kpi')[2].textContent, /进行中演练任务/);
    assert.deepEqual([...doc.querySelectorAll('.wb-main .wb-panel-h h2')].map(heading => heading.textContent), ['企业平台连接', '结果数据等级']);
    assert.equal(doc.querySelectorAll('.wb-main > .wb-panel').length, 2);
    assert.match(doc.querySelector('.wb-platform').textContent, /企业 AI 资产平台（演示）.*已连通.*一键同步/s);
    assert.equal(doc.querySelectorAll('.wb-notices-panel .wb-msg').length, 3);
    assert.equal(doc.querySelectorAll('.wb-notices-panel .wb-msg .wb-demo').length, 3, 'sample notices are explicitly marked as demo');
    assert.deepEqual([...doc.querySelectorAll('.wb-average-column')].map(column => column.getAttribute('aria-label')), ['模型平均指标', '智能体平均指标']);
    assert.match(doc.querySelector('.wb-average-column.model').textContent, /执行成功率.*平均任务耗时.*平均 Token 用量.*攻击成功率.*最高攻击方法攻破率.*最高场景攻破率.*已演练题目.*已演练方法/s);
    assert.match(doc.querySelector('.wb-average-column.agent').textContent, /攻击成功率.*疑似注入采纳率.*任务完成率.*已演练环境/s);
    const dispose = mountWelcome(); dispose(); dispose();
  } finally { dom.window.close(); }
});

test('platform resource cards exclude user resources and empty Agent catalogs', () => {
  const catalogs = {
    banks: [{ name: 'Built-in model bank', source: 'system', items: [1] }, { name: 'Private model bank', source: 'custom', items: [1] }],
    sceneBanks: [{ name: 'Built-in Agent bank', source: 'system', items: [1, 2] }, { name: 'Empty bank', source: 'system', items: [] }],
  };
  const original = structuredClone(catalogs);
  assert.deepEqual(initialResources(catalogs), [
    { name: 'Built-in model bank', kind: '模型攻击题库', page: 'strategy', sub: 'banks' },
    { name: 'Built-in Agent bank', kind: 'Agent 场景题库 · 2 题', page: 'strategy', sub: 'scenebanks' },
  ]);
  assert.deepEqual(catalogs, original);
});

test('home actions and navigation open asset intake, task creation and the current resource library', async () => {
  const NativeDate = globalThis.Date, fixedNow = NativeDate.parse('2026-11-24T12:00:00+08:00');
  globalThis.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [fixedNow])); }
    static now() { return fixedNow; }
  };
  const dom = new JSDOM(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), {
    url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'dangerously',
  });
  globalThis.window = dom.window;
  for (const key of ['document', 'location', 'history', 'HTMLElement', 'Node', 'Event', 'CustomEvent', 'getComputedStyle', 'localStorage']) globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
  globalThis.matchMedia = () => ({ matches: true });
  delete globalThis.WebGLRenderingContext;
  try {
    await import('../src/main.js');
    assert.equal(document.querySelector('.top-nav button.active').textContent, '首页');
    assert.deepEqual([...document.querySelectorAll('.top-nav button')].map(el=>el.textContent.trim()), ['首页','演练场','演练策略','设置']);
    const clickRange = label => [...document.querySelectorAll('.wb-time-seg button')].find(button => button.textContent === label).click();
    clickRange('近3天');
    assert.equal(document.querySelector('.wb-time-seg [aria-pressed="true"]').textContent, '近3天');
    assert.equal(document.querySelectorAll('.wb-period-empty').length, 2, 'recent window has no archived completed tasks');
    clickRange('7天');
    assert.ok(document.querySelector('.wb-average-column.model .wb-period-empty'));
    assert.equal(document.querySelector('.wb-average-column.agent .wb-period-empty'), null);
    assert.match(document.querySelector('.wb-average-column.agent header').textContent, /2 个已完成任务/);
    clickRange('1个月');
    assert.equal(document.querySelectorAll('.wb-period-empty').length, 0);
    assert.match(document.querySelector('.wb-average-column.model header').textContent, /3 个已完成任务/);

    const platform = listPlatformConnections().find(row => row.state === 'connected');
    const beforeSync = platform.lastSyncedAt;
    [...document.querySelectorAll('.wb-platform button')].find(button => button.textContent.trim() === '一键同步').click();
    assert.equal(router.state().page, 'home');
    assert.equal(router.state().sub, 'home');
    const synced = getPlatformConnection(platform.id);
    assert.notEqual(synced.lastSyncedAt, beforeSync);
    assert.equal(synced.lastSyncedAt, '2026-11-24T04:00:00.000Z');
    assert.ok(listPlatformSyncedAssets(platform.id).every(asset => asset.lastSyncedAt === synced.lastSyncedAt));
    assert.match(document.querySelector('.wb-platform-info').textContent, /最近同步.*12:00/);

    const modelRule = listResultLevelRules().find(rule => rule.metricId === 'model.asr' && rule.enabled);
    assert.ok(modelRule);
    toggleResultLevelRule(modelRule.id);
    try {
      clickRange('1个月');
      assert.equal(document.querySelectorAll('.wb-msg').length, 0);
      assert.match(document.querySelector('.wb-notices-panel').textContent, /暂无启用的模型 ASR 规则/);
    } finally { toggleResultLevelRule(modelRule.id); }
    clickRange('1个月');
    assert.equal(document.querySelectorAll('.wb-msg').length, 3);

    // A prior visit to another intake tab must not affect the homepage's connector shortcut.
    window.App.go('platform', 'intake');
    window.App.aiTab('models');
    document.querySelector('.brand').click();
    [...document.querySelectorAll('.wb-connect-actions button')].find(el => el.textContent.includes('去配置连接')).click();
    assert.equal(router.state().page, 'platform');assert.equal(router.state().sub, 'intake');
    assert.deepEqual([...document.querySelectorAll('[role="tab"]')].map(el=>el.textContent.trim()), ['企业资产平台连接','人工上传','模型接入配置']);
    assert.equal(document.querySelector('[role="tab"][aria-selected="true"]').textContent, '企业资产平台连接');
    [...document.querySelectorAll('.ai-connection-panel button')].find(el=>el.textContent.trim()==='连接资产平台').click();
    assert.equal(router.state().page, 'platform');assert.equal(router.state().sub, 'connection-create');
    assert.match(document.querySelector('main .pc-page h1').textContent, /连接资产平台/);
    assert.equal(document.querySelectorAll('main .ai-wizard-steps li').length,5);
    assert.equal(document.querySelector('#modal').classList.contains('open'),false);
    window.App.pcCancel();
    assert.equal(router.state().sub,'intake');
    window.App.wbCreate();
    const agentButton = [...document.querySelectorAll('#modal .wb-entry-grid button')].find(el => el.textContent.includes('智能体'));
    agentButton.click();
    assert.equal(router.state().page, 'agent');
    assert.equal(router.state().sub, 'ag-task-create');
    document.querySelector('.brand').click();
    assert.equal(router.state().page, 'home');
    window.App.go('strategy', 'attack');
    assert.deepEqual([...document.querySelectorAll('.v4-tabs button')].map(el=>el.textContent.trim()), ['组合攻击策略','方法库','题库']);
    window.App.go('agent','ag-tasks');
    assert.equal(document.querySelectorAll('main tbody tr').length,2);
    assert.ok([...document.querySelectorAll('main tbody tr')].every(row=>row.textContent.includes('Deep Agents')));
    window.App.go('posture', 'home');
    assert.equal(document.querySelector('main h1').textContent, '资产接入');
    assert.equal(document.querySelector('#ps-arena'),null);
    document.querySelector('.brand').click();
    assert.ok(document.querySelector('#welcome-root'));
  } finally {
    window.dispatchEvent(new Event('pagehide'));
    dom.window.close();
    globalThis.Date = NativeDate;
  }
});
