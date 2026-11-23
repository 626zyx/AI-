/* Adapt versioned assets to the original task execution catalog. */
import * as store from './store.js';
import { listAssets, listAssetVersions, getAssetSnapshot, markAssetUsed, subscribeAssets } from './asset-intake.js';
const seedModels = new Map(store.models.map(x=>[x.id,structuredClone(x)]));
const seedAgents = new Map(store.agents.map(x=>[x.id,structuredClone(x)]));
let initialized=false;
export function synchronizeAssetTargets() {
  for(const catalog of [store.models,store.agents])for(let i=catalog.length-1;i>=0;i--)if(catalog[i].assetId)catalog.splice(i,1);
  for(const current of listAssets())for(const asset of listAssetVersions(current.id)){
    const original=(asset.kind==='model'?seedModels:seedAgents).get(asset.id)||{};
    const snapshot=getAssetSnapshot(asset.id,asset.version), status=asset.status==='ready'&&!asset.busy&&!['已停用','已移除'].includes(asset.sourceStatus)?'connected':asset.status==='failed'?'error':'planned';
    if(asset.kind==='agent') snapshot.baseModelSnapshot=asset.baseModelSnapshot||getAssetSnapshot(asset.baseModelId,asset.baseModelVersion)||structuredClone(seedModels.get(asset.baseModelId)||{});
    const row={...structuredClone(original),...snapshot,id:asset.id+'@'+asset.version,assetId:asset.id,assetVersion:asset.version,version:asset.version,assetSnapshot:snapshot,name:asset.name+' · '+(asset.enterpriseVersion||asset.version),status,statusLabel:status==='connected'?'已连通':status==='error'?'连通失败':'待连通'};
    if(asset.kind==='model'){row.roles=['靶标'];row.apiKey='';row.vendor=store.vendorOf(asset.baseUrl||'');store.models.push(row);}
    else {row.surfaces=(asset.surfaceDeclarations||[]).map((surface,index)=>{const old=original.surfaces?.find(x=>x.path===surface.path&&x.kind===surface.kind);return{...(old||{}),...surface,id:old?.id||asset.id+'-surface-'+index,desc:surface.description||old?.desc||'',verified:status==='connected'};});store.agents.push(row);}
  }
}
export function initializeAssetBridge(){
  if(initialized)return;initialized=true;
  for(const task of [...store.listTasks(),...store.listAgentTasks()])if(['running','done','stopped','error'].includes(task.status)){
    const id=String(task.targetId||'').replace(/^tgt-/,'mdl-'), asset=getAssetSnapshot(id,'V1');
    if(asset){markAssetUsed(id,'V1',task.id);if(asset.kind==='agent'&&getAssetSnapshot(asset.baseModelId,asset.baseModelVersion))markAssetUsed(asset.baseModelId,asset.baseModelVersion,task.id);}
  }
  synchronizeAssetTargets();subscribeAssets(synchronizeAssetTargets);
  store.subscribeTasks(({id,type})=>{
    const task=type==='agent'?store.getAgentTask(id):store.getTask(id),config=task?.configSnapshot;
    if(task?.status==='running'&&config?.targetAssetId){
      const asset=getAssetSnapshot(config.targetAssetId,config.targetAssetVersion);
      if(asset&&!asset.usedBy.includes(id))markAssetUsed(config.targetAssetId,config.targetAssetVersion,id);
      if(asset?.kind==='agent'){const base=getAssetSnapshot(asset.baseModelId,asset.baseModelVersion);if(base&&!base.usedBy.includes(id))markAssetUsed(base.id,base.version,id);}
    }
  });
}
