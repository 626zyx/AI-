import { parseCsv } from './resource-authoring.js';

const clean = value => String(value ?? '').trim();
const normalized = value => clean(value).normalize('NFKC').toLocaleLowerCase();
const tagNames = (value,catalog) => {
  if(Array.isArray(value))return [...new Set(value.map(clean).filter(Boolean))];
  const text=clean(value);
  // A label itself may contain punctuation, e.g. “隐私、数据与秘密泄露”.
  if(catalog.has(normalized(text)))return [text];
  return [...new Set(text.split(/[;；]/.test(text)?/[;；]/:/[、,，]/).map(clean).filter(Boolean))];
};
export const QUESTION_IMPORT_FORMAT = 'ID：\n题目内容：请在这里填写题目内容，可换行。\n业务类型：\n风险场景：';
const fields = {id:'id','编号':'id','题目编号':'id','题目内容':'prompt','题目':'prompt',prompt:'prompt',jailbreak_prompt:'prompt','业务类型':'business',business:'business','风险场景':'risk',risk:'risk',scene:'risk',scenes:'risk'};
const fieldLine = line => {
  const match = line.match(/^\s*([^：:]+)[：:]\s*(.*)$/);
  const key = match && fields[normalized(match[1])];
  return key ? {key,value:match[2]} : null;
};
function textRecords(text) {
  const lines = text.split('\n');
  if (!lines.some(fieldLine)) return lines.flatMap((line,index)=>line.trim()?[{raw:{prompt:line},line:index+1}]:[]);
  const records=[],errors=[];let raw={},firstLine=1,active=null;
  const finish=()=>{if(Object.keys(raw).length)records.push({raw,line:firstLine});raw={};active=null;};
  lines.forEach((line,index)=>{
    if(/^\s*---+\s*$/.test(line)){finish();firstLine=index+2;return;}
    const field=fieldLine(line);
    if(field){
      if(Object.hasOwn(raw,field.key)){errors.push({line:index+1,message:'字段重复，请用单独一行 --- 分隔题目'});return;}
      if(!Object.keys(raw).length)firstLine=index+1;
      raw[field.key]=field.value;active=field.key;
    }else if(active==='prompt')raw.prompt+='\n'+line;
    else if(line.trim())errors.push({line:index+1,message:'这一行不属于题目内容，请使用导入格式或放到“题目内容”下方'});
  });
  finish();return {records,errors};
}
function recordsFor(source,format) {
  if(format==='csv'){
    const rows=parseCsv(source);return {records:rows.map((raw,index)=>({raw,line:index+2})),errors:[]};
  }
  if(format==='jsonl'||(format==='auto'&&source.trim().startsWith('{'))){
    const records=[],errors=[];
    source.split('\n').forEach((line,index)=>{if(!line.trim())return;try{const raw=JSON.parse(line);if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error();records.push({raw,line:index+1});}catch{errors.push({line:index+1,message:'不是有效的 JSON 对象'});}});
    return {records,errors};
  }
  const result=textRecords(source);return Array.isArray(result)?{records:result,errors:[]}:result;
}
function canonical(raw) {
  const row={};for(const[key,value]of Object.entries(raw)){const target=fields[normalized(key)];if(target&&!Object.hasOwn(row,target))row[target]=value;}
  return row;
}
/** Parsing never creates labels or writes resources. Missing IDs are assigned only after validation. */
export function parseQuestionImport(text,{format='auto',existingIds=[],knownTags={business:[],risk:[]}}={}) {
  const source=String(text??'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  const items=[],duplicates=[],seenIds=new Map(),seenContent=new Map(),existing=new Set(existingIds.map(clean));
  let records=[],errors=[];
  try{({records,errors}=recordsFor(source,format));}catch(error){errors.push({line:1,message:error.message});}
  const catalogs=Object.fromEntries(['business','risk'].map(d=>[d,new Map((knownTags[d]||[]).map(tag=>[normalized(tag.name),tag]))]));
  for(const{raw,line}of records){
    const row=canonical(raw),id=clean(row.id),prompt=typeof row.prompt==='string'?row.prompt.trim():'';
    if(!prompt){errors.push({line,message:'请填写题目内容'});continue;}
    if(id.length>200){errors.push({line,message:'题目 ID 不能超过 200 个字符'});continue;}
    if(id&&existing.has(id)){errors.push({line,message:`题目 ID“${id}”已存在，请更换或留空自动生成`});continue;}
    const names={business:tagNames(row.business,catalogs.business),risk:tagNames(row.risk,catalogs.risk)},tagIds={business:[],risk:[]};let missing=false;
    for(const dimension of ['business','risk'])for(const name of names[dimension]){
      const tag=catalogs[dimension].get(normalized(name));
      if(tag)tagIds[dimension].push(tag.id);
      else{missing=true;errors.push({line,message:`${dimension==='business'?'业务类型':'风险场景'}标签“${name}”不存在，请在标签管理中新增，或将该字段留空`});}
    }
    if(missing)continue;
    const key=prompt.normalize('NFC'),metadata=JSON.stringify(tagIds);
    if(id&&seenIds.has(id)&&seenIds.get(id).key!==key){errors.push({line,message:`题目 ID“${id}”与第 ${seenIds.get(id).line} 行重复，但内容不同`});continue;}
    if(seenContent.has(key)){
      const previous=seenContent.get(key);
      if(previous.metadata!==metadata){errors.push({line,message:`题目内容与第 ${previous.line} 行重复，但标签不同，请合并后再解析`});continue;}
      if(id&&previous.item.id&&id!==previous.item.id){errors.push({line,message:`题目内容与第 ${previous.line} 行重复，但 ID 不同（${previous.item.id} / ${id}），请统一编号或将重复行 ID 留空`});continue;}
      if(id&&!previous.item.id)previous.item.id=id;
      duplicates.push({line,firstLine:previous.line});if(id)seenIds.set(id,{key,line});continue;
    }
    const item={id,prompt,tagIds,tagNames:Object.fromEntries(['business','risk'].map(d=>[d,tagIds[d].map(tagId=>knownTags[d].find(tag=>tag.id===tagId).name)])),line};
    items.push(item);seenContent.set(key,{line,metadata,item});if(id)seenIds.set(id,{key,line});
  }
  if(!records.length&&!errors.length)errors.push({line:1,message:'请先输入或上传题目内容'});
  return {items,errors,duplicates,total:records.length,valid:errors.length===0&&items.length>0};
}
