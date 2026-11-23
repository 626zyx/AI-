import { models, agents } from './store.js';
// Session only: refresh recreates the seed directory, never reads browser storage.
const clone=x=>JSON.parse(JSON.stringify(x)), clean=x=>String(x??'').trim(), now=()=>new Date().toISOString();
const directory=new Map(), chosen=new Map(), secrets=new Map(), checks=new Map(), listeners=new Set();
let serial=0;
const metaKeys=['name','owner','source','sourceStatus','sourceConnectionId','sourceId','department','environment','tags','sourceUpdatedAt','syncedAt'];
const testKeys=['enterpriseVersion','kind','apiModel','apiType','image','command','taskInput','promptFlag','baseModelId','baseModelVersion','baseModelSnapshot','surfaceDeclarations'];
const connKeys=['baseUrl','runtimeEndpoint','credentialRef'], configKeys=[...metaKeys,...testKeys,...connKeys];
const vn=v=>Number(clean(v).replace(/^v/i,''))||1, cv=v=>'V'+vn(v), key=(id,v)=>id+'@'+cv(v);
const emit=()=>{for(const fn of [...listeners])fn();};
export function subscribeAssets(fn){listeners.add(fn);return()=>listeners.delete(fn);}
function current(id,version){const r=directory.get(clean(id));return r?.versions.find(x=>x.version===cv(version||chosen.get(id)||r.latestVersion));}
function copyConfig(x){return Object.fromEntries(configKeys.filter(k=>x[k]!==undefined).map(k=>[k,clone(x[k])]));}
function normalize(data,prev={}){
 const kind=clean(data.kind||data.type||prev.kind).toLowerCase();
 const x={...copyConfig(prev),kind,name:clean(data.name??prev.name),owner:clean(data.owner??prev.owner)||'待分配',source:clean(data.source??prev.source)||'手动上传',sourceStatus:clean(data.sourceStatus??prev.sourceStatus)||'未发布'};
 if(['停止','停用'].includes(x.sourceStatus))x.sourceStatus='已停用';
 for(const name of ['enterpriseVersion','sourceConnectionId','sourceId','department','environment','sourceUpdatedAt','syncedAt','credentialRef'])if(data[name]!==undefined||prev[name]!==undefined)x[name]=clean(data[name]??prev[name]);
 x.tags=Array.isArray(data.tags??prev.tags)?clone(data.tags??prev.tags):[];
 if(kind==='model')Object.assign(x,{apiType:'openai',apiModel:clean(data.apiModel??prev.apiModel),baseUrl:clean(data.baseUrl??prev.baseUrl).replace(/\/+$/,'')});
 if(kind==='agent'){
  let command=data.command??prev.command??[],surfaces=data.surfaceDeclarations??prev.surfaceDeclarations??[];
  if(typeof command==='string'){try{command=JSON.parse(command);}catch{command=command.split('\n');}}
  if(typeof surfaces==='string'){try{surfaces=JSON.parse(surfaces);}catch{surfaces=null;}}
  Object.assign(x,{image:clean(data.image??prev.image),command:Array.isArray(command)?command.map(clean).filter(Boolean):[],taskInput:clean(data.taskInput??prev.taskInput)||'stdin',promptFlag:clean(data.promptFlag??prev.promptFlag),baseModelId:clean(data.baseModelId??prev.baseModelId),baseModelVersion:cv(data.baseModelVersion||prev.baseModelVersion||directory.get(data.baseModelId||prev.baseModelId)?.latestVersion||'V1'),runtimeEndpoint:clean(data.runtimeEndpoint??prev.runtimeEndpoint),surfaceDeclarations:Array.isArray(surfaces)?surfaces.map(s=>({kind:clean(s.kind)||'instruction',...(s.subtype?{subtype:clean(s.subtype)}:{}),path:clean(s.path),description:clean(s.description)})):null});
  const base=data.baseModelSnapshot||(x.baseModelId===prev.baseModelId?prev.baseModelSnapshot:null)||models.find(model=>model.id===x.baseModelId);
  if(base){const {apiKey,roles,...snapshot}=clone(base);x.baseModelSnapshot=snapshot;}
 }
 return x;
}
function seed(raw,kind){const x={...normalize({...raw,kind,source:'示例资产',sourceStatus:'已发布',owner:'安全团队'}),id:raw.id,version:'V1',status:'ready',busy:false,connectionRevision:1,credentialConfigured:kind==='model',immutable:false,usedBy:[],capabilities:kind==='model'?['文本对话']:['沙箱执行','任务轨迹','文件证据'],validation:{state:'passed',checkedAt:now(),steps:[{name:'配置检查',state:'passed',detail:'配置完整'},{name:kind==='model'?'最小对话':'最小任务',state:'passed',detail:'连通检查通过'}]},createdAt:now(),updatedAt:now(),connectionHistory:[{revision:1,at:now(),changes:['初始连接配置'],status:'ready'}],configHistory:[]};directory.set(x.id,{id:x.id,kind,latestVersion:'V1',versions:[x]});chosen.set(x.id,'V1');}
for(const x of models.filter(x=>x.roles?.includes('靶标')))seed(x,'model');for(const x of agents)seed(x,'agent');
for(const record of directory.values())for(const x of record.versions){
 x.sourceConnectionId='enterprise-core';x.sourceId=x.id;x.source='企业 AI 资产平台';x.sourceStatus='已上线';
 x.enterpriseVersion=x.kind==='model'?(x.id.includes('qwen')?'2026.11':'V3-0324'):x.id.includes('0210')?'0.2.10':x.id.includes('orchestrator')?'0.0.5-fixed':x.id.includes('1195')?'1.19.5':'0.5.2';
 x.department=x.kind==='model'?'模型研发部':'智能应用部';x.environment='生产';x.sourceUpdatedAt||='2026-11-22T08:30:00.000Z';x.syncedAt='2026-11-23T01:40:00.000Z';x.tags=[x.kind==='model'?'对话服务':'业务交付'];
 if(x.kind==='agent'&&!x.baseModelSnapshot)x.baseModelSnapshot={id:x.baseModelId,name:'企业运行基座',status:'connected'};
}
export function getAsset(id,version){const x=current(id,version);return x?{...clone(x),latestVersion:directory.get(id).latestVersion,versions:clone(directory.get(id).versions)}:null;}
export function getAssetSnapshot(id,version){const x=current(id,version);return x?clone(x):null;}
export function listAssetVersions(id){return clone(directory.get(id)?.versions||[]);}
export function selectAssetVersion(id,version){if(!current(id,version))throw Error('资产版本不存在');chosen.set(id,cv(version));return getAsset(id);}
export function listAssets({kind,status,query,sourceStatus}={}){const q=clean(query).toLowerCase();return [...directory.keys()].map(id=>getAsset(id)).filter(x=>(!kind||kind==='all'||x.kind===kind)&&(!status||status==='all'||x.status===status)&&(!sourceStatus||sourceStatus==='all'||x.sourceStatus===sourceStatus)&&(!q||[x.id,x.name,x.owner,x.source].join(' ').toLowerCase().includes(q)));}
export function listTestableAssets({kind}={}){return [...directory.values()].flatMap(r=>r.versions).filter(x=>x.status==='ready'&&!x.busy&&!['已停用','已移除'].includes(x.sourceStatus)&&(!kind||x.kind===kind)).map(clone);}
export function markAssetUsed(id,version,taskId){const x=current(id,version);if(!x)throw Error('资产版本不存在');if(!clean(taskId))throw Error('请提供演练任务 ID');x.immutable=true;if(!x.usedBy.includes(taskId))x.usedBy.push(taskId);emit();return clone(x);}
export function assetErrors(data,{referenceIds=[]}={}){
 const x=normalize(data),errors=[];
 if(!['model','agent'].includes(x.kind))errors.push('类型必须为 model 或 agent');if(!x.name)errors.push('缺少资产名称');if(!['未发布','已发布','未上线','已上线','已停用','已移除'].includes(x.sourceStatus))errors.push('企业源状态需为未发布、已发布或已停用');
 if(x.kind==='model'){try{if(!['http:','https:'].includes(new URL(x.baseUrl).protocol))throw Error();}catch{errors.push('连接地址需为完整的 HTTP/HTTPS 地址');}if(!x.apiModel)errors.push('缺少请求模型标识 apiModel');}
 if(x.kind==='agent'){
  if(!x.image||!(/:[^/]+$/.test(x.image)||/@sha256:[a-f0-9]{64}$/i.test(x.image)))errors.push('镜像需要明确 tag 或 sha256 摘要');if(!x.command.length)errors.push('缺少可执行命令');if(!['stdin','argv','file'].includes(x.taskInput))errors.push('输入协议需为 stdin、argv 或 file');
  if(x.promptFlag&&!/^--?[a-zA-Z][\w-]*$/.test(x.promptFlag))errors.push('任务参数标记需为单个参数名');if(x.promptFlag&&x.taskInput!=='stdin'&&x.command.includes(x.promptFlag))errors.push('启动参数不要重复填写任务参数标记');
  const base=current(x.baseModelId,x.baseModelVersion),manifest=x.baseModelSnapshot;
  if(!x.baseModelId||((!base||base.kind!=='model')&&!models.some(m=>m.id===x.baseModelId)&&!referenceIds.includes(x.baseModelId)&&(!manifest?.apiModel||!manifest?.baseUrl)))errors.push('企业运行清单缺少基座模型连接');
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
 const id=prev?.id||requested||'asset-'+normalized.kind+'-'+Date.now().toString(36)+'-'+ ++serial,newVersion=Boolean(prev&&mode==='new-version'),version=newVersion?'V'+(Math.max(...record.versions.map(x=>vn(x.version)))+1):prev?.version||'V1';let x;
 if(!prev||newVersion){x={...normalized,id,version,status:'pending',busy:false,connectionRevision:1,credentialConfigured:Boolean(clean(data.apiKey))||prev?.credentialConfigured||false,immutable:false,usedBy:[],capabilities:[],validation:{state:'pending',checkedAt:null,steps:[]},createdAt:now(),updatedAt:now(),connectionHistory:[{revision:1,at:now(),changes:['初始连接配置'],status:'pending'}],configHistory:[]};if(prev){record.versions.push(x);record.latestVersion=version;const secret=secrets.get(key(id,prev.version));if(secret)secrets.set(key(id,version),secret);}else directory.set(id,{id,kind:normalized.kind,latestVersion:version,versions:[x]});}
 else{x=prev;const connectionChanged=changed.some(k=>connKeys.includes(k))||secretChanged,testChanged=changed.some(k=>testKeys.includes(k));if(changed.length)x.configHistory.push({at:now(),changes:changed,note:testChanged?'未演练版本测试配置更新':'资产信息更新'});Object.assign(x,normalized,{updatedAt:now()});if(connectionChanged){x.connectionRevision++;x.connectionHistory.push({revision:x.connectionRevision,at:now(),changes:[...changed.filter(k=>connKeys.includes(k)),...(secretChanged?['访问凭据已更新']:[])],status:'pending'});}if(connectionChanged||testChanged){x.status='pending';x.capabilities=[];x.validation={state:'pending',checkedAt:null,steps:[]};}}
 if(clean(data.apiKey)){secrets.set(key(id,version),clean(data.apiKey));x.credentialConfigured=true;}chosen.set(id,version);emit();return getAsset(id,version);
}
export function updateAssetConnection(id,version,data){return saveAsset({...data,id,version},{mode:'connection'});}
export function parseAssetImport(text,format='json'){
 const source=String(text).replace(/^\uFEFF/,'');if(format==='json'||clean(source).startsWith('[')||clean(source).startsWith('{')){const p=JSON.parse(source),items=Array.isArray(p)?p:p.assets;if(!Array.isArray(items)||items.some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw Error('JSON 需为资产对象数组或包含 assets 数组');return items;}
 const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(cell);if(row.some(clean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('CSV 引号未闭合');row.push(cell);if(row.some(clean))rows.push(row);if(rows.length<2)throw Error('CSV 需要表头和资产记录');const heads=rows.shift().map(clean);if(new Set(heads).size!==heads.length||heads.some(k=>!k))throw Error('CSV 表头不可为空或重复');return rows.map((vals,i)=>{if(vals.length!==heads.length)throw Error('CSV 第 '+(i+2)+' 行列数不一致');return Object.fromEntries(heads.map((k,j)=>[k,vals[j]]));});
}
export function previewAssets(items){const refs=items.filter(x=>x.kind==='model').map(x=>clean(x.id)).filter(Boolean),seen=new Set();return items.map((raw,i)=>{const id=clean(raw.id),record=directory.get(id),prev=record&&current(id,record.latestVersion),data=normalize(raw,prev||{}),errors=assetErrors(data,{referenceIds:refs});if(!id)errors.push('批量清单需填写稳定且唯一的 id');else if(!/^[\w.:-]{1,100}$/.test(id))errors.push('id 格式不正确');if(seen.has(id))errors.push('同一批次资产 ID 重复');seen.add(id);if(record&&record.kind!==data.kind)errors.push('同一 ID 已属于其他资产类型');if(prev?.busy)errors.push('该资产正在进行连通检查');const changed=prev?diff(data,prev):[],testChanged=changed.some(k=>testKeys.includes(k)),connectionChanged=changed.some(k=>connKeys.includes(k)),metadataChanged=changed.some(k=>metaKeys.includes(k)),secretChanged=Boolean(clean(raw.apiKey))&&secrets.get(key(id,prev?.version))!==clean(raw.apiKey),nextVersion='V'+(Math.max(...(record?.versions||[]).map(x=>vn(x.version)),0)+1),operation=!record?'新增 V1':testChanged?'新版本 '+nextVersion:connectionChanged||secretChanged?'连接修订 R'+((prev?.connectionRevision||0)+1):metadataChanged?'同步资产信息':'内容未变';return{row:i+1,id,data:{...data,id},raw:{...raw,id},errors,operation,existingId:record?.id||null};});}
export function importAssets(items){const preview=previewAssets(items),imported=[],changed=[],errors=preview.filter(x=>x.errors.length).map(x=>({row:x.row,errors:x.errors}));for(const item of preview.filter(x=>!x.errors.length).sort((a,b)=>(a.data.kind==='model'?0:1)-(b.data.kind==='model'?0:1))){try{const mode=item.operation.startsWith('新版本 ')?'new-version':'edit',result=item.operation==='内容未变'?getAsset(item.id,directory.get(item.id).latestVersion):saveAsset(item.raw,{mode});imported.push(result);if(item.operation!=='内容未变')changed.push(result);}catch(error){errors.push({row:item.row,errors:[error.message]});}}return{imported,changed,errors};}
export async function validateAsset(id,{version,onProgress,delay=240}={}){
 const x=current(id,version);if(!x)throw Error('资产版本不存在');const k=key(id,x.version);if(checks.has(k))return checks.get(k);
 const run=(async()=>{const names=x.kind==='model'?['配置与协议','连接与认证','最小对话','能力登记']:['镜像与启动参数','基座模型与变量','最小任务','能力登记'];x.busy=true;x.validation={state:'running',checkedAt:null,steps:names.map(name=>({name,state:'pending',detail:'等待检查'}))};emit();
 for(let i=0;i<names.length;i++){const step=x.validation.steps[i];step.state='running';step.detail='正在检查';onProgress?.(getAsset(id,x.version));if(delay)await new Promise(r=>setTimeout(r,delay));let problem='';if(i===0)problem=assetErrors(x).join('；');if(i===1&&x.kind==='model'&&!x.credentialConfigured)problem='未配置访问凭据，请补充 API Key 后重试';if(i===1&&x.kind==='model'&&/(?:invalid|unreachable|fail)\./i.test(x.baseUrl))problem='连接失败，请检查地址或凭据';if(i===1&&x.kind==='agent'&&current(x.baseModelId,x.baseModelVersion)?.status!=='ready'&&!(x.baseModelSnapshot?.apiModel&&x.baseModelSnapshot?.baseUrl&&x.baseModelSnapshot.status!=='error'))problem='企业运行清单中的基座模型连接不可用';if(i===2&&x.kind==='agent'&&/(?:missing|invalid):/i.test(x.image))problem='镜像启动失败，请修改镜像或启动配置';if(problem){step.state='failed';step.detail=problem;x.status='failed';x.validation.state='failed';break;}step.state='passed';step.detail=x.kind==='model'?['连接配置与兼容协议符合要求','连接与认证通过','收到最小对话响应','可用于模型演练'][i]:['镜像与输入协议配置完整','基座模型可用，标准环境变量已适配','已生成最小任务结果与轨迹','可用于 Agent 演练'][i];onProgress?.(getAsset(id,x.version));}
 if(x.validation.state!=='failed'){x.status='ready';x.validation.state='passed';x.capabilities=x.kind==='model'?['文本对话']:['沙箱执行','任务轨迹','文件证据'];}x.busy=false;x.validation.checkedAt=now();x.updatedAt=now();const revision=x.connectionHistory.find(r=>r.revision===x.connectionRevision);if(revision){revision.status=x.status;revision.checkedAt=now();}emit();onProgress?.(getAsset(id,x.version));return getAsset(id,x.version);})();checks.set(k,run);try{return await run;}finally{x.busy=false;checks.delete(k);}
}
export const ASSET_IMPORT_EXAMPLE=[{id:'support-model',kind:'model',name:'客服模型',owner:'模型研发',source:'企业资产台账',sourceStatus:'未发布',baseUrl:'https://api.example.com/v1',apiModel:'customer-service-model',apiKey:''},{id:'support-agent',kind:'agent',name:'客服 Agent',owner:'应用研发',source:'企业资产台账',sourceStatus:'未发布',image:'company/customer-agent:1.0',command:['customer-agent','--auto'],taskInput:'stdin',baseModelId:'support-model',baseModelVersion:'V1',surfaceDeclarations:[{kind:'instruction',path:'AGENTS.md',description:'工作区指令'}]}];


/* Enterprise sync owns source fields; pages may only supplement local credentials. */
export function applyEnterpriseAsset(input, connectionId='enterprise-core') {
 const sourceId=clean(input.sourceId||input.id);
 const known=[...directory.values()].find(r=>r.versions.some(v=>v.sourceConnectionId===connectionId&&v.sourceId===sourceId));
 const id=known?.id||(connectionId==='enterprise-core'?sourceId:connectionId+':'+sourceId);
 const prev=known&&clone(current(id,known.latestVersion));
 const data={...input,id,version:prev?.version,sourceId,sourceConnectionId:connectionId,source:input.source||'企业资产平台',syncedAt:input.syncedAt||now()};
 const normalized=normalize(data,prev||{});
 const impact=prev?diff(prev,normalized,[...testKeys,...connKeys]):[];
 const changed=prev?diff(prev,normalized,configKeys.filter(k=>k!=='syncedAt')):[];
 const result=saveAsset(data,{mode:prev&&impact.length?'new-version':'edit'});
 const live=current(id,result.version);live.syncedAt=data.syncedAt;
 if(!prev||impact.length){live.status=live.credentialConfigured||live.kind==='agent'?'pending':'incomplete';live.retestRequired=Boolean(prev);}
 emit();return {asset:getAsset(id),operation:!prev?'added':changed.length?'updated':'unchanged',changes:changed.map(field=>({field,before:prev?.[field],after:normalized[field]})),requiresRetest:Boolean(impact.length)};
}
export function supplementAssetConnection(id,version,{apiKey='',credentialRef=''}={}) {
 const x=current(id,version);if(!x)throw Error('资产不存在');
 if(!clean(apiKey)&&!clean(credentialRef)&&!x.credentialConfigured)throw Error('请填写调用凭据或选择凭据引用');
 if(clean(apiKey))secrets.set(key(id,x.version),clean(apiKey));
 x.credentialConfigured=true;x.credentialRef=clean(credentialRef)||x.credentialRef||'本平台专用凭据';x.status='pending';emit();return getAsset(id,x.version);
}
