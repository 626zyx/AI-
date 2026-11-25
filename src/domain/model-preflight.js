/* A local, configuration-bound rehearsal. It never calls a model or starts a real run. */
const copy = value => structuredClone(value);
const modelIdentity = model => model ? Object.fromEntries(['id','assetId','assetVersion','connectionRevision','apiType','apiModel','model','baseUrl','credentialRef','status','sourceStatus','testable'].map(key=>[key,model[key]??null])) : null;
const embeddingRole = role => /^(嵌入模型|embedding)$/i.test(String(role || '').trim());
function methodModelBindings(method) {
  const bindings = new Map();
  const add = (id, role) => {
    // A missing ID is kept so malformed extra-model configuration fails closed.
    const key = String(id || ''), current = bindings.get(key) || { id: key, roles: new Set() };
    current.roles.add(role || '辅助模型'); bindings.set(key, current);
  };
  for (const [role, id] of Object.entries(method?.aux || {})) if (id) add(id, role);
  for (const model of method?.auxiliaryModels || []) add(model.id, model.role);
  return [...bindings.values()].map(binding => ({ ...binding, roles: [...binding.roles] }));
}

export function modelPreflightFingerprint(config, catalog) {
  const modelIds = [...new Set([config.targetId, config.judgeId, ...(config.methods||[]).flatMap(method=>methodModelBindings(method).map(binding=>binding.id))].filter(Boolean))];
  const keys = ['targetId','attackMode','strategyId','banks','modelQuestionSnapshots','methods','guardEnabled','guardId','guardStages','judgeId','evaluatorId','evaluatorSnapshot','concurrency','maxTokens'];
  const guard = catalog.guards?.find(row=>row.id===config.guardId);
  const payload=JSON.stringify({configuration:Object.fromEntries(keys.map(key=>[key,config[key]??null])),models:modelIds.map(id=>modelIdentity(catalog.models.find(model=>model.id===id))),guard:guard?Object.fromEntries(['id','model','stages','verdict','integration'].map(key=>[key,guard[key]??null])):null});
  let hash=2166136261;for(let i=0;i<payload.length;i++)hash=Math.imul(hash^payload.charCodeAt(i),16777619);
  return (hash>>>0).toString(16).padStart(8,'0');
}

export function modelPreflightSteps(config) {
  return [
    ['configuration','检查题目与执行配置',`${config.bankCount} 道题目，${config.methods.length} 种方法；并发 ${config.concurrency}，单次输出上限 ${config.maxTokens} tokens`],
    ['target','验证靶标调用',`模拟向 ${config.targetName} 发起最小请求并读取响应`],
    ...config.methods.map((method,index)=>{
      const bindings = methodModelBindings(method);
      return [`method-${index}`,`验证攻击方法 · ${method.name}`,`模拟执行 1 个最小单元，核对参数${bindings.length?`及 ${bindings.length} 个辅助模型（${[...new Set(bindings.flatMap(binding=>binding.roles))].join('、')}）`:''}；本次包含全部已选方法`];
    }),
    ...(config.guardEnabled ? config.guardStages.map(stage=>[`guard-${stage}`,`验证蓝队防护 · ${stage}`,`模拟 ${config.guardName} 的${stage}防护调用与结果解析`]) : []),
    ['judge','验证评估与裁判',`模拟 ${config.judgeName} 使用“${config.evaluatorName}”，核对 score / reason 输出`],
    ['result','验证结果汇总',`模拟完成 ${config.methods.length} 个最小单元，确认可汇总判定、耗时及 Token 用量`],
  ].map(([id,name,detail])=>({id,name,detail,phase:'全配置最小验证',state:'pending'}));
}

export function modelPreflightPassed(report,config,catalog) {
  if(!report||report.state!=='passed'||report.mode!=='demo'||report.actualExecuted!==false||!Number.isFinite(Date.parse(report.checkedAt))||report.blockingIssues?.length) return false;
  if(report.fingerprint!==modelPreflightFingerprint(config,catalog))return false;
  const steps=modelPreflightSteps(config);
  return report.steps?.length===steps.length&&steps.every((step,index)=>report.steps[index]?.id===step.id&&report.steps[index]?.state==='passed');
}

function modelProblem(model, { allowEmbedding = false } = {}) {
  if(!model||model.status!=='connected'||model.testable===false||model.sourceStatus==='已停用')return '模型尚未连通或不可用';
  if(!String(model.apiModel||model.model||'').trim())return '模型缺少调用标识';
  try{if(!['https:','http:'].includes(new URL(model.baseUrl).protocol))throw Error();}catch{return '模型缺少有效 API 地址';}
  if(!allowEmbedding && /embedding/i.test(model.apiType||''))return '本次演练需要支持文本生成的模型';
  return '';
}
function stepProblem(step,config,catalog) {
  const bindings=step.id==='target'?[{id:config.targetId,roles:['靶标']}]:step.id==='judge'?[{id:config.judgeId,roles:['裁判']}]:step.id.startsWith('method-')?methodModelBindings(config.methods[Number(step.id.slice(7))]):[];
  for(const {id,roles} of bindings){
    const model=catalog.models.find(row=>row.id===id),problem=modelProblem(model,{allowEmbedding:roles.every(embeddingRole)});
    if(problem)return `${model?.name||id||roles.join('、')}：${problem}`;
  }
  return '';
}
export async function runModelPreflight(config,catalog,{delay=160,onUpdate=()=>{}}={}) {
  const report={kind:'model-preflight',mode:'demo',actualExecuted:false,state:'running',fingerprint:modelPreflightFingerprint(config,catalog),checkedAt:null,blockingIssues:[],logs:[],steps:modelPreflightSteps(config)};
  onUpdate(copy(report));
  for(const step of report.steps){
    step.state='running';onUpdate(copy(report));
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    if(report.fingerprint!==modelPreflightFingerprint(config,catalog)){
      step.state='failed';step.detail='验证期间资源配置发生变化，请按最新配置重新验证';report.blockingIssues.push(step.detail);report.state='failed';break;
    }
    const problem=stepProblem(step,config,catalog);
    if(problem){step.state='failed';step.detail=problem;step.remedy='修正模型连接配置后重新验证';report.blockingIssues.push(problem);report.logs.push({message:problem});report.state='failed';break;}
    step.state='passed';report.logs.push({message:`${step.name}：${step.detail}`});onUpdate(copy(report));
  }
  if(report.state==='running')report.state='passed';
  report.checkedAt=new Date().toISOString();onUpdate(copy(report));return copy(report);
}
