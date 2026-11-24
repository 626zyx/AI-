/* Measured wall time from the retained b5 runs; never use replay animation time. */
const TIMES={
  baseline:{'000023':[474.90,274.041],'000041':[317.54,185.845],'000055':[449.43,346.808],'000150':[489.65,333.202],'000160':[456.71,316.712]},
  universal:{'000023':[613.26,138.035],'000041':[641.63,212.393],'000055':[872.42,351.468],'000150':[1105.46,453.009],'000160':[527.26,294.756]},
};
export function recordedQuestionTiming(task,unit){
  if(unit.executionStatus && unit.executionStatus!=='done')return null;
  const id=task.sourceTaskId||task.id;
  if(!['task-agt-b5-dc-baseline','task-agt-b5-dc-universal'].includes(id))return null;
  const no=String(unit.sceneTaskId||'').replace('openart-mid-','');
  const value=TIMES[id.endsWith('baseline')?'baseline':'universal'][no];
  return value?{wall:value[0],target:value[1],question:no,source:'归档 wall_seconds / timing.json',scope:'最终保留尝试'}:null;
}
export function recordedPerformance(task){
  const rows=(task.units||[]).map(unit=>recordedQuestionTiming(task,unit)).filter(Boolean).sort((a,b)=>a.wall-b.wall);
  return {known:rows.length,total:task.total||0,min:rows[0]||null,max:rows.at(-1)||null,sum:rows.length?rows.reduce((n,x)=>n+x.wall,0):null,token:null};
}
