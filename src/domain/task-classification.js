/* Classification is captured when a run starts. Catalogs are injected: this module
 * never imports pages or the store, and historical evidence remains unchanged. */
import * as Tags from './resource-tags.js';
import { RISK_LABEL } from './constants.js';

const copy=value=>structuredClone(value);
const names=value=>[...new Set((Array.isArray(value)?value:String(value||'').split(/[,，、;；\n]/)).map(value=>String(value).trim()).filter(Boolean))];
export const modelResourceId=(bank,item,index)=>encodeURIComponent(bank.id)+':'+(item.libraryKey??index);

export function captureTaskClassification(config,{modelBanks=[],executionBanks=modelBanks,environmentQuestions=[],sourceUnits=[],sceneLabel=value=>value,capturedAt=new Date().toISOString()}={}){
  const kind=config.objectType==='agent'?'environment':'question';
  let resources=[];
  if(kind==='environment'){
    const selected=new Set(config.questionIds||config.taskIdSnapshot||sourceUnits.map(unit=>unit.sceneTaskId));
    resources=environmentQuestions.filter(row=>selected.has(row.id)||selected.has(row.taskId)).map(row=>({resourceId:row.id,taskId:row.taskId,title:row.title||row.goal,
      seeds:{business:names(row.business),risk:names(row.riskLabels||row.labels).map(label=>RISK_LABEL[label]?.label||label)}}));
  }else{
    const all=modelBanks.flatMap(bank=>(bank.items||[]).map((item,index)=>({resourceId:modelResourceId(bank,item,index),questionId:item.id,bankId:bank.id,libraryKey:item.libraryKey,prompt:item.prompt,
      seeds:{business:names(bank.business??bank.industry??''),risk:names(item.scenes??item.scene).map(label=>sceneLabel(label)||label)}})));
    const selected=[];
    for(const ref of config.banks||[]){
      const executionBank=executionBanks.find(bank=>bank.id===ref.bankId);
      const libraryBank=modelBanks.find(bank=>bank.id===ref.bankId||bank.versions?.some(version=>version.catalogId===ref.bankId));
      const libraryRows=all.filter(row=>row.bankId===libraryBank?.id);
      const items=Array.isArray(ref.itemIds)?ref.itemIds.map(id=>executionBank?.items?.find(item=>item.id===id)).filter(Boolean):(executionBank?.items||[]).slice(0,ref.count??executionBank?.items?.length);
      for(const item of items){
        const row=libraryRows.find(row=>item.libraryKey!=null&&row.libraryKey===item.libraryKey)||libraryRows.find(row=>row.questionId===item.id)||libraryRows.find(row=>row.prompt===item.prompt);
        if(row)selected.push({...row,executionBankId:ref.bankId,executionQuestionId:item.id});
      }
    }
    // Legacy template configurations specify a count but no bank references. The
    // replay evidence identifies their prompts; use current library metadata only
    // for this new run, never to rewrite the source task.
    resources=selected.length?selected:all.filter(row=>sourceUnits.some(unit=>unit.target===row.prompt));
  }
  resources=[...new Map(resources.map(row=>[row.resourceId,row])).values()];
  Tags.registerResourceSeeds(kind,resources.map(row=>({id:row.resourceId,title:row.title||row.prompt,seeds:row.seeds})));
  const dimensions=Tags.listTagDimensions(),values=new Map(Tags.getResourcesTags(kind,resources.map(row=>row.resourceId)).map(row=>[row.id,row]));
  return {version:1,kind,capturedAt,dimensions,resources:resources.map(({seeds,libraryKey,...row})=>({...row,tags:Object.fromEntries(dimensions.map(dimension=>{
    const value=values.get(row.resourceId);return [dimension.id,value[dimension.id].map((id,index)=>({id,name:value.names[dimension.id][index]}))];
  }))}))};
}

export function attachTaskClassification(units,snapshot){
  if(!snapshot)return units;
  return units.map(unit=>{
    const candidates=snapshot.resources.filter(row=>snapshot.kind==='environment'?row.taskId===unit.sceneTaskId:
      unit.questionBankId&&unit.questionId?row.executionBankId===unit.questionBankId&&row.executionQuestionId===unit.questionId:row.prompt===unit.target);
    // A missing/ambiguous identity stays unclassified, rather than receiving an
    // unrelated resource's tags merely because its text happens to match.
    const resource=candidates.length===1?candidates[0]:null;
    return {...unit,classificationSnapshot:{resourceId:resource?.resourceId||null,dimensions:copy(snapshot.dimensions),tags:copy(resource?.tags||Object.fromEntries(snapshot.dimensions.map(row=>[row.id,[]])))}};
  });
}

export const classificationTags=(unit,dimension)=>unit.classificationSnapshot?.tags?.[dimension]??null;
export function classificationFields(unit){
  const snapshot=unit.classificationSnapshot;if(!snapshot)return [];
  return snapshot.dimensions.map(dimension=>({id:dimension.id,name:dimension.name,labels:(snapshot.tags[dimension.id]||[]).map(tag=>tag.name)}));
}

/** User classification groups whole-unit outcomes. Triggered evidence labels are
 * intentionally never rewritten or treated as if they were user-defined tags. */
export function classifiedAgentRiskRows(units){
  const groups=new Map();
  for(const unit of units)for(const tag of new Map((classificationTags(unit,'risk')||[]).map(tag=>[tag.id,tag])).values()){
    const row=groups.get(tag.id)||{key:tag.id,label:tag.name,denominator:0,judged:0,breach:0};row.denominator++;
    if(['safe','breach'].includes(unit.verdict)){row.judged++;row.breach+=Number(unit.verdict==='breach');}groups.set(tag.id,row);
  }
  return [...groups.values()].map(row=>({...row,asr:row.judged?row.breach/row.judged:null,unknown:row.denominator-row.judged}));
}
