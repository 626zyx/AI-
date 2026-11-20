/* 任务 provider：默认在当前页面内存中保存配置快照和回放游标，不复制大段证据。
 * 可注入存储适配器；后端接入时替换 list/get/put，页面与投影无需了解存储细节。 */
export const TASK_STORAGE_KEY = 'openart.tasks.v1';
const clone = (value) => JSON.parse(JSON.stringify(value));
const statuses = new Set(['draft', 'ready', 'starting', 'running', 'done', 'stopped', 'error']);
function validRecord(t) {
  const boundSource = typeof t?.sourceTaskId === 'string' && t.sourceTaskId.length > 0;
  const awaitingSource = t?.configurationMode === 'selected' && ['model', 'agent'].includes(t.objectType)
    && ['draft', 'ready'].includes(t.status) && t.sourceTaskId === null && t.configSnapshot?.objectType === t.objectType;
  return t && typeof t.id === 'string' && t.id.length > 0 && (boundSource || awaitingSource)
    && ['model', 'agent'].includes(t.objectType) && typeof t.name === 'string' && statuses.has(t.status)
    && Number.isInteger(t.total) && t.total >= 0 && Number.isInteger(t.replayCursor) && t.replayCursor >= 0
    && (t.objectType === 'agent' || (Array.isArray(t.methods) && t.methods.every((m) => m && typeof m.name === 'string')));
}

export function createTaskRepository(storage = null, key = TASK_STORAGE_KEY) {
  let records = [], deletedTasks = [], loadError = null;
  try {
    const text = storage?.getItem(key);
    if (text) {
      const data = JSON.parse(text);
      if (data.version !== 1 || !Array.isArray(data.tasks)) throw new Error('任务存储格式不受支持');
      if (!data.tasks.every(validRecord) || new Set(data.tasks.map(t => t.id)).size !== data.tasks.length) throw new Error('任务记录损坏或执行游标无效');
      if (data.deletedTasks !== undefined && (!Array.isArray(data.deletedTasks) || !data.deletedTasks.every(t => t && typeof t.id === 'string' && ['model','agent'].includes(t.objectType) && typeof t.deletedAt === 'string'))) throw new Error('任务删除记录损坏');
      // Older archives may have been saved between environment preparation events.
      records = data.tasks.map(t => t.status === 'starting' ? { ...t, status: 'running' } : t);
      deletedTasks = data.deletedTasks || [];
    }
  } catch (error) { loadError = new Error(`本地任务读取失败：${error.message}`); }
  const persist = (next, nextDeleted = deletedTasks) => {
    if (loadError) throw loadError; // Never overwrite a corrupt archive with an empty list.
    if (storage) {
      try { storage.setItem(key, JSON.stringify({ version: 1, tasks: next, deletedTasks: nextDeleted })); }
      catch { throw new Error('任务保存失败，本地存储不可用或空间不足'); }
    }
    records = next;
    deletedTasks = nextDeleted;
  };
  const isDeleted = id => deletedTasks.some(t => t.id === id);
  return {
    list: (type) => clone(records.filter(t => (!type || t.objectType === type) && !isDeleted(t.id))),
    get: (id, { includeDeleted = false } = {}) => clone((includeDeleted || !isDeleted(id)) ? records.find(t => t.id === id) || null : null),
    put(record) { const next = records.filter((t) => t.id !== record.id); next.push(clone(record)); persist(next); return record.id; },
    isDeleted,
    deleted: () => clone(deletedTasks),
    softDelete(id, { objectType, deletedAt, record } = {}) {
      const next = record ? records.filter(t => t.id !== id).concat(clone(record)) : records;
      persist(next, deletedTasks.filter(t => t.id !== id).concat({ id, objectType, deletedAt }));
      return id;
    },
    restore(id) { persist(records, deletedTasks.filter(t => t.id !== id)); return id; },
    error: () => loadError,
  };
}

let repository;
export function taskRepository() {
  if (!repository) {
    // The demo resets on reload. Remove only its legacy archive, never other site data.
    // Storage restrictions must not prevent current-page task operations.
    try { globalThis.localStorage?.removeItem(TASK_STORAGE_KEY); } catch { /* Memory mode needs no browser storage. */ }
    repository = createTaskRepository();
  }
  return repository;
}
