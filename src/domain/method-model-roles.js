/* Model dependencies configured per method; process judging remains task-level. */
export function methodModelRoles(method) {
  const requires=method?.requires||'',roles=[];
  if(method?.generator)roles.push({key:'generator',role:requires.includes('改写模型')?'改写模型':'攻击生成模型'});
  for(const [pattern,key,role] of [[/嵌入/,'embedding','嵌入模型'],[/图像生成/,'image','图像生成模型'],[/多模态/,'multimodal','多模态模型'],[/CLIP/,'clip','CLIP 模型'],[/毒性模型/,'toxicity','毒性检测模型'],[/辅助模型/,'auxiliary','辅助模型'],[/本地模型权重/,'local','本地模型']])if(pattern.test(requires))roles.push({key,role});
  return roles;
}

export function methodModelSelection(method,dependency) {
  const aliases=dependency.key==='generator'?[dependency.role,'攻击生成模型','改写模型']:[dependency.role];
  const saved=(method?.auxiliaryModels||[]).find(row=>aliases.includes(row.role));
  const params=Array.isArray(method?.params)?method.params:Object.entries(method?.params||{});
  const name=saved?.name||params.find(([label])=>aliases.includes(label))?.[1]||'';
  const id=(dependency.key==='generator'?method?.generator:'')||method?.aux?.[dependency.key]||saved?.id||'';
  return {id,name};
}
