/* Groups organize published resources; they never change resource content or lifecycle. */
export const RESOURCE_GROUP_STORAGE_KEY = 'ai-range-resource-groups-v1';
const copy = value => structuredClone(value);
const text = value => String(value ?? '').trim();
const kinds = new Set(['question', 'environment']);
let memory = [], serial = 0;
function storage() { return globalThis.localStorage || globalThis.window?.localStorage || null; }
function read() {
  const target = storage();
  if (!target) return copy(memory);
  const raw = target.getItem(RESOURCE_GROUP_STORAGE_KEY);
  if (raw === null) return [];
  let rows;
  try { rows = JSON.parse(raw); } catch { throw Error('分组数据无法读取，请保留浏览器数据并联系管理员'); }
  if (!Array.isArray(rows) || rows.some(row => !row || !kinds.has(row.kind) || typeof row.id !== 'string' || !Array.isArray(row.memberIds))) throw Error('分组数据格式不正确');
  return rows;
}
function write(rows) {
  try { storage()?.setItem(RESOURCE_GROUP_STORAGE_KEY, JSON.stringify(rows)); }
  catch { throw Error('分组未保存，请检查浏览器存储空间后重试'); }
  memory = copy(rows);
}
export function listResourceGroups(kind) {
  if (!kinds.has(kind)) throw Error('不支持的分组类型');
  return copy(read().filter(row => row.kind === kind));
}
export function getResourceGroup(id) { return copy(read().find(row => row.id === id) || null); }
export function saveResourceGroup(input, resources) {
  if (!kinds.has(input.kind)) throw Error('不支持的分组类型');
  const rows = read(), previous = input.id ? rows.find(row => row.id === input.id) : null;
  if (input.id && !previous) throw Error('分组不存在或为只读系统分组');
  if (previous && previous.kind !== input.kind) throw Error('分组类型不能修改');
  const name = text(input.name), description = text(input.description);
  if (!name || name.length > 100) throw Error('请填写 1—100 个字符的分组名称');
  if (description.length > 500) throw Error('分组说明不能超过 500 个字符');
  if (!Array.isArray(input.memberIds)) throw Error('请选择分组成员');
  const memberIds = [...new Set(input.memberIds.map(text).filter(Boolean))];
  if (!memberIds.length) throw Error('请至少选择一个已发布成员');
  const available = new Map(resources.map(row => [row.id, row]));
  if (memberIds.some(id => available.get(id)?.status !== 'published')) throw Error('部分成员未发布或已删除，请重新选择已发布成员');
  const at = new Date().toISOString();
  const saved = { id: previous?.id || 'group-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + ++serial),
    kind: input.kind, name, description, memberIds, source: 'custom', createdAt: previous?.createdAt || at, updatedAt: at };
  if (previous) rows[rows.indexOf(previous)] = saved; else rows.push(saved);
  write(rows); return copy(saved);
}
export function deleteResourceGroup(id) {
  const rows = read(), index = rows.findIndex(row => row.id === id);
  if (index < 0) throw Error('分组不存在或为只读系统分组');
  const [removed] = rows.splice(index, 1); write(rows); return copy(removed);
}
