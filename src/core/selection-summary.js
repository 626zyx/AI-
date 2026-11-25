import * as UI from './ui.js';

/* Header checkboxes affect the current page; this bar explains the persistent set. */
export function renderSelectionSummary({count=0,visibleCount=0,unit='道题目',onlySelected=false,onOnlySelected='',onClear='',onSelectFiltered='',filteredCount=0,notice='',disabled=false,stagedCount=null,onAdd='',onClearStaged='',clearLabel='清空选择'}={}){
  const e=UI.esc;
  const summary='<div class="selection-summary-count"><strong>已选 <b class="num">'+count+'</b> '+e(unit)+'</strong><span>当前筛选已选 '+visibleCount+' '+e(unit)+' · 跨页选择有效</span></div>';
  const toggle=onOnlySelected?'<label class="selection-summary-toggle"><input type="checkbox" '+(onlySelected?'checked ':'')+'onchange="'+e(onOnlySelected)+'">仅看已选</label>':'';
  const select=onSelectFiltered&&!onlySelected?UI.linkBtn('选择全部匹配（'+filteredCount+'）',{disabled:disabled||!filteredCount,onclick:e(onSelectFiltered)}):'';
  const clear=onClear?UI.linkBtn(clearLabel,{disabled:disabled||!count,onclick:e(onClear)}):'';
  const staged=stagedCount!==null?'<span class="selection-summary-staged">本次待加入 <b>'+stagedCount+'</b> '+e(unit)+'</span>':'';
  const add=onAdd?UI.btn('加入已选',{kind:'primary',disabled:disabled||!stagedCount,onclick:e(onAdd)}):'';
  const clearStaged=onClearStaged?UI.linkBtn('清空待加入',{disabled:disabled||!stagedCount,onclick:e(onClearStaged)}):'';
  return '<div class="selection-summary" aria-label="跨页选择汇总"><div class="selection-summary-main" aria-live="polite">'+summary+staged+(notice?'<span class="selection-summary-notice">'+e(notice)+'</span>':'')+'</div><div class="selection-summary-actions">'+toggle+select+add+clearStaged+clear+'</div></div>';
}
