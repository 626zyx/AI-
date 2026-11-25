import { methods } from './store.js';
import { listModelResources } from './asset-intake.js';
import { parameterSchemaForMethod } from './method-parameter-schema.js';

export const METHOD_DEFAULTS_STORAGE_KEY = 'ai-range.method-defaults.v1';
const clone = value => structuredClone(value);
const clean = value => String(value ?? '').trim();
let sessionDefaults = {};
const definition = id => methods.find(method => method.id === id || method.name.toLowerCase() === String(id).toLowerCase());
function storage() { return globalThis.localStorage || globalThis.window?.localStorage; }
function read() {
  try {
    const target = storage();
    if (!target) return clone(sessionDefaults);
    const raw = target.getItem(METHOD_DEFAULTS_STORAGE_KEY);
    if (!raw) return {};
    const saved = JSON.parse(raw);
    if (saved.schema !== 1 || !saved.methods || typeof saved.methods !== 'object' || Array.isArray(saved.methods)) throw Error();
    return saved.methods;
  } catch { throw Error('方法默认参数读取失败，请检查浏览器存储'); }
}
function write(next) {
  try { const target=storage(); if(!target&&typeof window!=='undefined')throw Error(); target?.setItem(METHOD_DEFAULTS_STORAGE_KEY, JSON.stringify({schema:1,methods:next})); }
  catch { throw Error('默认参数保存失败，请检查浏览器存储空间后重试'); }
  sessionDefaults = clone(next);
}
export function canEditMethodDefaults(id) {
  const method = definition(id);
  return Boolean(method && !method.authoringId && (method.params.length || method.generator || method.process));
}
export function methodParameterSchema(id) {
  return parameterSchemaForMethod(definition(id));
}
export function systemMethodDefaults(id) {
  const method = definition(id);
  if (!method) throw Error('攻击方法不存在');
  return {params:Object.fromEntries(method.params.map(param => [param.label, clone(param.value)])),generator:'',process:''};
}
function modelAvailable(id) {
  if (!id) return true;
  return listModelResources().some(model => (model.id === id || `${model.id}@${model.version}` === id) && model.status === 'ready' && model.sourceStatus !== '已停用' && !model.busy);
}
export function getMethodDefaults(id, {forNew = false} = {}) {
  const method = definition(id);
  const base = systemMethodDefaults(id);
  const saved = read()[method.id];
  const value = saved ? validate(id,{params:{...base.params,...clone(saved.params)},generator:method.generator?clean(saved.generator):'',process:method.process?clean(saved.process):''},{checkModels:false}) : base;
  if (forNew) for (const role of ['generator','process']) if (!modelAvailable(value[role])) value[role] = '';
  return value;
}
export function methodDefaultsUpdatedAt(id) {
  const method = definition(id);
  if (!method) throw Error('攻击方法不存在');
  const updatedAt = read()[method.id]?.updatedAt;
  return updatedAt && Number.isFinite(Date.parse(updatedAt)) ? updatedAt : '';
}
function validate(id, value, {checkModels=true} = {}) {
  const method = definition(id);
  if (!canEditMethodDefaults(id)) throw Error('该方法没有可修改的默认参数');
  const schema = methodParameterSchema(id), params = value?.params;
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw Error('请填写方法参数');
  if (Object.keys(params).some(label => !schema.some(param => param.label === label))) throw Error('包含不属于该方法的参数');
  const checked = {};
  for (const param of schema) {
    const current = params[param.label];
    if (typeof current !== param.type) throw Error(param.label+'的类型不正确');
    if (param.type === 'number') {
      if (!Number.isFinite(current) || (param.integer && !Number.isSafeInteger(current)) || current < param.min || (param.max !== undefined && current > param.max)) {
        throw Error(param.label+'需为'+(param.integer?'整数，':'数字，')+'范围 '+param.min+(param.max === undefined?' 及以上':'–'+param.max));
      }
    }
    if (param.type === 'string' && !clean(current)) throw Error('请填写'+param.label);
    if (param.options && !param.options.includes(current)) throw Error(param.label+'不在支持的选项中');
    checked[param.label] = param.type === 'string' ? clean(current) : current;
  }
  if (method.id === 'TreeAttack' && checked['保留分支数量'] > checked['分支数量']) throw Error('保留分支数量不能超过分支数量');
  const result = {params:checked,generator:'',process:''};
  for (const role of ['generator','process']) {
    const selected = clean(value[role]);
    if (selected && !method[role]) throw Error('该方法不使用'+(role==='generator'?'攻击生成模型':'过程裁判'));
    if (selected && checkModels && !modelAvailable(selected)) throw Error('请选择已连通的'+(role==='generator'?'攻击生成模型':'过程裁判'));
    result[role] = selected;
  }
  return result;
}
export function saveMethodDefaults(id, value) {
  const method = definition(id), checked = validate(id,value), all = read();
  all[method.id] = {...checked,updatedAt:new Date().toISOString()}; write(all); return clone(checked);
}
export function saveMethodParameters(id, params) {
  const method=definition(id);
  if(!method||!method.params.length)throw Error('该方法没有可修改的参数');
  const previous=getMethodDefaults(id),checked=validate(id,{...previous,params},{checkModels:false}),all=read();
  all[method.id]={...checked,updatedAt:new Date().toISOString()};write(all);return clone(checked);
}
export function resetMethodParameters(id) {
  return saveMethodParameters(id,systemMethodDefaults(id).params);
}
export function resetMethodDefaults(id) {
  // A reset is an explicit update, so persist the factory values and its time.
  return saveMethodDefaults(id, systemMethodDefaults(id));
}
export function createMethodInstance(id) {
  const method = definition(id);
  if (!method) throw Error('攻击方法不存在');
  // Copy defaults only when adding a method. Saved strategies retain their own values.
  return {name:method.name,...getMethodDefaults(id,{forNew:true}),open:true};
}
