/* Enterprise connectors are a separate state machine. Only successful reads commit assets. */
import { listAssets, applyEnterpriseAsset } from './asset-intake.js';
import { pushNotification } from './notifications.js';
const copy=value=>JSON.parse(JSON.stringify(value)), now=()=>new Date().toISOString();
const listeners=new Set(), credentials=new Map(), running=new Map(), history=[];
let serial=0;
const seedAssets=listAssets().map(a=>({...a,id:a.sourceId||a.id,status:a.sourceStatus,version:a.enterpriseVersion,endpoint:a.baseUrl||a.runtimeEndpoint||a.image,changedAt:a.sourceUpdatedAt}));
const connectors=[{id:'enterprise-core',name:'企业 AI 资产平台',connector:'rest',baseUrl:'https://assets.enterprise.cn/api',resourcePath:'/ai-assets',authType:'bearer',credentialConfigured:true,listPath:'data.items',pageMode:'cursor',timeout:30,mapping:{id:'id',name:'name',kind:'kind',status:'status',version:'version',endpoint:'endpoint',updatedAt:'changedAt'},statusMap:{published:'已上线',draft:'未上线',disabled:'已停用'},kinds:['model','agent'],environment:'全部',department:'全部',selectedIds:seedAssets.map(a=>a.id),autoInclude:true,notifyChanges:true,interval:30,reconcile:'每日',webhook:false,status:'connected',lastSync:'2026-11-23T01:40:00.000Z',lastAttempt:'2026-11-23T01:40:00.000Z',nextSync:'2026-11-23T02:10:00.000Z',lastCount:seedAssets.length,error:'',syncCount:0}];
const sources=new Map([['enterprise-core',seedAssets.map(a=>copy(a))]]);
const emit=event=>{for(const fn of [...listeners])fn(event);};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function subscribeAssetSync(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export const listConnections=()=>copy(connectors);
export const getConnection=id=>{const c=connectors.find(x=>x.id===id);return c?copy(c):null;};
export const listSyncRuns=id=>copy(history.filter(x=>!id||x.connectionId===id));
export const SOURCE_FIELDS=['id','name','kind','status','version','endpoint','changedAt','owner','department','environment'];
export const DEFAULT_MAPPING={id:'id',name:'name',kind:'kind',status:'status',version:'version',endpoint:'endpoint',updatedAt:'changedAt'};
export function newConnectionDraft(){return {name:'',connector:'rest',baseUrl:'',resourcePath:'/ai-assets',authType:'bearer',credential:'',credentialConfigured:false,listPath:'data.items',pageMode:'cursor',timeout:30,mapping:{...DEFAULT_MAPPING},statusMap:{published:'已上线',draft:'未上线',disabled:'已停用'},kinds:['model','agent'],environment:'全部',department:'全部',selectedIds:null,autoInclude:true,notifyChanges:true,interval:30,reconcile:'每日',webhook:false};}
export function connectionErrors(c,{mapping=false}={}){
 const errors=[];if(!c.name?.trim())errors.push('请填写连接名称');
 if(!c.baseUrl?.trim())errors.push('请填写 API 地址');
 if(!c.resourcePath?.trim())errors.push('请填写资产资源路径');
 if(c.authType!=='none'&&!c.credential?.trim()&&!c.credentialConfigured)errors.push('请填写平台读取凭据');
 if(mapping){for(const field of Object.keys(DEFAULT_MAPPING))if(!SOURCE_FIELDS.includes(c.mapping?.[field]))errors.push('请映射'+({id:'企业 ID',name:'名称',kind:'类型',status:'状态',version:'企业版本',endpoint:'地址',updatedAt:'更新时间'}[field]));if(!c.kinds?.length)errors.push('请至少选择一种资产类型');}
 return errors;
}
export async function testConnection(draft,{wait=360}={}){
 const errors=connectionErrors(draft);if(errors.length)throw Error(errors.join('；'));await delay(wait);
 return {readable:true,parseable:true,count:connectionRecords(draft).length,latency:86,fields:[...SOURCE_FIELDS]};
}
export function connectionRecords(connection){
 const c=typeof connection==='string'?getConnection(connection):connection;
 const rows=sources.get(c?.id)||seedAssets;
 return copy(rows);
}
export function filteredSourceRows(c){return connectionRecords(c).filter(a=>(c.kinds||[]).includes(a.kind)&&(!c.environment||c.environment==='全部'||a.environment===c.environment)&&(!c.department||c.department==='全部'||a.department===c.department));}
function mappedRows(c){return filteredSourceRows(c).filter(row=>c.selectedIds===null||c.selectedIds?.includes(row.id)||c.autoInclude&&c.lastSync&&!listAssets().some(a=>a.sourceConnectionId===c.id&&a.sourceId===row.id)).map(row=>{
 const read=key=>row[c.mapping?.[key]||DEFAULT_MAPPING[key]];
 const mapped={...row,id:read('id'),sourceId:read('id'),name:read('name'),kind:read('kind'),enterpriseVersion:read('version'),sourceStatus:c.statusMap?.[read('status')]||read('status'),source:c.name,sourceConnectionId:c.id,sourceUpdatedAt:read('updatedAt')??'',syncedAt:now()};
 if(mapped.kind==='model')mapped.baseUrl=read('endpoint');else if(/^https?:/i.test(read('endpoint')||''))mapped.runtimeEndpoint=read('endpoint');else mapped.image=read('endpoint');
 const errors=[];if(!mapped.id)errors.push('企业 ID 为空');if(!mapped.name)errors.push('资产名称为空');if(!['model','agent'].includes(mapped.kind))errors.push('类型无法识别');if(!mapped.enterpriseVersion)errors.push('企业版本为空');
 return {sourceId:row.id,data:mapped,errors};
});}
export function previewConnection(c){
 const rows=mappedRows(c),existing=listAssets();
 return rows.map(row=>{const old=existing.find(a=>a.sourceConnectionId===c.id&&a.sourceId===row.data.sourceId);const fields=['name','sourceStatus','enterpriseVersion','baseUrl','runtimeEndpoint','image','owner','sourceUpdatedAt'];const changes=old?fields.filter(k=>String(old[k]??'')!==String(row.data[k]??'')).map(field=>({field,before:old[field]||'—',after:row.data[field]||'—'})):[];
 return {...row,operation:row.errors.length?'failed':!old?'added':changes.length?'updated':'unchanged',changes};});
}
export function saveConnection(draft){
 const errors=connectionErrors(draft,{mapping:true});if(errors.length)throw Error(errors.join('；'));
 const old=connectors.find(c=>c.id===draft.id);if(old?.status==='syncing')throw Error('同步进行中，请稍后修改');
 const {credential,...safe}=copy(draft),id=old?.id||'enterprise-'+Date.now().toString(36)+'-'+ ++serial;
 const rec={...old,...safe,id,credentialConfigured:Boolean(credential)||old?.credentialConfigured||draft.authType==='none',status:'connected',error:'',syncCount:old?.syncCount||0};
 if(credential)credentials.set(id,credential);if(old)Object.assign(old,rec);else{connectors.push(rec);sources.set(id,copy(seedAssets));}
 emit({type:'connection',connectionId:id});return copy(rec);
}
function prepareSource(c){
 if(c.id!=='enterprise-core'||c.syncCount>0)return;
 const rows=sources.get(c.id);const model=rows.find(a=>a.kind==='model'&&a.id.includes('qwen'));
 if(model){model.version='2026.11.1';model.enterpriseVersion='2026.11.1';model.changedAt=now();}
 const agent=rows.find(a=>a.kind==='agent'&&a.id.includes('1195'));if(agent){agent.owner='智能应用 · 交付团队';agent.changedAt=now();}
 rows.push({id:'enterprise-policy-model',name:'政策问答模型',kind:'model',status:'未上线',sourceStatus:'未上线',version:'1.0.0',enterpriseVersion:'1.0.0',endpoint:'https://ai.enterprise.cn/policy/v1',baseUrl:'https://ai.enterprise.cn/policy/v1',apiModel:'policy-assistant',owner:'知识服务组',department:'模型研发部',environment:'预发布',tags:['政策问答'],changedAt:now()});
}
export async function synchronizeConnection(id,{wait=260,retryOnly=false}={}){
 if(running.has(id))return running.get(id);
 const c=connectors.find(x=>x.id===id);if(!c)throw Error('连接不存在');
 const run=(async()=>{c.status='syncing';c.error='';c.lastAttempt=now();emit({type:'sync-start',connectionId:id});
 try{
 await testConnection({...c,credential:credentials.get(id)||''},{wait});prepareSource(c);
 const retryIds=new Set((history.find(batch=>batch.connectionId===id)?.rows||[]).filter(row=>row.operation==='failed').map(row=>row.sourceId));const preview=previewConnection(c).filter(row=>!retryOnly||!retryIds.size||retryIds.has(row.sourceId));const rows=[];let done=0;
 for(const item of preview){await delay(Math.min(wait,80));if(item.errors.length){rows.push({...item,assetId:null});continue;}
 try{const applied=applyEnterpriseAsset(item.data,id);rows.push({...item,operation:applied.operation,changes:applied.changes,assetId:applied.asset.id,assetVersion:applied.asset.version,requiresRetest:applied.requiresRetest});}catch(error){rows.push({...item,operation:'failed',errors:[error.message]});}
 done++;emit({type:'sync-progress',connectionId:id,done,total:preview.length});}
 const counts=Object.fromEntries(['added','updated','unchanged','failed'].map(key=>[key,rows.filter(r=>r.operation===key).length]));
 const batch={id:'sync-'+Date.now().toString(36),connectionId:id,connectionName:c.name,at:now(),rows,counts,status:counts.failed?'partial':'done',retryOnly};history.unshift(batch);if(c.autoInclude&&c.selectedIds)c.selectedIds=[...new Set([...c.selectedIds,...rows.filter(r=>r.operation==='added').map(r=>r.sourceId)])];c.syncCount++;c.lastSync=now();c.lastCount=listAssets().filter(asset=>asset.sourceConnectionId===id).length;c.status=counts.failed?'partial':'connected';c.nextSync=new Date(Date.now()+c.interval*60000).toISOString();
 pushNotification({type:'sync',title:c.name+'同步完成',meta:`新增 ${counts.added} · 更新 ${counts.updated} · 失败 ${counts.failed}`,go:`App.aiSyncHistory('${id}')`});
 if(c.notifyChanges)for(const row of rows.filter(x=>x.operation==='updated'||x.operation==='added'))pushNotification({id:batch.id+':'+row.assetId,type:'asset',kind:row.data.kind,title:row.data.name+(row.requiresRetest?'企业版本已更新':'已同步'),meta:row.requiresRetest?'当前版本待复测':'企业资产信息已更新',go:`App.aiDetail('${row.assetId}')`});
 emit({type:'sync-done',connectionId:id,batch:copy(batch)});return copy(batch);
 }catch(error){c.status='error';c.error=error.message;const batch={id:'sync-'+Date.now().toString(36),connectionId:id,connectionName:c.name,at:now(),status:'failed',error:error.message,rows:[],counts:{added:0,updated:0,unchanged:0,failed:1}};history.unshift(batch);pushNotification({type:'sync',title:c.name+'同步失败',meta:error.message,go:`App.aiConnections()`});emit({type:'sync-error',connectionId:id,error:error.message});throw error;}
 })();running.set(id,run);try{return await run;}finally{running.delete(id);}
}
