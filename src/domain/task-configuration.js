/* 用户配置与演示证据分别建模。配置来自资产/已发布策略；回放源只在启动时匹配。 */
import { modelEvaluatorConfiguration, modelEvaluatorMatches } from './model-evaluators.js';
import { modelPreflightPassed } from './model-preflight.js';
import { parameterSchemaForMethod } from './method-parameter-schema.js';
import { methodModelRoles, methodModelSelection } from './method-model-roles.js';
const copy = value => JSON.parse(JSON.stringify(value));
const isModelParameter = label => /模型/.test(label);
const roundParameter = label => /最大.*轮数|迭代轮数|最大轮次/.test(label);

/** Preserve explicit question identity; counts alone describe legacy prefix selections. */
export function resolveModelBankSelections(refs, catalogBanks) {
  const selected=new Map();
  for(const ref of refs||[]){
    const bank=catalogBanks.find(bank=>bank.id===ref.bankId);
    if(!bank||bank.status==='draft'||!bank.items?.length)throw Error('攻击配置引用的题库尚未发布或不可用');
    let ids;
    if(Array.isArray(ref.itemIds)){
      ids=[...new Set(ref.itemIds)];
      if(!ids.length||ids.some(id=>!bank.items.some(item=>item.id===id)))throw Error('部分所选题目已删除或不再可用');
    }else{
      if(ref.count!=null&&(!Number.isSafeInteger(ref.count)||ref.count<1||ref.count>bank.items.length))throw Error('题库选题数量无效');
      ids=bank.items.slice(0,ref.count??bank.items.length).map(item=>item.id);
    }
    if(!selected.has(bank.id))selected.set(bank.id,{bankId:bank.id,name:bank.name,itemIds:[],count:0});
    const current=selected.get(bank.id);current.itemIds=[...new Set([...current.itemIds,...ids])];current.count=current.itemIds.length;
  }
  return [...selected.values()];
}

