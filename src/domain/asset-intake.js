import { models, agents } from './store.js';
// Session only: refresh recreates the seed directory, never reads browser storage.
const clone=x=>JSON.parse(JSON.stringify(x)), clean=x=>String(x??'').trim(), now=()=>new Date().toISOString();
const directory=new Map(), chosen=new Map(), secrets=new Map(), checks=new Map(), listeners=new Set(), modelConnectionTests=new Map();
let serial=0;
const metaKeys=['name','owner','source','sourceStatus','sourceKind','sourceDataset','sourceRecordId','platformConnectionId','enterpriseVersion','sourceUpdatedAt'];
const testKeys=['kind','apiModel','apiType','authType','image','command','taskInput','promptFlag','baseModelId','baseModelVersion','surfaceDeclarations'];
const connKeys=['baseUrl','runtimeEndpoint','credentialRef'], configKeys=[...metaKeys,...testKeys,...connKeys];
const vn=v=>Number(clean(v).replace(/^v/i,''))||1, cv=v=>'V'+vn(v), key=(id,v)=>id+'@'+cv(v);
const emit=()=>{for(const fn of [...listeners])fn();};
export function subscribeAssets(fn){listeners.add(fn);return()=>listeners.delete(fn);}
function current(id,version){const r=directory.get(clean(id));return r?.versions.find(x=>x.version===cv(version||chosen.get(id)||r.latestVersion));}
function copyConfig(x){return Object.fromEntries(configKeys.filter(k=>x[k]!==undefined).map(k=>[k,clone(x[k])]));}
function normalize(data,prev={}){
 const kind=clean(data.kind||data.type||prev.kind).toLowerCase();
 const x={...copyConfig(prev),kind,name:clean(data.name??prev.name),owner:clean(data.owner??prev.owner)||'待分配',source:clean(data.source??prev.source)||'人工上传',sourceStatus:clean(data.sourceStatus??prev.sourceStatus)||'未发布',sourceKind:clean(data.sourceKind??prev.sourceKind)||'manual',sourceDataset:clean(data.sourceDataset??prev.sourceDataset),sourceRecordId:clean(data.sourceRecordId??prev.sourceRecordId),platformConnectionId:clean(data.platformConnectionId??prev.platformConnectionId),credentialRef:clean(data.credentialRef??prev.credentialRef)};
 for(const key of ['enterpriseVersion','sourceUpdatedAt'])x[key]=clean(data[key]??prev[key]);
 if(!x.platformConnectionId&&!x.sourceKind.startsWith('enterprise')&&x.sourceStatus==='停止')x.sourceStatus='已停用';
 if(kind==='model')Object.assign(x,{apiType:clean(data.apiType??prev.apiType)||'openai',authType:clean(data.authType??prev.authType)||'bearer',apiModel:clean(data.apiModel??prev.apiModel),baseUrl:clean(data.baseUrl??prev.baseUrl).replace(/\/+$/,'')});
 if(kind==='agent'){
  let command=data.command??prev.command??[],surfaces=data.surfaceDeclarations??prev.surfaceDeclarations??[];
  if(typeof command==='string'){try{command=JSON.parse(command);}catch{command=command.split('\n');}}
  if(typeof surfaces==='string'){try{surfaces=JSON.parse(surfaces);}catch{surfaces=null;}}
  Object.assign(x,{image:clean(data.image??prev.image),command:Array.isArray(command)?command.map(clean).filter(Boolean):[],taskInput:clean(data.taskInput??prev.taskInput)||'stdin',promptFlag:clean(data.promptFlag??prev.promptFlag),baseModelId:clean(data.baseModelId??prev.baseModelId),baseModelVersion:cv(data.baseModelVersion||prev.baseModelVersion||directory.get(data.baseModelId||prev.baseModelId)?.latestVersion||'V1'),runtimeEndpoint:clean(data.runtimeEndpoint??prev.runtimeEndpoint),surfaceDeclarations:Array.isArray(surfaces)?surfaces.map(s=>({kind:clean(s.kind)||'instruction',...(s.subtype?{subtype:clean(s.subtype)}:{}),path:clean(s.path),description:clean(s.description)})):null});
 }
 return x;
}
function seed(raw,kind){const x={...normalize({...raw,kind,source:raw.source||(kind==='agent'?'历史接入记录':'系统模型配置'),sourceKind:raw.sourceKind||(kind==='agent'?'historical':'builtin'),sourceDataset:raw.sourceDataset||(kind==='agent'?'历史运行归档':''),sourceRecordId:raw.sourceRecordId||raw.id,sourceStatus:'已发布',owner:raw.owner||'安全团队'}),id:raw.id,version:'V1',status:raw.status==='error'?'failed':raw.status==='planned'?'pending':'ready',busy:false,connectionRevision:1,credentialConfigured:kind==='model',immutable:false,usedBy:[],capabilities:kind==='model'?['文本对话']:['沙箱执行','任务轨迹','文件证据'],validation:{state:'passed',mode:'demo',actualConnectionVerified:false,checkedAt:now(),steps:[{name:'配置检查',state:'passed',detail:'已载入示例配置'},{name:'演示状态',state:'passed',detail:'可用于演示，当前未发起真实连通请求'}]},createdAt:now(),updatedAt:now(),connectionHistory:[{revision:1,at:now(),changes:['初始连接配置'],status:'ready'}],configHistory:[]};directory.set(x.id,{id:x.id,kind,latestVersion:'V1',versions:[x]});chosen.set(x.id,'V1');}
for(const x of models)seed(x,'model');for(const x of agents)seed(x,'agent');
export function getAsset(id,version){const x=current(id,version);return x?{...clone(x),latestVersion:directory.get(id).latestVersion,versions:clone(directory.get(id).versions)}:null;}
export function getAssetSnapshot(id,version){const x=current(id,version);return x?clone(x):null;}
export function listAssetVersions(id){return clone(directory.get(id)?.versions||[]);}
export function selectAssetVersion(id,version){if(!current(id,version))throw Error('资产版本不存在');chosen.set(id,cv(version));return getAsset(id);}
export function listAssets({kind,status,query,sourceStatus}={}){const q=clean(query).toLowerCase();return [...directory.values()].filter(record=>!record.archived).map(record=>getAsset(record.id)).filter(x=>(!kind||kind==='all'||x.kind===kind)&&(!status||status==='all'||x.status===status)&&(!sourceStatus||sourceStatus==='all'||x.sourceStatus===sourceStatus)&&(!q||[x.id,x.name,x.owner,x.source].join(' ').toLowerCase().includes(q)));}
export function listTestableAssets({kind}={}){return [...directory.values()].filter(record=>!record.archived).flatMap(r=>r.versions).filter(x=>x.status==='ready'&&x.sourceStatus!=='已停用'&&!x.busy&&(!kind||x.kind===kind)).map(clone);}
export function markAssetUsed(id,version,taskId){const x=current(id,version);if(!x)throw Error('资产版本不存在');if(!clean(taskId))throw Error('请提供演练任务 ID');x.immutable=true;if(!x.usedBy.includes(taskId))x.usedBy.push(taskId);emit();return clone(x);}
export function assetErrors(data,{referenceIds=[]}={}){
 const x=normalize(data),errors=[];
 if(!['model','agent'].includes(x.kind))errors.push('类型必须为 model 或 agent');if(!x.name)errors.push('缺少资产名称');if(!x.platformConnectionId&&!x.sourceKind.startsWith('enterprise')&&!['未发布','已发布','已停用'].includes(x.sourceStatus))errors.push('企业源状态需为未发布、已发布或已停用');
 if(x.kind==='model'){try{if(!['http:','https:'].includes(new URL(x.baseUrl).protocol))throw Error();}catch{errors.push('连接地址需为完整的 HTTP/HTTPS 地址');}if(!x.apiModel)errors.push('缺少请求模型标识 apiModel');}
 if(x.kind==='agent'){
  if(!x.image)errors.push('请填写镜像引用');if(!x.command.length)errors.push('缺少可执行命令');if(!['stdin','argv','file'].includes(x.taskInput))errors.push('输入协议需为 stdin、argv 或 file');
  if(x.promptFlag&&!/^--?[a-zA-Z][\w-]*$/.test(x.promptFlag))errors.push('任务参数标记需为单个参数名');if(x.promptFlag&&x.taskInput!=='stdin'&&x.command.includes(x.promptFlag))errors.push('启动参数不要重复填写任务参数标记');
  const base=current(x.baseModelId,x.baseModelVersion);if(x.baseModelId&&(!base||base.kind!=='model')&&!referenceIds.includes(x.baseModelId))errors.push('需关联被测模型的明确版本');
  if(!Array.isArray(x.surfaceDeclarations))errors.push('文件注入面需为有效 JSON 数组');else if(x.surfaceDeclarations.some(s=>!s.path||/[*?]/.test(s.path)||s.path==='/'))errors.push('注入面需为明确文件路径，不使用通配符');
  if(x.runtimeEndpoint){try{if(!['http:','https:'].includes(new URL(x.runtimeEndpoint).protocol))throw Error();}catch{errors.push('执行服务地址需为 HTTP/HTTPS 地址或留空');}}
 }return errors;
}
const diff=(a,b,keys=configKeys)=>keys.filter(k=>JSON.stringify(a[k]??null)!==JSON.stringify(b[k]??null));
export function saveAsset(data,{mode='edit'}={}){
 const requested=clean(data.id);if(requested&&!/^[\w.:-]{1,100}$/.test(requested))throw Error('资产 ID 仅支持字母、数字、下划线、点、冒号和短横线，最长 100 字符');
 const record=directory.get(requested),prev=record?current(requested,data.version||record.latestVersion):null;if(record&&!prev)throw Error('资产版本不存在');if(prev?.busy)throw Error('连通检查进行中，请稍后修改');
 const normalized=normalize(data,prev||{});if(record&&normalized.kind!==record.kind)throw Error('同一资产 ID 不能改变资产类型');const errors=assetErrors(normalized);if(errors.length)throw Error(errors.join('；'));
 const changed=prev?diff(normalized,prev):configKeys,secretChanged=Boolean(clean(data.apiKey))&&secrets.get(key(requested,prev?.version))!==clean(data.apiKey);
 if(prev&&mode!=='new-version'&&!changed.length&&!secretChanged)return getAsset(prev.id,prev.version);
 if(prev&&mode==='connection'&&changed.some(k=>!connKeys.includes(k)))throw Error('连接修订只能修改连接地址和访问凭据');
 if(prev?.immutable&&mode!=='new-version'&&changed.some(k=>testKeys.includes(k)))throw Error('此版本已用于演练，测试配置已冻结；请上传新版本');
 const id=prev?.id||requested||'asset-'+normalized.kind+'-'+Date.now().toString(36)+'-'+ ++serial,newVersion=Boolean(prev&&mode==='new-version'),version=newVersion?'V'+(Math.max(record.lastVersionNumber||0,...record.versions.map(x=>vn(x.version)))+1):prev?.version||'V1';let x;
 if(!prev||newVersion){x={...normalized,id,version,status:'pending',busy:false,connectionRevision:1,credentialConfigured:Boolean(clean(data.apiKey)||normalized.credentialRef)||prev?.credentialConfigured||false,immutable:false,usedBy:[],capabilities:[],validation:{state:'pending',checkedAt:null,steps:[]},createdAt:now(),updatedAt:now(),connectionHistory:[{revision:1,at:now(),changes:['初始连接配置'],status:'pending'}],configHistory:[]};if(prev){record.versions.push(x);record.latestVersion=version;const secret=secrets.get(key(id,prev.version));if(secret)secrets.set(key(id,version),secret);}else directory.set(id,{id,kind:normalized.kind,latestVersion:version,versions:[x]});}
 else{x=prev;const connectionChanged=changed.some(k=>connKeys.includes(k))||secretChanged,testChanged=changed.some(k=>testKeys.includes(k));if(changed.length)x.configHistory.push({at:now(),changes:changed,note:testChanged?'未演练版本测试配置更新':'资产信息更新'});Object.assign(x,normalized,{updatedAt:now()});if(connectionChanged){x.connectionRevision++;x.connectionHistory.push({revision:x.connectionRevision,at:now(),changes:[...changed.filter(k=>connKeys.includes(k)),...(secretChanged?['访问凭据已更新']:[])],status:'pending'});}if(connectionChanged||testChanged){x.status='pending';x.capabilities=[];x.validation={state:'pending',checkedAt:null,steps:[]};}}
 if(clean(data.apiKey)){secrets.set(key(id,version),clean(data.apiKey));x.credentialConfigured=true;}if(normalized.credentialRef)x.credentialConfigured=true;chosen.set(id,version);emit();return getAsset(id,version);
}

