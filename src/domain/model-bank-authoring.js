/* Model-bank editor contract. OpenRT JSONLDataset consumes one record per line,
 * jailbreak_prompt, optional jailbreak_method/image, and retains other columns. */
import * as Authoring from './resource-authoring.js';

const copy=value=>structuredClone(value);
const clean=value=>String(value??'').trim();
const scenesOf=value=>[...new Set((Array.isArray(value)?value:[value]).map(clean).filter(Boolean))];
export const modelQuestionIdentity=item=>String(item.prompt??item.jailbreak_prompt??'').trim();
const identity=modelQuestionIdentity;
const itemScenes=item=>scenesOf(item.scenes??item.scene??item.business_scene);
const sceneLabel=value=>{const label=Authoring.resourceCatalog()?.sceneLabel?.(value);return label&&label!=='—'?label:value;};

export function parseModelBankJsonl(text,{deduplicate=true}={}){
 const items=[],errors=[],duplicateRows=[],seen=new Map();let total=0;
 String(text??'').replace(/^\uFEFF/,'').split(/\r?\n/).forEach((line,index)=>{
  if(!line.trim())return;total++;
  let raw;
  try{raw=JSON.parse(line);}catch{errors.push({line:index+1,message:'不是有效 JSON'});return;}
  if(!raw||typeof raw!=='object'||Array.isArray(raw)){errors.push({line:index+1,message:'每行必须是 JSON 对象'});return;}
  const prompt=raw.jailbreak_prompt??raw.prompt;
  if(typeof prompt!=='string'||!prompt.trim()){errors.push({line:index+1,message:'jailbreak_prompt 必须为非空字符串'});return;}
  if(!itemScenes(raw).length){errors.push({line:index+1,message:'题目缺少 scene / scenes 场景'});return;}
  try{
   const item=Authoring.parseModelImport([{...raw,prompt,sourceRecord:raw.sourceRecord||raw}])[0],key=identity(item);
   item.id=clean(raw.id)||`L-${index+1}`;item.scenes=itemScenes(raw);item.scene=item.scenes[0];
   if(seen.has(key)){duplicateRows.push({line:index+1,firstLine:seen.get(key)});if(deduplicate)return;}
   else seen.set(key,index+1);
   items.push(item);
  }catch(error){errors.push({line:index+1,message:error.message});}
 });
 if(!total)errors.push({line:0,message:'JSONL 文件没有题目'});
 const report={total,accepted:items.length,duplicates:duplicateRows.length,invalid:errors.length,errors,duplicateRows};
 return {items,valid:errors.length===0&&(deduplicate||duplicateRows.length===0),report};
}

