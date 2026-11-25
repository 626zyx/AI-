/* Shared classification metadata stays separate from resource content and task snapshots. */
import { scenes } from '../data/catalog.js';
import { RISK_LABEL } from './constants.js';

export const RESOURCE_TAG_STORAGE_KEY='ai-range-resource-tags-v1';
export const TAG_DIMENSIONS={business:'业务类型',risk:'风险场景'};
export const DEFAULT_RESOURCE_TAGS={question:{business:['通用'],risk:[...new Set(scenes.map(row=>row.label))]},environment:{business:['业务交付与保密'],risk:[...new Set(Object.values(RISK_LABEL).map(row=>row.label))]}};
const kinds=['question','environment'],systemDimensions=Object.keys(TAG_DIMENSIONS);
const copy=value=>structuredClone(value),clean=value=>String(value??'').trim(),normalized=value=>clean(value).normalize('NFKC').toLocaleLowerCase();
const now=()=>new Date().toISOString(),object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const setAlias=(aliases,key,id)=>Object.defineProperty(aliases,key,{value:id,writable:true,enumerable:true,configurable:true});
const dimensionIds=state=>state.dimensions.map(row=>row.id);
let memory,serial=0;
function storage(){return globalThis.localStorage||globalThis.window?.localStorage||null;}
function checkKind(kind){if(!kinds.includes(kind))throw Error('资源类型不存在');}
function checkDimension(state,id){if(!state.dimensions.some(row=>row.id===id))throw Error('标签维度不存在');}
function resourceId(value){const id=clean(value);if(!id||id.length>2000)throw Error('资源标识无效');return id;}
function resourceKey(kind,id){checkKind(kind);return JSON.stringify([kind,resourceId(id)]);}
function tagName(value){const name=clean(value);if(!name||name.length>60)throw Error('请填写 1—60 个字符的标签名称');return name;}
function dimensionName(value){const name=clean(value);if(!name||name.length>60)throw Error('请填写 1—60 个字符的维度名称');return name;}
function newId(prefix){return prefix+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+ ++serial);}
function write(state){try{storage()?.setItem(RESOURCE_TAG_STORAGE_KEY,JSON.stringify(state));}catch{throw Error('标签未保存，请检查浏览器存储空间后重试');}memory=copy(state);}
function emptyState(){return {schema:3,dimensions:systemDimensions.map(id=>({id,name:TAG_DIMENSIONS[id],system:true})),tags:[],seedAliases:Object.fromEntries(kinds.map(kind=>[kind,{business:{},risk:{}}])),resources:{}};}
function aliasesFor(state,kind,dimension){return state.seedAliases[kind][dimension];}
function addMissingDefaults(state){
  const at=now();
  for(const kind of kinds)for(const dimension of systemDimensions)for(const [index,name]of DEFAULT_RESOURCE_TAGS[kind][dimension].entries()){
    const aliases=aliasesFor(state,kind,dimension),key=normalized(name);
    // Historical seed aliases retain each resource kind's rename/deletion choices.
    if(Object.hasOwn(aliases,key))continue;
    let tag=state.tags.find(row=>row.dimension===dimension&&normalized(row.name)===key);
    if(!tag){let id=`tag-${kind}-${dimension}-preset-${index}`;if(state.tags.some(row=>row.id===id))id=newId('tag');tag={id,dimension,name,preset:true,createdAt:at,updatedAt:at};state.tags.push(tag);}
    setAlias(aliases,key,tag.id);
  }
}
function validAliases(value){return object(value)&&Object.values(value).every(id=>typeof id==='string');}
function validState(state){
  if(!object(state)||![1,2,3].includes(state.schema)||!Array.isArray(state.tags)||!object(state.resources))return false;
  const dimensions=state.schema===3?state.dimensions:systemDimensions.map(id=>({id,name:TAG_DIMENSIONS[id],system:true}));
  if(!Array.isArray(dimensions)||!dimensions.every(row=>object(row)&&typeof row.id==='string'&&/^[\w-]+$/.test(row.id)&&typeof row.name==='string'&&row.name.trim()&&typeof row.system==='boolean')||new Set(dimensions.map(row=>row.id)).size!==dimensions.length||new Set(dimensions.map(row=>normalized(row.name))).size!==dimensions.length)return false;
  if(!systemDimensions.every(id=>dimensions.some(row=>row.id===id&&row.name===TAG_DIMENSIONS[id]&&row.system)))return false;
  const ids=dimensions.map(row=>row.id);
  if(!state.tags.every(tag=>object(tag)&&typeof tag.id==='string'&&ids.includes(tag.dimension)&&typeof tag.name==='string'&&(state.schema!==2||kinds.includes(tag.kind)))||new Set(state.tags.map(tag=>tag.id)).size!==state.tags.length)return false;
  if(!Object.values(state.resources).every(row=>object(row)&&kinds.includes(row.kind)&&typeof row.id==='string'&&ids.every(id=>row[id]===undefined&&state.schema===3||Array.isArray(row[id])&&row[id].every(value=>typeof value==='string'))))return false;
  return state.schema===1?ids.every(id=>validAliases(state.seedAliases?.[id])):kinds.every(kind=>ids.every(id=>validAliases(state.seedAliases?.[kind]?.[id])));
}
function migrate(legacy){
  const state=emptyState(),mapping=new Map();
  for(const source of legacy.tags){
    const existing=state.tags.find(row=>row.dimension===source.dimension&&normalized(row.name)===normalized(source.name));
    if(existing){mapping.set(source.id,existing.id);existing.preset=Boolean(existing.preset||source.preset);continue;}
    const {kind,...tag}=copy(source);
    if(legacy.schema===1&&!legacy.presetMetadataVersion&&source.dimension==='business'&&legacy.seedAliases.business[normalized('业务交付与保密')]===source.id)tag.preset=true;
    state.tags.push(tag);mapping.set(source.id,tag.id);
  }
  for(const kind of kinds)for(const dimension of systemDimensions){
    const aliases=legacy.schema===1?legacy.seedAliases[dimension]:legacy.seedAliases[kind][dimension];
    for(const [name,id]of Object.entries(aliases))setAlias(aliasesFor(state,kind,dimension),name,mapping.get(id)||id);
  }
  const oldTags=new Map(legacy.tags.map(tag=>[tag.id,tag]));
  for(const row of Object.values(legacy.resources)){
    const next=copy(row);
    for(const dimension of systemDimensions)next[dimension]=[...new Set(row[dimension].filter(id=>oldTags.get(id)?.dimension===dimension).map(id=>mapping.get(id)).filter(Boolean))];
    state.resources[resourceKey(row.kind,row.id)]=next;
  }
  addMissingDefaults(state);return state;
}
function read(){
  const target=storage();let raw;
  try{raw=target?.getItem(RESOURCE_TAG_STORAGE_KEY);}catch{throw Error('无法读取已保存的标签');}
  if(raw==null){if(!target&&memory)return copy(memory);const state=emptyState();addMissingDefaults(state);write(state);return state;}
  let state;try{state=JSON.parse(raw);}catch{throw Error('标签数据无法读取，请保留浏览器数据并联系管理员');}
  if(!validState(state))throw Error('标签数据格式不正确，请保留浏览器数据并联系管理员');
  if(state.schema!==3){state=migrate(state);write(state);}return state;
}
function seedNames(value){if(value==null)return [];return [...new Set((Array.isArray(value)?value:[value]).map(clean).filter(Boolean))];}
function migrateSeed(state,kind,dimension,label){
  const name=tagName(label),key=normalized(name),aliases=aliasesFor(state,kind,dimension);
  if(Object.hasOwn(aliases,key))return state.tags.some(tag=>tag.id===aliases[key]&&tag.dimension===dimension)?aliases[key]:null;
  const existing=state.tags.find(tag=>tag.dimension===dimension&&normalized(tag.name)===key);
  if(existing){setAlias(aliases,key,existing.id);return existing.id;}
  const at=now(),id=newId('tag-'+dimension),preset=kinds.some(scope=>(DEFAULT_RESOURCE_TAGS[scope][dimension]||[]).some(value=>normalized(value)===key));
  state.tags.push({id,dimension,name,preset,createdAt:at,updatedAt:at});setAlias(aliases,key,id);return id;
}
function links(state,kind,id,tagsById=new Map(state.tags.map(tag=>[tag.id,tag]))){
  const record=state.resources[resourceKey(kind,id)];
  return Object.fromEntries(dimensionIds(state).map(dimension=>[dimension,(record?.[dimension]||[]).filter(tagId=>tagsById.get(tagId)?.dimension===dimension)]));
}
function usage(state,id){
  const resources=Object.values(state.resources).filter(row=>dimensionIds(state).some(dimension=>(row[dimension]||[]).includes(id))).map(row=>({kind:row.kind,id:row.id,title:row.title||row.id}));
  return {usageCount:resources.length,questionCount:resources.filter(row=>row.kind==='question').length,environmentCount:resources.filter(row=>row.kind==='environment').length,resources};
}
function sharedTag(state,id,kind){if(kind!==undefined)checkKind(kind);return state.tags.find(tag=>tag.id===id);}
export function listTagDimensions(){return copy(read().dimensions);}
function addDimension(state,value){
  const name=dimensionName(value);if(state.dimensions.some(row=>normalized(row.name)===normalized(name)))throw Error('已存在同名维度');
  const dimension={id:newId('dimension'),name,system:false};state.dimensions.push(dimension);
  for(const kind of kinds)state.seedAliases[kind][dimension.id]={};return dimension;
}
export function createTagDimension(name){const state=read(),dimension=addDimension(state,name);write(state);return copy(dimension);}
function addTag(state,dimension,value,createdAt=now()){
  checkDimension(state,dimension);const name=tagName(value),key=normalized(name);
  if(state.tags.some(tag=>tag.dimension===dimension&&normalized(tag.name)===key))throw Error('该维度已存在同名标签');
  const tag={id:newId('tag-'+dimension),dimension,name,preset:false,createdAt,updatedAt:createdAt};state.tags.push(tag);
  for(const kind of kinds)setAlias(aliasesFor(state,kind,dimension),key,tag.id);return tag;
}
/** One durable write; failure leaves neither a new dimension nor a tag. */
export function createTagWithDimension({name,dimensionId,dimensionName:newDimensionName}={}){
  const state=read();if(dimensionId&&newDimensionName!==undefined)throw Error('请选择已有维度或填写新维度');
  const dimension=newDimensionName!==undefined?addDimension(state,newDimensionName):state.dimensions.find(row=>row.id===dimensionId);
  if(!dimension)throw Error('请选择标签维度');const tag=addTag(state,dimension.id,name);write(state);return copy({tag,dimension});
}
function tagBatch(state,{text='',dimensionId,dimensionName:newDimensionName}={}){
  const errors=[],names=[],seen=new Set();let existingCount=0,duplicateCount=0,inputCount=0,invalidCount=0;
  const dimension=state.dimensions.find(row=>row.id===dimensionId);
  if(dimensionId&&newDimensionName!==undefined)errors.push('请选择已有维度或填写新维度');
  else if(newDimensionName!==undefined){
    try{dimensionName(newDimensionName);if(state.dimensions.some(row=>normalized(row.name)===normalized(newDimensionName)))errors.push('已存在同名维度');}
    catch(error){errors.push(error.message);}
  }else if(!dimension)errors.push('请选择标签维度');
  const existing=new Set(state.tags.filter(row=>row.dimension===dimension?.id).map(row=>normalized(row.name)));
  String(text).split(/\r\n|\r|\n/).forEach((line,index)=>{
    const name=clean(line);if(!name)return;inputCount++;
    try{tagName(name);}catch(error){errors.push(`第 ${index+1} 行：${error.message}`);invalidCount++;return;}
    const key=normalized(name);if(seen.has(key)){duplicateCount++;return;}seen.add(key);
    if(existing.has(key))existingCount++;else names.push(name);
  });
  if(!inputCount)errors.push('请每行填写一个标签名称');
  return {names,newCount:names.length,inputCount,existingCount,duplicateCount,skippedCount:existingCount+duplicateCount,invalidCount,errors};
}
export function previewTagBatch(input){return copy(tagBatch(read(),input));}
/** Validate every line first, then persist the new dimension and all labels together. */
export function createTagsWithDimension(input={}){
  const state=read(),preview=tagBatch(state,input);if(preview.errors.length)throw Error(preview.errors.join('；'));
  let dimension=state.dimensions.find(row=>row.id===input.dimensionId);
  if(!preview.newCount)return copy({...preview,createdCount:0,tags:[],dimension});
  if(input.dimensionName!==undefined)dimension=addDimension(state,input.dimensionName);
  // One batch shares its timestamp, preserving input order while appearing before prior labels.
  const latest=state.tags.reduce((value,tag)=>Math.max(value,Date.parse(tag.createdAt)||0),0);
  const createdAt=new Date(Math.max(Date.now(),latest+1)).toISOString();
  const tags=preview.names.map(name=>addTag(state,dimension.id,name,createdAt));
  write(state);return copy({...preview,createdCount:tags.length,tags,dimension});
}
export function registerResourceSeeds(kind,resources,{replace=false}={}){
  checkKind(kind);if(!Array.isArray(resources))throw Error('资源清单格式不正确');
  const state=read(),seen=new Set();let changed=false;
  for(const input of resources){
    const id=resourceId(input.id),key=resourceKey(kind,id);if(seen.has(key))throw Error('资源清单包含重复标识');seen.add(key);
    const previous=state.resources[key],title=clean(input.title||input.name||id);
    if(previous){if((input.title||input.name)&&previous.title!==title){previous.title=title;changed=true;}continue;}
    const record={kind,id,title,updatedAt:now()};
    for(const dimension of dimensionIds(state))record[dimension]=[...new Set(seedNames(input.seeds?.[dimension]).map(name=>migrateSeed(state,kind,dimension,name)).filter(Boolean))];
    state.resources[key]=record;changed=true;
  }
  if(replace)for(const [key,record]of Object.entries(state.resources))if(record.kind===kind&&!seen.has(key)){delete state.resources[key];changed=true;}
  if(changed)write(state);const tagsById=new Map(state.tags.map(tag=>[tag.id,tag]));return resources.map(resource=>({id:resource.id,...links(state,kind,resource.id,tagsById)}));
}
export function listTags(dimension,kind='question'){
  checkKind(kind);const state=read();checkDimension(state,dimension);
  return copy(state.tags.filter(tag=>tag.dimension===dimension).map(tag=>{const {resources,...counts}=usage(state,tag.id);return {...tag,...counts};}));
}
export function getTag(id,kind){const state=read(),tag=sharedTag(state,id,kind);return tag?copy({...tag,...usage(state,id)}):null;}
export function getTagUsage(id,kind){const state=read();if(!sharedTag(state,id,kind))throw Error('标签不存在或已删除');return copy(usage(state,id));}
export function getResourceTags(kind,id,seeds){if(seeds!==undefined)registerResourceSeeds(kind,[{id,seeds}]);return copy(links(read(),kind,id));}
export function getResourceTagNames(kind,id,seeds){
  if(seeds!==undefined)registerResourceSeeds(kind,[{id,seeds}]);const state=read(),tagsById=new Map(state.tags.map(tag=>[tag.id,tag])),selected=links(state,kind,id,tagsById);
  return Object.fromEntries(dimensionIds(state).map(dimension=>[dimension,selected[dimension].map(tagId=>tagsById.get(tagId).name)]));
}
export function getResourcesTags(kind,ids){
  checkKind(kind);if(!Array.isArray(ids))throw Error('资源清单格式不正确');const state=read(),tagsById=new Map(state.tags.map(tag=>[tag.id,tag]));
  return [...new Set(ids.map(resourceId))].map(id=>{
    if(!state.resources[resourceKey(kind,id)])throw Error('部分资源已移除，请刷新后重新选择');
    const selected=links(state,kind,id,tagsById),names=Object.fromEntries(dimensionIds(state).map(dimension=>[dimension,selected[dimension].map(tagId=>tagsById.get(tagId).name)]));return {id,...selected,names};
  });
}
export function saveResourcesTags(kind,ids,selection){
  checkKind(kind);if(!Array.isArray(ids)||!ids.length)throw Error('请先选择资源');const state=read();
  if(!object(selection))throw Error('标签选择格式不正确');
  const selectedDimensions=Object.keys(selection);if(!selectedDimensions.length)throw Error('请至少选择一个要替换的标签维度');
  const replacement={};
  for(const dimension of selectedDimensions){
    checkDimension(state,dimension);if(!Array.isArray(selection[dimension]))throw Error('标签选择格式不正确');replacement[dimension]=[...new Set(selection[dimension].map(clean))];
    if(replacement[dimension].some(id=>!state.tags.some(tag=>tag.id===id&&tag.dimension===dimension)))throw Error('部分标签已删除或维度不匹配，请重新选择');
  }
  const uniqueIds=[...new Set(ids.map(resourceId))];for(const id of uniqueIds)if(!state.resources[resourceKey(kind,id)])throw Error('部分资源已移除，请刷新后重新选择');
  for(const id of uniqueIds)Object.assign(state.resources[resourceKey(kind,id)],copy(replacement),{updatedAt:now()});
  write(state);const tagsById=new Map(state.tags.map(tag=>[tag.id,tag]));return uniqueIds.map(id=>({id,...links(state,kind,id,tagsById)}));
}
export function saveResourceTags(kind,id,selection){return saveResourcesTags(kind,[id],{business:selection.business||[],risk:selection.risk||[],...selection})[0];}
export function createTag(dimension,name,kind='question'){checkKind(kind);const state=read(),tag=addTag(state,dimension,name);write(state);return copy(tag);}
export function renameTag(id,value,kind){
  const name=tagName(value),state=read(),tag=sharedTag(state,id,kind);if(!tag)throw Error('标签不存在或已删除');const key=normalized(name);
  if(state.tags.some(row=>row.id!==id&&row.dimension===tag.dimension&&normalized(row.name)===key))throw Error('该维度已存在同名标签');
  for(const scope of kinds){const aliases=aliasesFor(state,scope,tag.dimension);setAlias(aliases,normalized(tag.name),id);setAlias(aliases,key,id);}tag.name=name;tag.updatedAt=now();write(state);return copy(tag);
}
function deletionImpact(state,ids){
  if(!Array.isArray(ids)||!ids.length)throw Error('请先选择标签');
  const unique=[...new Set(ids)],tags=unique.map(id=>state.tags.find(tag=>tag.id===id));
  if(tags.some(tag=>!tag))throw Error('部分标签不存在或已删除，请重新选择');
  const selected=new Set(unique),resources=Object.values(state.resources).filter(row=>dimensionIds(state).some(dimension=>(row[dimension]||[]).some(id=>selected.has(id)))).map(row=>({kind:row.kind,id:row.id,title:row.title||row.id}));
  return {tags,tagCount:tags.length,usageCount:resources.length,questionCount:resources.filter(row=>row.kind==='question').length,environmentCount:resources.filter(row=>row.kind==='environment').length,resources};
}
function unlinkTags(state,tags){
  const ids=new Set(tags.map(tag=>tag.id));
  for(const tag of tags)for(const kind of kinds)setAlias(aliasesFor(state,kind,tag.dimension),normalized(tag.name),tag.id);
  state.tags=state.tags.filter(tag=>!ids.has(tag.id));
  for(const record of Object.values(state.resources))for(const dimension of dimensionIds(state))if(record[dimension])record[dimension]=record[dimension].filter(id=>!ids.has(id));
}
export function getTagsDeletionImpact(ids){return copy(deletionImpact(read(),ids));}
/** Delete a selection and all its relations in one durable write, never resource content. */
export function deleteTags(ids){const state=read(),impact=deletionImpact(state,ids);unlinkTags(state,impact.tags);write(state);return copy(impact);}
function dimensionImpact(state,id){
  const dimension=state.dimensions.find(row=>row.id===id);if(!dimension)throw Error('标签维度不存在或已删除');
  const ids=state.tags.filter(tag=>tag.dimension===id).map(tag=>tag.id);
  return {dimension,...(ids.length?deletionImpact(state,ids):{tags:[],tagCount:0,usageCount:0,questionCount:0,environmentCount:0,resources:[]})};
}
export function getTagDimensionUsage(id){return copy(dimensionImpact(read(),id));}
/** Required dimensions remain available even when all their labels have been deleted. */
export function deleteTagDimension(id){
  const state=read(),impact=dimensionImpact(state,id);if(impact.dimension.system||systemDimensions.includes(id))throw Error('业务类型和风险场景是必需维度，不能删除');
  unlinkTags(state,impact.tags);state.dimensions=state.dimensions.filter(row=>row.id!==id);
  for(const kind of kinds)delete state.seedAliases[kind][id];
  for(const record of Object.values(state.resources))delete record[id];
  write(state);return copy(impact);
}
export function deleteTag(id,kind){
  if(kind!==undefined)checkKind(kind);const {tags,tagCount,...counts}=deleteTags([id]);return {tag:tags[0],...counts};
}
export function removeResourceTags(kind,ids){checkKind(kind);const state=read();for(const id of ids)delete state.resources[resourceKey(kind,id)];write(state);}