const modelConnectionKeys=['baseUrl','apiModel','apiType','authType','credentialRef'];
function modelResourcePlan(data){
 const id=clean(data.id),record=directory.get(id);
 if(record?.archived)throw Error('模型资源已删除，请重新创建资源');
 if(record&&record.kind!=='model'||data.kind&&data.kind!=='model')throw Error('请选择模型资源');
 if(id&&!/^[\w.:-]{1,100}$/.test(id))throw Error('模型资源 ID 格式不正确');
 const previous=record?current(id,record.latestVersion):null;
 if(previous?.busy)throw Error('模型正在检查，请稍后修改');
 const normalized=normalize({source:previous?.source||'模型接入配置',sourceKind:previous?.sourceKind||'manual',sourceStatus:previous?.sourceStatus||'已发布',...data,kind:'model',enterpriseVersion:previous?.enterpriseVersion||''},previous||{});
 const errors=assetErrors(normalized);
 if(normalized.apiType!=='openai')errors.push('当前仅支持 OpenAI 兼容协议');
 if(normalized.authType!=='bearer')errors.push('当前仅支持 API Key 鉴权');
 const suppliedKey=clean(data.apiKey);
 if(!suppliedKey&&!previous?.credentialConfigured)errors.push('请填写 API Key');
 if(errors.length)throw Error([...new Set(errors)].join('；'));
 const storedKey=previous?secrets.get(key(id,previous.version)):null;
 const effectiveKey=suppliedKey||storedKey||(previous?.credentialConfigured?'configured-credential':'');
 const connectionChanged=!previous||diff(normalized,previous,modelConnectionKeys).length>0||Boolean(suppliedKey&&suppliedKey!==storedKey);
 const signature=JSON.stringify({id,connection:Object.fromEntries(modelConnectionKeys.map(field=>[field,normalized[field]||''])),credential:effectiveKey,
  previous:previous?{version:previous.version,revision:previous.connectionRevision,connection:Object.fromEntries(modelConnectionKeys.map(field=>[field,previous[field]||''])),credential:storedKey||null,configured:previous.credentialConfigured}:null});
 return{id,record,previous,normalized,suppliedKey,connectionChanged,signature};
}

