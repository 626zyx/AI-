/* Asset assessment projections share task facts; they never replace task snapshots. */
import * as store from './store.js';
import { listAssets, listAssetVersions } from './asset-intake.js';
import { gradeMetric, listGradeRules, gradeAgainstRule, gradingMetric } from './grading-rules.js';
import { taskMetricValues } from './metrics.js';
const cleanId=id=>String(id||'').replace(/^tgt-/,'mdl-').split('@')[0];
export const taskAssetId=task=>task.configSnapshot?.targetAssetId||task.targetAssetId||cleanId(task.targetId);
const GRADE_RANK={critical:5,high:4,medium:3,low:2,safe:1,unassessed:0,unknown:0};
const mostSevere=(a,b)=>(GRADE_RANK[b.key]||0)-(GRADE_RANK[a.key]||0);
/** All participating rules are evaluated independently, including several rules for one metric. */
export function assetRuleFindings(metrics,asset,rules=listGradeRules()){
 return rules.filter(rule=>rule.enabled&&rule.affectsAsset&&rule.kind===asset.kind&&(!rule.assetId||rule.assetId===asset.id))
  .filter(rule=>metrics[rule.metricKey]?.applicable!==false)
  .map(rule=>{const metric=metrics[rule.metricKey]||{};return {
   ...gradeAgainstRule(metric.value??null,rule,metric.denominator??null),
   assetId:asset.id,metricKey:rule.metricKey,metricLabel:metric.label||rule.metricKey,
   metricValue:metric.value??null,numerator:metric.numerator??null,denominator:metric.denominator??null,
   ruleSnapshot:structuredClone(rule),
  };}).sort(mostSevere);
}
function gradeFromFindings(findings){
 return findings[0]||{key:'unassessed',label:'未分级',cls:'gray',ruleName:'',condition:'没有启用且参与资产综合等级的适用规则'};
}
export function assetAssessments(asset,{rules=listGradeRules()}={}){
 const tasks=(asset.kind==='agent'?store.listAgentTasks():store.listTasks()).filter(t=>taskAssetId(t)===asset.id&&t.status==='done');
 return tasks.map(task=>{const metrics=taskMetricValues(task),gradeFindings=assetRuleFindings(metrics,asset,rules);const config=task.configSnapshot||{},version=config.targetAssetVersion||task.targetAssetVersion||'V1',snapshot=listAssetVersions(asset.id).find(v=>v.version===version),value=task.agg?.value??task.asr??null,judged=task.agg?.judged??task.judged??0;
 return {id:task.id,task,assetId:asset.id,assetName:asset.name,kind:asset.kind,version,enterpriseVersion:config.targetSnapshot?.enterpriseVersion||snapshot?.enterpriseVersion||version,current:version===asset.version,at:task.finishedAt||'',value,judged,total:task.total||0,breach:task.agg?.breach??task.breach??0,guard:config.guardName||task.guardName||'',guarded:Boolean(config.guardId||task.guardId),metrics,gradeFindings,asrGrade:gradeMetric(value,{kind:asset.kind,metricKey:'asr',assetId:asset.id,sampleSize:judged}),business:String(config.strategyName||task.strategyName||'综合评估').replace(/\s*[·｜|]\s*V?\d+(?:\.\d+)*$/i,''),grade:gradeFromFindings(gradeFindings)};
 }).sort((a,b)=>b.at.localeCompare(a.at));
}
export function assetState(asset,options={}){
 const results=assetAssessments(asset,options),current=results.filter(r=>r.current);let latest=current[0]||null;
 const active=(asset.kind==='agent'?store.listAgentTasks():store.listTasks()).filter(t=>taskAssetId(t)===asset.id&&t.status==='running');
 const exercise=active.length?'running':latest?'done':results.length?'retest':'untested';
 const latestPerScope=[...new Map([...current].reverse().map(row=>[row.business+'|'+row.guarded,row])).values()];
 const representative=[...latestPerScope].sort((a,b)=>mostSevere(a.grade,b.grade)||Number(a.guarded)-Number(b.guarded)||(b.value||0)-(a.value||0))[0]||latest;
 latest=representative;const grade=latest?.grade||{key:'unknown',label:results.length?'待复测':'未评估',cls:'gray'};
 const gradeFindings=latestPerScope.flatMap(result=>result.gradeFindings.map(finding=>({...finding,assessmentId:result.id,business:result.business,guarded:result.guarded,at:result.at}))).sort(mostSevere);
 return {...asset,results,currentResults:latestPerScope,latest,grade,gradeFindings,exercise,runningTasks:active,assessmentCoverage:latest?'current':results.length?'historical':'none'};
}
export function listAssetStates(filters={}){
 const rows=listAssets(filters).map(assetState);
 return rows.filter(a=>(!filters.exercise||filters.exercise==='all'||(filters.exercise==='pending'?['untested','retest'].includes(a.exercise):a.exercise===filters.exercise))&&(!filters.grade||filters.grade==='all'||(filters.grade==='unknown'?['unknown','unassessed'].includes(a.grade.key):a.grade.key===filters.grade)));
}
/** Preview the complete asset grade, preserving other enabled rules and every current business scope. */
export function previewAssetGradeRule(rule){
 const rules=listGradeRules(),previousRule=rules.find(item=>item.id===rule.id);
 const candidate={enabled:true,affectsAsset:true,assetId:'',...rule,id:rule.id||'__grade_preview__'};
 const nextRules=previousRule?rules.map(item=>item.id===candidate.id?candidate:item):[...rules,candidate];
 const applies=(asset,item)=>item&&asset.kind===item.kind&&(!item.assetId||asset.id===item.assetId);
 return listAssets().filter(asset=>applies(asset,candidate)||applies(asset,previousRule)).map(asset=>{
  const before=assetState(asset,{rules}),after=assetState(asset,{rules:nextRules});
  const measured=after.currentResults.map(result=>({result,metric:result.metrics[candidate.metricKey]}))
   .filter(row=>row.metric?.applicable!==false&&row.metric?.value!=null)
   .sort((a,b)=>mostSevere(gradeAgainstRule(a.metric.value,candidate,a.metric.denominator),gradeAgainstRule(b.metric.value,candidate,b.metric.denominator)))[0];
  return {assetId:asset.id,assetName:asset.name,kind:asset.kind,enterpriseVersion:asset.enterpriseVersion,
   previous:before.grade,next:after.grade,changed:before.grade.key!==after.grade.key,
   value:measured?.metric.value??null,metricLabel:measured?.metric.label||gradingMetric(candidate.metricKey)?.label||candidate.metricKey,
   numerator:measured?.metric.numerator??null,denominator:measured?.metric.denominator??null,
   previousFindings:before.gradeFindings,nextFindings:after.gradeFindings};
 });
}
function signature(result){
 const t=result.task,c=t.configSnapshot||{};
 const methods=(c.methods||t.methods||[]).map(m=>({name:m.name||m.key||m.id,params:m.params||m.parameters||[],rounds:m.rounds||m.maxRounds||null})).sort((a,b)=>a.name.localeCompare(b.name));
 return {题库:JSON.stringify(c.banks||c.bankSnapshot||t.banks||t.sceneBankId||t.bankId||t.strategyId||''),方法:JSON.stringify(methods.length?methods:t.technique||''),判定:JSON.stringify([c.judgeId||t.judgeId||'',c.judgePrompt||c.judgeRules||t.evaluationBasis||'']),防护:JSON.stringify([c.guardId||t.guardId||'',c.guardStages||t.guardStages||[]])};
}
export function compareAssessments(left,right){
 if(!left||!right)throw Error('请选择两份评估结果');if(left.id===right.id)throw Error('请选择两份不同结果');if(left.kind!==right.kind)throw Error('模型与智能体结果分别对比');
 const a=signature(left),b=signature(right),differences=Object.keys(a).filter(k=>a[k]!==b[k]);
 return {left,right,differences,comparable:!differences.length,delta:typeof left.value==='number'&&typeof right.value==='number'?right.value-left.value:null};
}