export const MODEL_EXECUTION_DEFAULTS = Object.freeze({ concurrency: 3, maxTokens: 2048 });
export function modelExecutionConfiguration(data = {}) {
  const result = {};
  for (const [key, label] of [['concurrency', '并发数'], ['maxTokens', 'Token 限制']]) {
    const value = Number(data[key] ?? MODEL_EXECUTION_DEFAULTS[key]);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label}需为大于 0 的整数`);
    result[key] = value;
  }
  return result;
}

export function buildModelConfiguration(data, catalog, { draft = false } = {}) {
  // Historical task records use tgt-* identifiers; assets use mdl-* identifiers.
  const targetId = String(data.targetId || '').replace(/^tgt-/, 'mdl-');
  const target = catalog.models.find(m => m.id === targetId && (!m.status || m.status === 'connected') && m.testable !== false);
  const attackMode=data.attackMode||'strategy';
  if(!['strategy','custom'].includes(attackMode))throw Error('攻击配置方式无效');
  const strategy = attackMode==='strategy'?catalog.strategies.find(s => s.id === data.strategyId && s.status === 'published'):null;
  const attack=attackMode==='custom'?data:strategy;
  const judge = catalog.models.find(m => m.id === data.judgeId && (!m.status || m.status === 'connected') && m.testable !== false);
  for (const [id, found, message] of [[data.targetId, target, '请选择靶标'], ...(attackMode==='strategy'?[[data.strategyId, strategy, '请选择已发布的攻击策略']]:[]), [data.judgeId, judge, '请选择裁判模型']]) {
    if ((!draft || id) && !found) throw new Error(message);
  }
  const guardEnabled = data.guardEnabled === true || (data.guardEnabled === undefined && !!data.guardId);
  const guard = guardEnabled ? catalog.guards.find(g => g.id === (data.guardId || 'grd-content-review')) : null;
  if (guardEnabled && !guard) throw new Error('蓝队防护策略不可用');
  const suppliedStages = Array.isArray(data.guardStages) ? data.guardStages : [];
  if (suppliedStages.some(s => !['输入', '输出'].includes(s))) throw new Error('蓝队防护位置无效');
  const guardStages = guardEnabled ? ['输入', '输出'].filter(s => suppliedStages.includes(s)) : [];
  if (!draft && guardEnabled && !guardStages.length) throw new Error('请选择蓝队防护位置');
  const banks=resolveModelBankSelections(attack?.banks||[],catalog.banks);
  if(!draft&&!banks.length)throw Error('请至少选择一道已发布题目');
  if(!draft&&!attack?.methods?.length)throw Error('请至少选择一种攻击方法');
  const methods = (attack?.methods || []).map((m, index) => {
    const definition=catalog.methods?.find(method=>method.name.toLowerCase()===String(m.name).toLowerCase());
    if(catalog.methods&&(!definition||definition.available===false||definition.family==='多模态'))throw Error('所选攻击方法不可用');
    const params=copy(Array.isArray(m.params)?m.params:Object.entries(m.params||{}));
    if(!draft&&attackMode==='custom'&&definition){
      const schema=parameterSchemaForMethod(definition);
      const values=Object.fromEntries(params);
      for(const param of schema){const value=values[param.label];
        if(typeof value!==param.type||param.type==='number'&&(!Number.isFinite(value)||param.integer&&!Number.isSafeInteger(value)||param.min!==undefined&&value<param.min||param.max!==undefined&&value>param.max)||param.type==='string'&&!value.trim()||param.options&&!param.options.includes(value))throw Error(m.name+'：'+param.label+'的配置无效');
      }
      if(definition.id==='TreeAttack'&&values['保留分支数量']>values['分支数量'])throw Error('保留分支数量不能超过分支数量');
    }
    const generatorId=m.aux?.generator||m.generator,generatorName=params.find(([label])=>label==='攻击生成模型')?.[1];
    const generator=catalog.models.find(model=>generatorId?model.id===generatorId||model.assetId===generatorId:model.name===generatorName);
    if(!draft&&definition?.generator&&(!generator||generator.status&&generator.status!=='connected'||generator.testable===false))throw Error('请为 '+m.name+' 选择可用的攻击生成模型');
    const needsProcess=definition?.process||Boolean(m.aux?.process)||params.some(([label])=>/过程裁判/.test(label));
    const aux={...copy(m.aux||{}),generator:generator?.id||generatorId||''};
    if(needsProcess){aux.process=judge?.id||'';for(let i=params.length-1;i>=0;i--)if(/过程裁判/.test(params[i][0]))params.splice(i,1);if(judge)params.push(['过程裁判',judge.name]);}
    if(generator){const entry=params.find(([label])=>label==='攻击生成模型');if(entry)entry[1]=generator.name;else params.push(['攻击生成模型',generator.name]);}
    const auxiliaryModels=params.filter(([label])=>isModelParameter(label)||/过程裁判/.test(label)).map(([role,name])=>({role,name,id:/过程裁判/.test(role)?judge?.id||null:catalog.models.find(model=>model.name===name)?.id||null}));
    for(const role of methodModelRoles(definition).filter(role=>role.key!=='generator')){
      const selected=methodModelSelection(m,role),model=catalog.models.find(model=>selected.id?model.id===selected.id||model.assetId===selected.id:model.name===selected.name);
      if(!draft&&(!model||model.status&&model.status!=='connected'||model.testable===false||model.sourceStatus==='已停用'))throw Error('请为 '+m.name+' 选择可用的'+role.role);
      const entry={role:role.role,id:model?.id||selected.id||null,name:model?.name||selected.name||''},existing=auxiliaryModels.findIndex(row=>row.role===role.role);
      if(existing>=0)auxiliaryModels[existing]=entry;else auxiliaryModels.push(entry);
    }
    const maxRounds = Number(params.find(([label]) => roundParameter(label))?.[1] ?? m.maxRounds ?? 1);
    return { name: m.name, order: m.order ?? index + 1, params, aux, auxiliaryModels, maxRounds: Number.isInteger(maxRounds) && maxRounds > 0 ? maxRounds : 1 };
  });
  const bankCount = banks.reduce((sum, b) => sum + b.count, 0);
  const modelQuestionSnapshots=banks.flatMap(ref=>{const bank=catalog.banks.find(bank=>bank.id===ref.bankId);return ref.itemIds.map(id=>({id,bankId:ref.bankId,prompt:bank.items.find(item=>item.id===id).prompt}));});
  const attacker = methods.flatMap(m => m.auxiliaryModels)[0];
  const config = { objectType: 'model', targetId: target?.id || '', targetName: target?.name || '',
    ...(target?.assetId && target.assetSnapshot ? { targetAssetId: target.assetId, targetAssetVersion: target.assetVersion, targetSnapshot: copy(target.assetSnapshot) } : {}),
    attackMode, strategyId: strategy?.id || '', strategyName: strategy?.name || (attackMode==='custom'?'自定义组合':''), banks,
    ...(attack?.questionSelection?{questionSelection:copy(attack.questionSelection)}:{}),
    modelQuestionSnapshots,
    bankName: banks.map(b => b.name).join('、'), bankCount, methods, total: bankCount * methods.length,
    guardEnabled, guardId: guard?.id || null, guardName: guard?.name || null, guardStages,
    judgeId: judge?.id || '', judgeName: judge?.name || '', evaluationMetrics: ['asr'],
    ...modelEvaluatorConfiguration(data, { draft }),
    attackerId: attacker?.id || null, attackerName: attacker?.name || null,
    ...modelExecutionConfiguration(data), stopRule: '按攻击方法配置执行',
    ...(data.modelPreflightRequired ? {modelPreflightRequired:true,modelPreflight:data.modelPreflight?copy(data.modelPreflight):null} : {}) };
  if (!draft && config.modelPreflightRequired && !modelPreflightPassed(config.modelPreflight, config, catalog)) throw Error('请先完成当前全部配置的最小演示验证');
  return config;
}

const sameStages = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
export function replayMatchesConfiguration(config, source) {
  return config.targetName === source.targetName && config.strategyId === source.strategyId
    && modelEvaluatorMatches(config, source)
    && config.judgeId === source.judgeId && (config.guardId || null) === (source.guardId || null)
    && sameStages(config.guardStages, source.guardStages)
    && config.total === source.total
    && JSON.stringify((config.methods || []).map(m => [m.name, m.maxRounds])) === JSON.stringify((source.methods || []).map(m => [m.name, m.maxRounds]));
}

export function resolveModelReplaySource(config, sources) {
  // A different rubric or protection model cannot inherit another run's verdicts.
  const compatible = sources.filter(source => modelEvaluatorMatches(config, source) && (config.guardId || null) === (source.guardId || null));
  const exact = compatible.find(source => replayMatchesConfiguration(config, source));
  if (exact) return exact;
  const score = source => Number(config.strategyId === source.strategyId) * 16
    + Number(Boolean(config.guardId) === Boolean(source.guardId)) * 8
    + Number(config.targetName === source.targetName) * 4
    + Number(config.judgeId === source.judgeId) * 2
    + Number(sameStages(config.guardStages, source.guardStages));
  // In demo mode a compatible recorded run is preferred; its own provenance remains explicit.
  return [...compatible].sort((a, b) => score(b) - score(a) || Number(Boolean(b.guardId)) - Number(Boolean(a.guardId)))[0] || null;
}