function modelRecord(id){
 const record=Authoring.getAuthoredResource(id);
 if(record){if(record.kind!=='model')throw Error('请选择模型题库');return record;}
 const bank=Authoring.resourceCatalog()?.banks?.find(item=>item.id===id);
 if(!bank)return null;
 const items=copy(bank.items||[]).map(item=>{const scenes=itemScenes(item).map(sceneLabel);return{...item,scene:scenes[0]||'',scenes};});
 const snapshot={...copy(bank),kind:'model',name:bank.name,business:bank.business||bank.industry||'通用',
  scenes:[...new Set(items.flatMap(item=>item.scenes))],version:bank.version||'1.0',status:'published',catalogId:bank.id,items};
 return {...snapshot,system:bank.source==='system',readOnly:true,versions:[copy(snapshot)]};
}
export function getModelBank(id){return modelRecord(id);}
export function listModelBanks(){
 const authored=Authoring.listAuthoredResources('model');
 const system=(Authoring.resourceCatalog()?.banks||[]).filter(bank=>!bank.authoringId).map(bank=>modelRecord(bank.id));
 return [...system,...authored];
}
export function getModelBankVersion(id,versionOrCatalogId){
 const record=modelRecord(id);if(!record)return null;
 const selector=versionOrCatalogId||id;
 const version=record.versions.find(item=>item.version===selector||item.catalogId===selector)
  ||(!versionOrCatalogId?record.versions.at(-1):null);
 return version?copy(version):null;
}
function metadata(data){
 const name=clean(data.name),business=clean(data.business),scenes=[...new Set((data.items||[]).flatMap(itemScenes))];
 if(!name)throw Error('请输入题库名称');
 if(!business)throw Error('请选择业务领域');
 return{name,business,scenes};
}
function normalizeItems(items){
 if(!Array.isArray(items))throw Error('题目列表必须是数组');
 items.forEach((item,index)=>{if(!itemScenes(item).length)throw Error(`第 ${index+1} 条题目缺少场景`);});
 return items.length?Authoring.parseModelImport(items).map((item,index)=>({...item,scene:itemScenes(items[index])[0],scenes:itemScenes(items[index])})):[];
}
export function saveModelBankDraft(data){
 const old=data.id?modelRecord(data.id):null;
 if(data.id&&!old)throw Error('题库不存在');
 if(old?.readOnly)throw Error('系统题库只读');
 if(old?.status==='published')throw Error('已发布题库不可修改，请创建新版本');
 const merged={...old,...copy(data)},base=old?.versions?.at(-1);
 if(base){
  const baseKeys=new Set(base.items.map(identity));
  const pending=normalizeItems(data.pendingItems??(data.items||old.items||[]).filter(item=>!baseKeys.has(identity(item))));
  if(pending.some(item=>baseKeys.has(identity(item))))throw Error('新增题目与已发布题目重复，请移除重复内容');
  if(new Set(pending.map(identity)).size!==pending.length)throw Error('新增题目包含重复内容，请移除重复题目');
  merged.pendingItems=pending;merged.incrementalBaseVersion=base.version;merged.items=[...copy(base.items),...pending];
 }else{
  merged.items=normalizeItems(merged.items||[]);
  if(new Set(merged.items.map(identity)).size!==merged.items.length)throw Error('题库包含重复内容，请移除重复题目');
 }
 return Authoring.saveAuthoredDraft({...merged,...metadata(merged),kind:'model',items:merged.items,modelBankEditor:true});
}
export function importModelBankJsonl(id,text,{fileName='questions.jsonl',deduplicate=true}={}){
 if(!/\.jsonl$/i.test(fileName))throw Error('模型题库仅支持 JSONL 文件');
 const parsed=parseModelBankJsonl(text,{deduplicate});
 if(!parsed.valid)throw Error(parsed.report.errors.map(error=>`第 ${error.line} 行：${error.message}`).join('；')||'存在重复题目，请先去重');
 const record=modelRecord(id);if(!record)throw Error('题库不存在');
 const base=record.versions.at(-1),baseKeys=new Set((base?.items||[]).map(identity));
 const additions=base?parsed.items.filter(item=>!baseKeys.has(identity(item))):parsed.items;
 return {bank:saveModelBankDraft({...record,...(base?{pendingItems:additions}:{items:additions})}),...parsed,existingDuplicates:parsed.items.length-additions.length};
}
export function publishModelBank(id,note=''){
 const record=modelRecord(id);if(!record)throw Error('题库不存在');
 if(record.readOnly)throw Error('系统题库只读');
 if(record.status==='published')return record;
 metadata(record);const items=normalizeItems(record.items);
 if(!items.length)throw Error('请至少保留一条有效题目');
 if(record.versions.length&&!record.pendingItems?.length)throw Error('请至少添加一道新题目后发布版本');
 return Authoring.publishAuthoredResource(record.id,note);
}
export function newModelBankVersion(id){
 const record=modelRecord(id);if(!record)throw Error('题库不存在');
 if(record.readOnly)throw Error('系统题库只读');
 if(record.status==='draft')return record;
 const draft=Authoring.newAuthoredVersion(record.id);
 return saveModelBankDraft({...draft,pendingItems:[],bankEditorStep:0});
}
export function copyModelBank(id){
 throw Error('题库不支持复制，请新建题库或更新自建题库版本');
}
export const getModelBankUsage=id=>Authoring.authoredModelBankUsage(id);
export function deleteModelBank(id){return Authoring.deleteAuthoredModelResource(id);}
export function exportModelBankJsonl(id,versionOrCatalogId){
 const record=modelRecord(id);if(!record)throw Error('题库不存在');
 const source=versionOrCatalogId?getModelBankVersion(id,versionOrCatalogId):record.versions.find(version=>version.catalogId===id)||record;
 if(!source)throw Error('题库版本不存在');
 return source.items.map(item=>{
  const raw=copy(item.sourceRecord||{});
  if('prompt'in raw)raw.prompt=item.prompt;
  if('input'in raw)raw.input=item.prompt;
  raw.jailbreak_prompt=item.prompt;raw.scene=item.scene;
  if(item.scenes?.length>1||'scenes'in raw)raw.scenes=copy(item.scenes||[item.scene]);
  if('jailbreak_method'in raw)raw.jailbreak_method=item.method;
  if('method'in raw)raw.method=item.method;
  if('expected'in raw)raw.expected=item.expected;
  if('expected_behavior'in raw)raw.expected_behavior=item.expected;
  if('group'in raw)raw.group=item.group;
  if(item.image)raw.image=item.image;
  return JSON.stringify(raw);
 }).join('\n');
}