/** Checks a draft locally; the model directory and credentials remain unchanged. */
export async function testModelConnection(data){
 const plan=modelResourcePlan(data);
 if(/(?:invalid|unreachable|fail)\./i.test(plan.normalized.baseUrl))throw Error('演示连接检查失败，请检查 Base URL');
 const checkedAt=now(),token=globalThis.crypto?.randomUUID?.()||'model-check-'+Date.now().toString(36)+'-'+ ++serial;
 const result={token,state:'passed',mode:'demo',actualConnectionVerified:false,checkedAt};
 modelConnectionTests.set(token,{id:plan.id,signature:plan.signature,result});
 if(modelConnectionTests.size>100)modelConnectionTests.delete(modelConnectionTests.keys().next().value);
 return clone(result);
}

export function saveModelResource(data,{connectionTest}={}){
 const plan=modelResourcePlan(data),proof=modelConnectionTests.get(typeof connectionTest==='string'?connectionTest:connectionTest?.token);
 const mayKeepTest=plan.previous?.status==='ready'&&!plan.connectionChanged;
 if(!mayKeepTest&&(!proof||proof.signature!==plan.signature))throw Error('请先测试当前模型连接，再保存接入配置');
 if(connectionTest&&(!proof||proof.signature!==plan.signature))throw Error('模型连接配置已变化，请重新测试连通');
 const changes=plan.previous?diff(plan.normalized,plan.previous):configKeys;
 const newVersion=Boolean(plan.previous?.immutable&&(changes.length||plan.connectionChanged));
 const saved=saveAsset({...plan.normalized,id:plan.id||undefined,version:plan.previous?.version,apiKey:plan.suppliedKey},{mode:newVersion?'new-version':'edit'});
 const stored=current(saved.id,saved.version),checkedAt=proof?.result.checkedAt||plan.previous?.validation.checkedAt||now();
 stored.status='ready';stored.busy=false;stored.capabilities=['文本对话'];
 stored.validation={state:'passed',mode:'demo',actualConnectionVerified:false,checkedAt,steps:[
  {name:'配置与协议',state:'passed',detail:'模型连接配置完整'},
  {name:'演示连接检查',state:'passed',detail:'本地演示检查通过，未发送真实请求或验证实际密钥'},
 ]};
 const revision=stored.connectionHistory.find(row=>row.revision===stored.connectionRevision);
 if(revision){revision.status='ready';revision.checkedAt=checkedAt;}
 if(proof)modelConnectionTests.delete(proof.result.token);
 emit();return getAsset(stored.id,stored.version);
}

