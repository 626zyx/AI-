/* Shared classification filter: OR within a dimension, AND between dimensions. */
import * as UI from './ui.js';
import * as Tags from '../domain/resource-tags.js';

const contexts=new Map(),boundDocuments=new WeakSet(),e=UI.esc;
const call=(name,...args)=>e('App.'+name+'('+args.map(value=>JSON.stringify(value)).join(',')+')');
const values=value=>Array.isArray(value)?value:typeof value==='string'&&value?[value]:[];
const rootOf=key=>[...document.querySelectorAll('[data-tag-filter]')].find(node=>node.dataset.tagFilter===key);

export function normalizeTagSelection(selection={}){
  const result={};
  for(const dimension of Tags.listTagDimensions()){
    const allowed=new Set(Tags.listTags(dimension.id).map(tag=>tag.id));allowed.add('__untagged');
    const selected=[...new Set(values(selection[dimension.id]))].filter(id=>allowed.has(id));
    if(selected.length)result[dimension.id]=selected;
  }
  return result;
}
export function matchesTagSelection(tagIds={},selection={}){
  return Object.entries(selection).every(([dimension,choice])=>{
    const selected=values(choice),ids=values(tagIds[dimension]);
    return !selected.length||selected.some(id=>id==='__untagged'?!ids.length:ids.includes(id));
  });
}
function close(context,{focus=false}={}){
  if(!context.open)return;context.open=false;paint(context);
  if(focus)rootOf(context.key)?.querySelector('.tf-trigger')?.focus();
}
function installEvents(){
  if(typeof document==='undefined'||boundDocuments.has(document))return;
  boundDocuments.add(document);
  document.addEventListener('click',event=>{
    const path=event.composedPath();
    for(const context of contexts.values())if(context.open&&!path.some(node=>node?.dataset?.tagFilter===context.key))close(context);
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const context=[...contexts.values()].find(item=>item.open&&rootOf(item.key));
    if(context){event.preventDefault();event.stopPropagation();close(context,{focus:true});}
  },true);
  document.addEventListener('scroll',event=>{for(const context of contexts.values())if(context.open&&!rootOf(context.key)?.contains(event.target))close(context);},true);
  document.defaultView?.addEventListener('resize',()=>{for(const context of contexts.values())if(context.open)close(context);});
}
function markup(context){
  const dimensions=Tags.listTagDimensions(),selection=normalizeTagSelection(context.getSelection?.()||{});
  if(!dimensions.some(d=>d.id===context.dimension))context.dimension=dimensions[0]?.id||'';
  const dimension=dimensions.find(d=>d.id===context.dimension),tags=dimension?Tags.listTags(dimension.id):[];
  const chosen=selection[context.dimension]||[],count=Object.values(selection).reduce((sum,ids)=>sum+ids.length,0);
  const labels=dimensions.flatMap(d=>{
    const map=new Map(Tags.listTags(d.id).map(tag=>[tag.id,tag.name]));
    return(selection[d.id]||[]).map(id=>d.name+'：'+(id==='__untagged'?'未打标签':map.get(id)));
  });
  const summary=count?'已选 '+count+' 个标签':'全部标签',id='tf-panel-'+context.key;
  const left=dimensions.map(d=>'<button type="button" role="tab" aria-selected="'+(d.id===context.dimension)+'" class="tf-dimension '+(d.id===context.dimension?'active':'')+'" onclick="'+call('tfDimension',context.key,d.id)+'" onkeydown="'+e('App.tfDimensionKey(event,'+JSON.stringify(context.key)+','+JSON.stringify(d.id)+')')+'"><span>'+e(d.name)+'</span>'+((selection[d.id]||[]).length?'<span class="tf-dimension-count">'+selection[d.id].length+'</span>':'')+'</button>').join('');
  const options=[{id:'__untagged',name:'未打标签'},...tags].map(tag=>'<label class="tf-option"><input type="checkbox" data-tag-value="'+e(tag.id)+'" '+(chosen.includes(tag.id)?'checked ':'')+'onchange="'+e('App.tfSelect('+JSON.stringify(context.key)+','+JSON.stringify(context.dimension)+','+JSON.stringify(tag.id)+',this.checked)')+'"><span>'+e(tag.name)+'</span></label>').join('');
  return '<span class="tf-label">'+e(context.label)+'</span><button type="button" class="tf-trigger" aria-label="'+e(context.label+'筛选')+'" aria-haspopup="dialog" aria-expanded="'+context.open+'" aria-controls="'+e(id)+'" title="'+e(labels.join('；')||'全部标签')+'" onclick="'+call('tfToggle',context.key)+'"><span>'+summary+'</span></button>'+(context.open?'<div id="'+e(id)+'" class="tf-popover" role="dialog" aria-label="'+e(context.label+'筛选')+'"><div class="tf-columns"><div class="tf-dimensions" role="tablist" aria-label="标签维度">'+left+'</div><div class="tf-values" role="tabpanel" aria-label="'+e(dimension?.name||'标签内容')+'"><div class="tf-value-heading">'+e(dimension?.name||'标签内容')+'</div>'+options+'</div></div><div class="tf-help">同一维度满足任一标签，不同维度需同时满足</div><div class="tf-footer"><span>'+summary+'</span>'+UI.linkBtn('重置',{onclick:call('tfReset',context.key),disabled:!count})+UI.btn('完成',{onclick:call('tfDone',context.key)})+'</div></div>':'');
}
function position(context){
  const host=rootOf(context.key),panel=host?.querySelector('.tf-popover'),trigger=host?.querySelector('.tf-trigger');if(!panel||!trigger)return;
  const rect=trigger.getBoundingClientRect(),width=panel.offsetWidth||490,height=panel.offsetHeight||370,win=document.defaultView;
  panel.style.left=Math.max(12,Math.min(rect.left,(win?.innerWidth||1024)-width-12))+'px';
  panel.style.top=Math.max(12,Math.min(rect.bottom+8,(win?.innerHeight||768)-height-12))+'px';
}
function paint(context){const host=rootOf(context.key);if(host){host.innerHTML=markup(context);position(context);}}
export function renderTagFilter(key,{getSelection,onChange,label='标签'}={}){
  installEvents();const previous=contexts.get(key)||{open:false,dimension:''};
  const context={...previous,key,getSelection,onChange,label};contexts.set(key,context);
  if(context.open)queueMicrotask(()=>position(context));
  return '<div class="filter tf-filter" data-tag-filter="'+e(key)+'">'+markup(context)+'</div>';
}
export const actions={
  tfToggle(key){const context=contexts.get(key);if(!context)return;for(const other of contexts.values())if(other!==context)close(other);context.open=!context.open;paint(context);if(context.open)rootOf(key)?.querySelector('[role=tab][aria-selected=true]')?.focus();},
  tfDimension(key,dimension){const context=contexts.get(key);if(!context||!Tags.listTagDimensions().some(d=>d.id===dimension))return;context.dimension=dimension;paint(context);rootOf(key)?.querySelector('[role=tab][aria-selected=true]')?.focus();},
  tfSelect(key,dimension,id,checked){const context=contexts.get(key);if(!context)return;const selected=normalizeTagSelection(context.getSelection?.()||{}),ids=new Set(selected[dimension]||[]);checked?ids.add(id):ids.delete(id);selected[dimension]=[...ids];context.onChange?.(normalizeTagSelection(selected));paint(context);[...rootOf(key)?.querySelectorAll('[data-tag-value]')||[]].find(node=>node.dataset.tagValue===id)?.focus();},
  tfDimensionKey(event,key,dimension){const ids=Tags.listTagDimensions().map(row=>row.id),index=ids.indexOf(dimension);if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?ids.length-1:(index+(event.key==='ArrowDown'?1:-1)+ids.length)%ids.length;actions.tfDimension(key,ids[next]);}else if(event.key==='ArrowRight'){event.preventDefault();rootOf(key)?.querySelector('.tf-option input')?.focus();}},
  tfReset(key){const context=contexts.get(key);if(!context)return;context.onChange?.({});paint(context);rootOf(key)?.querySelector('[role=tab][aria-selected=true]')?.focus();},
  tfDone(key){const context=contexts.get(key);if(context)close(context,{focus:true});},
};
