import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { posturePage, mountPosture, postureSequences, actions } from '../src/pages/posture.js';
import { welcomeArena } from '../src/pages/welcome.js';
import { welcomeSequences } from '../src/domain/welcome.js';
import { exerciseArena } from '../src/core/exercise-arena.js';
import * as store from '../src/domain/store.js';
import { meanTaskAsr } from '../src/domain/metrics.js';

const settle = () => new Promise(resolve => setImmediate(resolve));

test('asset ASR averages tasks equally and excludes missing judgments', () => {
  assert.equal(meanTaskAsr([{value: .2, judged: 5}, {value: .8, judged: 100}, {value: 0, judged: 0}]), .5);
  assert.equal(meanTaskAsr([{value: 0, judged: 0}]), null);
  assert.equal(meanTaskAsr([]), null);
  assert.equal(meanTaskAsr([{value: 0, judged: 4}]), 0);
  const assets = store.postureBoard().assets;
  assert.equal(assets.find(asset => asset.name === 'Qwen-Flash')?.asr, .1375);
  assert.equal(assets.find(asset => asset.name === 'Qwen Code · DeepSeek-Flash')?.asr, .1);
});

test('populated posture preserves real metrics, risks and assets while canvas explains the shared generic flow', async () => {
  const dom = new JSDOM(`<main>${posturePage()}</main>`);
  globalThis.document = dom.window.document;
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.WebGLRenderingContext = function() {};
  const created = [], disposed = [];
  const sceneLoader = async () => Object.fromEntries(['Model','Agent'].map(kind => [`create${kind}Scene`, (host, options) => {
    created.push({ kind, options });
    const canvas = document.createElement('canvas'); host.append(canvas);
    return { reset() {}, load(unit) { assert.deepEqual(unit.steps, []); }, focus() {}, dispose() { disposed.push(kind); canvas.remove(); } };
  }]));
  let cleanup;
  try {
    const board = store.postureBoard(30);
    assert.equal(document.querySelectorAll('.ps-arena').length, 1);
    assert.deepEqual([...document.querySelectorAll('.ps-metric-v')].map(el => el.textContent), board.metrics.map(metric => String(metric.value)));
    assert.equal(document.querySelectorAll('#ps-risk-card .ps-risk').length, Math.min(3, board.risks.length));
    assert.equal(document.querySelectorAll('#ps-assets-card .ps-row').length, board.assets.length);
    for (const asset of board.assets) assert.ok(document.querySelector('#ps-assets-card').textContent.includes(asset.name));
    assert.doesNotMatch(document.querySelector('.ps-overview').textContent, /等待接入|尚未评估|待首次演练/);
    assert.deepEqual([...document.querySelector('.ps-overview').children].map(el => el.id), ['ps-risk-card','ps-assets-card']);
    const metricsBefore = document.querySelector('#ps-metrics').innerHTML;
    const overviewBefore = document.querySelector('.ps-overview').innerHTML;
    cleanup = mountPosture(document, { sceneLoader });
    await settle();
    assert.equal(document.querySelector('#ps-arena').dataset.view, 'model');
    assert.equal(document.querySelectorAll('canvas').length, 1);
    const packets = document.querySelectorAll('#ps-process-lines .ps-output');
    assert.equal(packets.length, Math.min(3, postureSequences('model')[0].events.length));
    assert.match(packets[packets.length - 1].textContent, /裁判评估/);
    assert.equal(document.querySelectorAll('.ps-packet-current').length, 1);
    assert.equal(document.querySelectorAll('.ps-flow-ambience>i').length, 12);
    assert.equal(document.querySelector('.wh-onboarding'), null);
    actions.psToggle(); await settle();
    assert.equal(document.querySelector('#ps-arena').dataset.view, 'agent');
    assert.equal(document.querySelectorAll('canvas').length, 1);
    assert.match(document.querySelector('#ps-process-lines').textContent, /没有实际演练时不生成结果/);
    assert.equal(document.querySelector('.ps-agent-assessment, .ps-verdict'), null);
    assert.ok(document.querySelector('#ps-process-lines .ps-stage-list'));
    assert.equal(document.querySelectorAll('.ps-stage[aria-current="step"]').length, 1);
    assert.equal(document.querySelector('#ps-metrics').innerHTML, metricsBefore);
    assert.equal(document.querySelector('.ps-overview').innerHTML, overviewBefore);
    assert.deepEqual(disposed, ['Model']);
    assert.ok(created.every(item => item.options.appearance === 'light' && item.options.compact && item.options.frameFromCSS));
    cleanup();
    assert.deepEqual(disposed, ['Model','Agent']);
  } finally { cleanup?.(); dom.window.close(); }
});

test('unmounted posture ignores a pending scene load', async () => {
  const dom = new JSDOM(`<main>${posturePage()}</main>`);
  globalThis.document = dom.window.document;
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.WebGLRenderingContext = function() {};
  let release, calls = 0;
  const cleanup = mountPosture(document, { sceneLoader: () => new Promise(resolve => { release = resolve; }) });
  cleanup();
  release({ createModelScene() { calls += 1; } });
  await settle();
  assert.equal(calls, 0);
  assert.equal(document.querySelector('canvas'), null);
  dom.window.close();
});

