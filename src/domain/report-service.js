/* Reports may leave the management list without deleting their task evidence. */
export function createReportService({ getTask }) {
  const deleted = new Set();
  const listeners = new Set();
  const key = (id, type) => `${type}:${id}`;
  const isReportDeleted = (id, type = 'model') => deleted.has(key(id, type));
  const notify = (taskId, objectType, action) => listeners.forEach(listener => listener({ taskId, objectType, action }));
  return {
    isReportDeleted,
    subscribeReports(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    deleteReport(id, type = 'model') {
      if (!['model', 'agent'].includes(type)) throw new Error('报告类型无效');
      const task = getTask(id, type);
      if (!task || task.status !== 'done') throw new Error('报告不存在');
      if (isReportDeleted(id, type)) return id;
      deleted.add(key(id, type));
      notify(id, type, 'deleted');
      return id;
    },
    restoreReport(id, type = 'model') {
      if (deleted.delete(key(id, type))) notify(id, type, 'restored');
      return id;
    },
  };
}
