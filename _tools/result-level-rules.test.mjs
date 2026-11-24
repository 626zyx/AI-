import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as R from '../src/domain/result-level-rules.js';

test('ASR grading covers each boundary exactly once and never grades missing evidence', () => {
  for (const [value, name] of [[0, '低危'], [0.299, '低危'], [0.3, '中危'], [0.699, '中危'], [0.7, '高危'], [1, '高危']]) assert.equal(R.resolveResultLevel('model.asr', value).name, name);
  for (const value of [null, undefined, NaN, Infinity, -0.1, 1.1, '', '0']) assert.equal(R.resolveResultLevel('model.asr', value), null);
  assert.equal(R.resolveResultLevel('agent.asr', 0.8), null, 'model rule must never leak into Agent interpretation');
  assert.equal(R.listResultLevelRules().length, 1, 'only one result rule is seeded');
});

test('three to five levels preserve ascending boundaries with reverse direction for completion', () => {
  for (const count of [3, 4, 5]) {
    const rule = { ...R.newResultLevelRule('agent.completionRate', count), name: `完成率${count}级` };
    const saved = R.saveResultLevelRule(rule);
    assert.equal(R.resolveResultLevel(saved.metricId, 0).index, 1);
    assert.equal(R.resolveResultLevel(saved.metricId, 1).index, count);
    for (let i = 0; i < saved.thresholds.length; i++) assert.equal(R.resolveResultLevel(saved.metricId, saved.thresholds[i] / 100).index, i + 2);
    assert.equal(R.resultRuleLevels(saved).length, count);
    assert.equal(R.resultRuleLevels(saved)[0].color, '#a51f36');
    assert.equal(R.resultRuleLevels(saved).at(-1).color, '#25865f');
    R.deleteResultLevelRule(saved.id);
  }
});

test('invalid ranges, names and conflicting enabled rules cannot alter saved grading', () => {
  const baseline = R.getResultLevelRule('result-model-asr');
  for (const changes of [{ count: 2 }, { thresholds: [30, 30] }, { thresholds: [70, 30] }, { thresholds: [0, 70] }, { thresholds: [30, 100] }, { thresholds: ['', 70] }, { names: ['重复', '重复', '低'] }]) assert.throws(() => R.saveResultLevelRule({ ...baseline, ...changes }));
  assert.deepEqual(R.getResultLevelRule('result-model-asr'), baseline);
  assert.throws(() => R.saveResultLevelRule({ ...R.newResultLevelRule(), name: '冲突的ASR' }), /已有启用规则/);
  const disabled = R.saveResultLevelRule({ ...R.newResultLevelRule(), name: '备用ASR规则', enabled: false });
  assert.throws(() => R.toggleResultLevelRule(disabled.id), /已有启用规则/);
  R.toggleResultLevelRule(baseline.id);
  assert.equal(R.resolveResultLevel('model.asr', 0.8), null);
  R.toggleResultLevelRule(disabled.id);
  assert.equal(R.resolveResultLevel('model.asr', 0.8).ruleId, disabled.id);
  R.deleteResultLevelRule(disabled.id);
  assert.equal(R.resolveResultLevel('model.asr', 0.8), null);
  R.toggleResultLevelRule(baseline.id);
});

test('decimal thresholds do not misclassify the exact percentage boundary', () => {
  const rule = R.saveResultLevelRule({ ...R.newResultLevelRule('model.maxMethodAsr'), name: '小数边界', thresholds: [29, 70.3] });
  assert.equal(R.resolveResultLevel(rule.metricId, 0.29).index, 2);
  assert.equal(R.resolveResultLevel(rule.metricId, 0.703).index, 1);
  R.deleteResultLevelRule(rule.id);
});

test('result rule form edits metric and level count and saves only valid mappings', async () => {
  const dom = new JSDOM('<main></main><div id="modal" class="overlay"></div><div id="drawer"></div><div id="toast"></div>', { url: 'http://localhost/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  const page = await import('../src/pages/result-level-rules.js');
  const badges = await import('../src/core/result-level-badge.js');
  try {
    document.querySelector('main').innerHTML = page.dataRulePage();
    assert.match(document.querySelector('main').textContent, /模型演练 ASR 分级/);
    assert.doesNotMatch(document.querySelector('main').textContent, /绝密|机密|关键词|命中维度/);
    assert.equal(document.querySelectorAll('main .result-level-badge').length, 3);
    assert.match(document.querySelector('main').textContent, /编辑.*停用.*删除/);
    page.actions.dlEdit();
    assert.ok(document.querySelector('#drawer.open .dl-drawer'));
    assert.equal(document.getElementById('modal').classList.contains('open'), false);
    page.actions.dlField('name', 'UI业务完成率分级');
    page.actions.dlMetric('agent.completionRate');
    page.actions.dlCount(5);
    assert.equal(document.querySelectorAll('.dl-level-row').length, 5);
    assert.equal(document.getElementById('dl-name').value, 'UI业务完成率分级');
    assert.equal(document.getElementById('dl-direction').value, 'low');
    page.actions.dlThreshold(0, '50');
    page.actions.dlSave();
    assert.match(document.getElementById('dl-error').textContent, /从小到大/);
    page.actions.dlThreshold(0, '10');
    page.actions.dlName(0, '严重不足');
    page.actions.dlSave();
    const saved = R.listResultLevelRules().find(rule => rule.name === 'UI业务完成率分级');
    assert.equal(document.getElementById('drawer').classList.contains('open'), false);
    assert.equal(saved.count, 5);
    assert.equal(R.resolveResultLevel('agent.completionRate', 0.05).name, '严重不足');
    assert.match(badges.renderResultLevelBadge('agent.completionRate', 0.05), /严重不足/);
    assert.equal(badges.renderResultLevelBadge('agent.completionRate', null), '');
    page.actions.dlDelete(saved.id);
    assert.match(document.getElementById('modal').textContent, /删除数据等级规则/);
    page.actions.dlDeleteConfirm(saved.id);
    assert.equal(R.getResultLevelRule(saved.id), null);
  } finally { dom.window.close(); }
});