test('initial and populated pages share the same arena and sequences without replaying tasks', () => {
  assert.equal(postureSequences, welcomeSequences, 'both pages use one sequence provider');
  const realTasks = [...store.listTasks(), ...store.listAgentTasks()];
  for (const type of ['model', 'agent']) {
    const initial = new JSDOM(welcomeArena(type));
    const populated = new JSDOM(exerciseArena(type));
    assert.equal(initial.window.document.querySelector('.ps-arena-h').outerHTML, populated.window.document.querySelector('.ps-arena-h').outerHTML);
    assert.equal(initial.window.document.querySelector('.ps-arena-body').outerHTML, populated.window.document.querySelector('.ps-arena-body').outerHTML);
    assert.ok(initial.window.document.querySelector('.wh-onboarding'));
    assert.equal(populated.window.document.querySelector('.wh-onboarding'), null);
    initial.window.close(); populated.window.close();
    const sequences = postureSequences(type);
    const serialized = JSON.stringify(sequences);
    assert.doesNotMatch(serialized, /已攻破|未攻破|已守住|\d+(?:\.\d+)?%|task-agt-|task-tgt-|openart-mid-/);
    for (const task of realTasks) {
      assert.equal(serialized.includes(task.name), false);
      assert.equal(serialized.includes(task.targetName), false);
    }
    for (const sequence of sequences) {
      assert.equal(sequence.verdict, undefined);
      assert.equal(sequence.scene?.verdict, undefined);
      assert.ok(sequence.events.every(event => !event.verdict && event.phase !== 'assessment'));
      if (type === 'agent') assert.deepEqual(sequence.scene.steps, []);
    }
  }
});

test('generic model flow includes optional guards and explains evaluation after target response', () => {
  const [sequence] = postureSequences('model');
  assert.deepEqual(sequence.events.map(event => event.role), ['src', 'input_guard', 'tgt', 'output_guard', 'judge']);
  assert.match(sequence.events[1].label, /输入侧防护（可选）/);
  assert.match(sequence.events[3].label, /输出侧防护（可选）/);
  assert.match(sequence.events.at(-1).text, /实际输入与响应.*任务完成后/);
  assert.ok(sequence.events.every(event => event.verdict === undefined && event.blocked === undefined));
});

test('Agent flow explains only the current stage and never emits verdicts; range changes preserve its runtime', async () => {
  const dom = new JSDOM(`<main>${posturePage()}</main>`);
  globalThis.document = dom.window.document;
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.WebGLRenderingContext = function() {};
  const nativeSet = globalThis.setTimeout, nativeClear = globalThis.clearTimeout;
  const pending = new Map(), verdicts = [];
  let serial = 0, cleanup;
  globalThis.setTimeout = (fn, delay) => { pending.set(++serial, { fn, delay }); return serial; };
  globalThis.clearTimeout = id => pending.delete(id);
  const sceneLoader = async () => ({
    createModelScene: () => ({ reset() {}, focus() {}, attack() {}, reply() {}, judge(value) { verdicts.push(value); }, dispose() {} }),
    createAgentScene: () => ({ load() {}, focus(key, options) { assert.equal(options.callout, false); }, inject() {}, outputs() {}, verdict(value) { verdicts.push(value); }, dispose() {} }),
  });
  const advance = () => {
    assert.equal(pending.size, 1, 'one active homepage timer');
    const [id, timer] = pending.entries().next().value;
    pending.delete(id); timer.fn();
    return timer.delay;
  };
  try {
    cleanup = mountPosture(document, { sceneLoader }); await settle();
    actions.psToggle(); await settle();
    const sequence = postureSequences('agent')[0];
    assert.deepEqual(sequence.events.map(event => event.label), ['准备题目', '布置攻击', '靶标执行', '裁判评估']);
    for (const event of sequence.events) {
      const flow = document.querySelector('#ps-process-lines');
      assert.equal(flow.dataset.phase, 'guide');
      assert.equal(flow.querySelector('.ps-stage.current span:last-child').textContent, event.label);
      assert.equal(flow.querySelector('.ps-stage-current p').textContent, event.text);
      const actualCards = [...flow.querySelectorAll('.ps-agent-card')];
      assert.equal(actualCards.length, event.content.length);
      actualCards.forEach((card, i) => {
        assert.equal(card.querySelector('h3').textContent, event.content[i].label);
        assert.equal(card.querySelector('p').textContent, event.content[i].text);
      });
      assert.equal(flow.querySelector('.ps-agent-assessment, .ps-verdict'), null);
      const flowBefore = flow.innerHTML;
      const timerBefore = [...pending.keys()];
      actions.psRange(7);
      assert.equal(flow.innerHTML, flowBefore, 'time-range filtering only updates populated data modules');
      assert.deepEqual([...pending.keys()], timerBefore);
      const board = store.postureBoard(7);
      assert.deepEqual([...document.querySelectorAll('.ps-metric-v')].map(el => el.textContent), board.metrics.map(metric => String(metric.value)));
      assert.ok(advance() >= 4000);
    }
    assert.deepEqual(verdicts, []);
    assert.match(document.querySelector('.ps-stage.current').textContent, /准备题目/);
    cleanup();
    assert.equal(pending.size, 0);
  } finally {
    cleanup?.(); actions.psRange(30);
    globalThis.setTimeout = nativeSet; globalThis.clearTimeout = nativeClear;
    dom.window.close();
  }
});