export function listModelResources({query=''}={}){
 const q=clean(query).toLowerCase();
 return [...directory.values()].filter(record=>record.kind==='model'&&!record.archived).map(record=>getAsset(record.id,record.latestVersion))
  .filter(asset=>!q||[asset.name,asset.id,asset.apiModel,asset.baseUrl].join(' ').toLowerCase().includes(q));
}

export function deleteModelResource(id){
 const record=directory.get(clean(id));
 if(!record||record.kind!=='model')throw Error('模型资源不存在');
 if(record.versions.some(asset=>asset.busy||checks.has(key(record.id,asset.version))))throw Error('模型正在检查，请稍后删除');
 record.archived=true;record.archivedAt=now();chosen.delete(record.id);
 for(let index=models.length-1;index>=0;index--)if(models[index].id===record.id||models[index].assetId===record.id||models[index].id.startsWith(record.id+'@'))models.splice(index,1);
 for(const [token,proof] of modelConnectionTests)if(proof.id===record.id)modelConnectionTests.delete(token);
 emit();return{id:record.id,deleted:true};
}

// Manual Agent intake records valid configuration; it does not claim a connection test.
function registerManualAgent(asset){
 const stored=current(asset.id,asset.version);
 stored.intakeMode='configuration';stored.status='ready';stored.capabilities=['沙箱执行','任务轨迹','文件证据'];
 stored.validation={state:'not_run',mode:'configuration',actualConnectionVerified:false,checkedAt:null,steps:[]};
 const revision=stored.connectionHistory.find(row=>row.revision===stored.connectionRevision);
 if(revision){revision.status='registered';delete revision.checkedAt;}
 emit();return getAsset(asset.id,asset.version);
}
export const assetVersionLabel = asset => clean(asset?.enterpriseVersion)||asset?.assetVersion||asset?.version||'V1';
export function listManualAgentVersions(name){
 return [...directory.values()].filter(record=>record.kind==='agent').flatMap(record=>record.versions)
  .filter(asset=>!asset.platformConnectionId&&asset.name===clean(name)).map(clone);
}
function manualAgentPlan(data,{mode='edit'}={}){
 const previous=data.id?current(data.id,data.version||directory.get(data.id)?.latestVersion):null;
 const normalized=normalize({...data,kind:'agent'},previous||{});
 const label=clean(data.enterpriseVersion??previous?.enterpriseVersion);
 if(!label)throw Error('请填写配置版本号，例如 1.0.0');
 if(label.length>64)throw Error('配置版本号最长 64 字符');
 normalized.enterpriseVersion=label;
 const next=Boolean(previous&&(mode==='new-version'||label!==assetVersionLabel(previous)));
 if(previous?.immutable&&!next&&normalized.name!==previous.name)throw Error('此版本已用于演练，请上传新版本后修改资产名称');
 const duplicate=listManualAgentVersions(normalized.name).some(asset=>assetVersionLabel(asset)===label&&
  (next||asset.id!==previous?.id||asset.version!==previous?.version));
 if(duplicate)throw Error('同名资产的配置版本号已存在；不同 ID 请填写不同版本号');
 return {data:{...data,...normalized,id:clean(data.id),version:previous?.version},mode:next?'new-version':mode};
}
export function saveManualAgent(data,options={}){
 if(data.kind&&data.kind!=='agent')throw Error('人工上传仅支持 Agent');
 const plan=manualAgentPlan(data,options);
 return registerManualAgent(saveAsset(plan.data,{mode:plan.mode}));
}
export function previewManualAgents(items){
 const seen=new Set();
 return previewAssets(items).map(item=>{
  const errors=[...item.errors];let operation=item.operation;
  if(item.data.kind!=='agent')errors.push('人工上传仅支持 Agent；模型请前往模型接入配置');
  else try{
   const plan=manualAgentPlan(item.raw),label=assetVersionLabel(plan.data),identity=plan.data.name+'\0'+label;
   if(seen.has(identity))errors.push('同一批次同名资产的配置版本号重复');seen.add(identity);
   const previous=current(item.id);
   if(previous?.immutable&&plan.mode!=='new-version'&&diff(plan.data,previous).some(key=>testKeys.includes(key)))errors.push('此版本已用于演练，测试配置已冻结；请填写新版本号');
   operation=plan.mode==='new-version'?'新版本 '+label:previous?(item.operation==='内容未变'?'内容未变':'更新 '+label):'新增 '+label;
  }catch(error){errors.push(error.message);}
  return {...item,errors,operation};
 });
}
export function importManualAgents(items){
 if(items.some(item=>item.kind!=='agent'))throw Error('人工上传仅支持 Agent；模型请前往模型接入配置');
 const preview=previewManualAgents(items),imported=[],changed=[],errors=preview.filter(item=>item.errors.length).map(item=>({row:item.row,errors:item.errors}));
 for(const item of preview.filter(item=>!item.errors.length))try{
  const asset=saveManualAgent(item.raw);imported.push(asset);if(item.operation!=='内容未变')changed.push(asset);
 }catch(error){errors.push({row:item.row,errors:[error.message]});}
 return {imported,changed,errors};
}
export function manualAgentDeleteError(id,version){
 const asset=current(id,version);
 if(!asset||asset.kind!=='agent'||asset.platformConnectionId)return '只能删除人工上传的 Agent 配置';
 if(asset.immutable||asset.usedBy?.length)return '此资产配置已用于演练，不能删除';
 if(asset.busy||checks.has(key(id,asset.version)))return '资产正在检查，请稍后删除';
 return '';
}
export function deleteManualAgent(id,version){
 const error=manualAgentDeleteError(id,version);if(error)throw Error(error);
 const asset=current(id,version),record=directory.get(id),deleted=clone(asset);
 record.lastVersionNumber=Math.max(record.lastVersionNumber||0,...record.versions.map(item=>vn(item.version)));
 record.versions=record.versions.filter(item=>item.version!==asset.version);
 secrets.delete(key(id,asset.version));
 if(record.versions.length){
  record.latestVersion=record.versions.reduce((latest,item)=>vn(item.version)>vn(latest)?item.version:latest,record.versions[0].version);
  if(chosen.get(id)===asset.version)chosen.set(id,record.latestVersion);
 }else{
  directory.delete(id);chosen.delete(id);
  // Remove the legacy catalog alias so the shared picker cannot resurrect it.
  for(let index=agents.length-1;index>=0;index--)if(agents[index].id===id)agents.splice(index,1);
 }
 emit();return deleted;
}
export function updateAssetConnection(id,version,data){return saveAsset({...data,id,version},{mode:'connection'});}
export function parseAssetImport(text,format='json'){
 const source=String(text).replace(/^\uFEFF/,'');if(format==='json'||clean(source).startsWith('[')||clean(source).startsWith('{')){const p=JSON.parse(source),items=Array.isArray(p)?p:p.assets;if(!Array.isArray(items)||items.some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw Error('JSON 需为资产对象数组或包含 assets 数组');return items;}
 const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(cell);if(row.some(clean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('CSV 引号未闭合');row.push(cell);if(row.some(clean))rows.push(row);if(rows.length<2)throw Error('CSV 需要表头和资产记录');const heads=rows.shift().map(clean);if(new Set(heads).size!==heads.length||heads.some(k=>!k))throw Error('CSV 表头不可为空或重复');return rows.map((vals,i)=>{if(vals.length!==heads.length)throw Error('CSV 第 '+(i+2)+' 行列数不一致');return Object.fromEntries(heads.map((k,j)=>[k,vals[j]]));});
}
export function previewAssets(items){const refs=items.filter(x=>x.kind==='model').map(x=>clean(x.id)).filter(Boolean),seen=new Set();return items.map((raw,i)=>{const id=clean(raw.id),record=directory.get(id),prev=record&&current(id,record.latestVersion),data=normalize(raw,prev||{}),errors=assetErrors(data,{referenceIds:refs});if(!id)errors.push('批量清单需填写稳定且唯一的 id');else if(!/^[\w.:-]{1,100}$/.test(id))errors.push('id 格式不正确');if(seen.has(id))errors.push('同一批次资产 ID 重复');seen.add(id);if(record&&record.kind!==data.kind)errors.push('同一 ID 已属于其他资产类型');if(prev?.busy)errors.push('该资产正在进行连通检查');const changed=prev?diff(data,prev):[],testChanged=changed.some(k=>testKeys.includes(k)),connectionChanged=changed.some(k=>connKeys.includes(k)),metadataChanged=changed.some(k=>metaKeys.includes(k)),secretChanged=Boolean(clean(raw.apiKey))&&secrets.get(key(id,prev?.version))!==clean(raw.apiKey),nextVersion='V'+(Math.max(...(record?.versions||[]).map(x=>vn(x.version)),0)+1),operation=!record?'新增 V1':testChanged?'新版本 '+nextVersion:connectionChanged||secretChanged?'连接修订 R'+((prev?.connectionRevision||0)+1):metadataChanged?'同步资产信息':'内容未变';return{row:i+1,id,data:{...data,id},raw:{...raw,id},errors,operation,existingId:record?.id||null};});}
export function importAssets(items){const preview=previewAssets(items),imported=[],changed=[],errors=preview.filter(x=>x.errors.length).map(x=>({row:x.row,errors:x.errors}));for(const item of preview.filter(x=>!x.errors.length).sort((a,b)=>(a.data.kind==='model'?0:1)-(b.data.kind==='model'?0:1))){try{const mode=item.operation.startsWith('新版本 ')?'new-version':'edit',result=item.operation==='内容未变'?getAsset(item.id,directory.get(item.id).latestVersion):saveAsset(item.raw,{mode});imported.push(result);if(item.operation!=='内容未变')changed.push(result);}catch(error){errors.push({row:item.row,errors:[error.message]});}}return{imported,changed,errors};}
/** Local demo only. This function never calls the configured endpoint or reads credentials. */
export async function validateAsset(id,{version,onProgress,delay=240}={}) {
 const x=current(id,version); if(!x)throw Error('资产版本不存在');
 const k=key(id,x.version); if(checks.has(k))return checks.get(k);
 const run=(async()=>{
  const names=x.kind==='model'?['配置与协议','演示连接检查','演示响应','资源登记']:['镜像与启动参数','运行配置','演示任务','资源登记'];
  x.busy=true;x.validation={state:'running',mode:'demo',actualConnectionVerified:false,checkedAt:null,steps:names.map(name=>({name,state:'pending',detail:'等待检查'}))};emit();
  for(let i=0;i<names.length;i++){
   const step=x.validation.steps[i];step.state='running';step.detail='正在执行本地演示检查';onProgress?.(getAsset(id,x.version));
   if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
   let problem='';
   if(i===0)problem=assetErrors(x).join('；');
   if(i===0&&x.sourceStatus==='已停用')problem='企业源已停用，请先恢复资产状态';
   if(i===1&&x.kind==='model'&&/(?:invalid|unreachable|fail)\./i.test(x.baseUrl))problem='演示失败场景：地址标记为不可达，请检查接入配置';
   if(i===1&&x.kind==='agent'&&x.baseModelId&&current(x.baseModelId,x.baseModelVersion)?.status!=='ready')problem='关联基座模型版本尚不可用，请先检查基座模型';
   if(i===2&&x.kind==='agent'&&/(?:missing|invalid):/i.test(x.image))problem='演示失败场景：镜像标记无效，请修改配置';
   if(problem){step.state='failed';step.detail=problem;x.status='failed';x.validation.state='failed';break;}
   step.state='passed';step.detail=x.kind==='model'?['模型连接配置格式正确','演示检查通过；未向模型服务发送请求',x.credentialConfigured?'演示响应可用；凭证未在此验证':'演示响应可用；真实接入仍需配置凭证','已登记为统一模型资源，用途在使用时选择'][i]:['镜像与任务输入配置完整',x.baseModelId?'关联的模型配置可用于演示':'Agent 框架配置已登记，基座模型在任务中选择','演示任务通过；未实际启动镜像','可用于 Agent 演示'][i];onProgress?.(getAsset(id,x.version));
  }
  if(x.validation.state!=='failed'){x.status='ready';x.validation.state='passed';x.capabilities=x.kind==='model'?['文本对话']:['沙箱执行','任务轨迹','文件证据'];}
  x.busy=false;x.validation.checkedAt=now();x.updatedAt=now();const revision=x.connectionHistory.find(row=>row.revision===x.connectionRevision);if(revision){revision.status=x.status;revision.checkedAt=now();}
  emit();onProgress?.(getAsset(id,x.version));return getAsset(id,x.version);
 })();checks.set(k,run);try{return await run;}finally{x.busy=false;checks.delete(k);}
}

// Explicit demo connectors: source catalog and local import state, never a network integration.
const platformSecrets=new Map();
const platformConnections=new Map([['platform-enterprise-demo',{
 id:'platform-enterprise-demo',name:'企业 AI 资产平台（演示）',endpoint:'https://assets.example.com',baseUrl:'https://assets.example.com',resourcePath:'/api/v1/assets',credentialRef:'',credentialConfigured:false,authType:'none',owner:'平台管理员',
 state:'connected',mode:'demo',actualConnected:false,createdAt:now(),updatedAt:now(),lastImportedAt:null,lastSyncedAt:'2026-11-24T01:30:00.000Z',
}]]);
export function listPlatformConnections(){return clone([...platformConnections.values()]);}
export function getPlatformConnection(id){const row=platformConnections.get(id);return row?clone(row):null;}
export function savePlatformConnection(data){
 const id=data.id||'platform-'+Date.now().toString(36)+'-'+ ++serial,previous=platformConnections.get(id);
 const name=clean(data.name??previous?.name),endpoint=clean(data.endpoint??data.baseUrl??previous?.endpoint).replace(/\/+$/,'');
 if(!name)throw Error('请填写资产平台名称');
 if(!endpoint)throw Error('请填写 API 地址');
 if(!/^[\w.:-]{1,100}$/.test(id))throw Error('平台连接 ID 格式不正确');
 const allowed=['connector','resourcePath','authType','apiKeyHeader','timeout','pageMode','listPath','mapping','kinds','environment','department','selectedIds','interval','reconcile','autoInclude','notifyChanges','webhook','lastSyncedAt','lastImportedAt','lastCount'];
 const extended={};for(const key of allowed)if(data[key]!==undefined)extended[key]=clone(data[key]);
 const row={...previous,...extended,id,name,endpoint,baseUrl:endpoint,credentialRef:clean(data.credentialRef??previous?.credentialRef),owner:clean(data.owner??previous?.owner)||'平台管理员',state:data.state||previous?.state||'connected',mode:'demo',actualConnected:false,createdAt:previous?.createdAt||now(),updatedAt:now(),lastImportedAt:data.lastImportedAt??previous?.lastImportedAt??null,lastSyncedAt:data.lastSyncedAt??previous?.lastSyncedAt??null};
 delete row.statusMap;
 if(clean(data.credential))platformSecrets.set(id,clean(data.credential));
 if(row.authType==='none')platformSecrets.delete(id);
 row.credentialConfigured=row.authType!=='none'&&Boolean(platformSecrets.has(id)||row.credentialRef);
 platformConnections.set(id,row);emit();return clone(row);
}
export function platformCatalog(id){
 const connection=platformConnections.get(id);if(!connection)return[];
 const prefix=id+':',meta={source:connection.name+' · 演示目录',sourceKind:'enterprise_demo',sourceDataset:'平台连接演示清单',platformConnectionId:id,sourceStatus:'已发布',enterpriseVersion:'1.0.0',owner:connection.owner};
 return [
  {...meta,id:prefix+'model',kind:'model',name:'企业对话模型（演示）',sourceRecordId:'catalog-model-01',baseUrl:'https://model.example.com/v1',apiModel:'enterprise-chat',credentialRef:''},
  {...meta,id:prefix+'agent',kind:'agent',name:'企业文档 Agent（演示）',sourceRecordId:'catalog-agent-01',image:'enterprise/document-agent:1.0-demo',command:['document-agent','--auto'],taskInput:'stdin',baseModelId:'',baseModelVersion:'',surfaceDeclarations:[{kind:'instruction',path:'AGENTS.md',description:'声明的项目指令文件'}]},
 ].map(row=>({...row,imported:Boolean(getAsset(row.id))}));
}
export function importPlatformAssets(id,assetIds){
 const connection=platformConnections.get(id);if(!connection)throw Error('平台连接不存在');
 const catalog=platformCatalog(id),requested=new Set(assetIds),rows=catalog.filter(row=>requested.has(row.id));
 if(!rows.length)throw Error('请选择要导入的资产');
 const result=importAssets(rows);recordPlatformSync(id,result.imported);return{...result,addedDependencies:[]};
}
// A sync timestamp belongs to the imported asset, independently of local connectivity checks.
export function listPlatformSyncedAssets(id){
 return [...directory.values()].filter(record=>!record.archived).map(record=>current(record.id,record.latestVersion)).filter(asset=>asset.platformConnectionId===id&&asset.lastSyncedAt).map(clone);
}
export function recordPlatformSync(id,assets,at=now()){
 const connection=platformConnections.get(id);if(!connection)throw Error('平台连接不存在');
 for(const asset of assets){const stored=current(asset.id,asset.version);if(stored&&stored.platformConnectionId===id)stored.lastSyncedAt=at;}
 connection.lastSyncedAt=at;connection.lastImportedAt=at;connection.lastCount=assets.length;emit();
}
const seedConnectionId='platform-enterprise-demo';
const seedAgent=platformCatalog(seedConnectionId).find(asset=>asset.kind==='agent');
const seedResult=importAssets([{...seedAgent,sourceRecordId:'agent',enterpriseVersion:'1.0.0',sourceUpdatedAt:'2026-11-24T00:00:00.000Z'}]);
recordPlatformSync(seedConnectionId,seedResult.imported,'2026-11-24T01:30:00.000Z');
export const ASSET_IMPORT_EXAMPLE=[{id:'support-model',kind:'model',name:'客服模型',owner:'模型研发',source:'企业资产台账',sourceStatus:'未发布',baseUrl:'https://api.example.com/v1',apiModel:'customer-service-model',apiKey:''},{id:'support-agent',kind:'agent',name:'客服 Agent',owner:'应用研发',source:'企业资产台账',sourceStatus:'未发布',image:'company/customer-agent:1.0',command:['customer-agent','--auto'],taskInput:'stdin',baseModelId:'support-model',baseModelVersion:'V1',surfaceDeclarations:[{kind:'instruction',path:'AGENTS.md',description:'工作区指令'}]}];
