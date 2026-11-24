import test from 'node:test';
import assert from 'node:assert/strict';
import { taskOutcomeCards } from '../src/pages/task-metrics.js';
import { getResultLevelRule, saveResultLevelRule, toggleResultLevelRule, newResultLevelRule } from '../src/domain/result-level-rules.js';

const task={objectType:'model',status:'done',total:10,units:Array.from({length:10},(_,i)=>({id:`rule-${i}`,judgeSuccess:i<7,method:'Direct',scenarioId:'permissions',scenarioName:'权限'}))};
test('result card grade follows the configured ASR thresholds and disappears when the rule is disabled',()=>{
  const original=getResultLevelRule('result-model-asr');
  assert.match(taskOutcomeCards(task),/一级 · 高危/);
  saveResultLevelRule({...original,count:5,thresholds:[20,40,60,80],names:['最高','较高','中等','较低','最低']});
  const revised=taskOutcomeCards(task);
  assert.match(revised,/二级 · 较高/);assert.match(revised,/70\.0%/);
  toggleResultLevelRule(original.id);
  assert.doesNotMatch(taskOutcomeCards(task),/result-level-badge/);
  saveResultLevelRule(original);
});
test('unknown metrics cannot inherit a low-risk grade and an additional configured result is rendered',()=>{
  assert.doesNotMatch(taskOutcomeCards({...task,units:[]}),/result-level-badge/);
  saveResultLevelRule({...newResultLevelRule('model.maxMethodAsr'),name:'最高方法分级'});
  const html=taskOutcomeCards(task);
  assert.equal((html.match(/class="result-level-badge"/g)||[]).length,2);
});
