/* 策略复制只继承配置，不继承发布状态、引用数量或记录身份。 */
export function copyStrategyRecord(source, catalog) {
  const copy = structuredClone(source);
  for (const key of ['id', 'createdAt', 'updatedAt', 'publishedAt', 'familyId', 'parentId', 'version']) delete copy[key];
  const used = new Set(catalog.map(strategy => strategy.name.trim().toLowerCase()));
  const base = `${source.name} · 副本`;
  let name = base, suffix = 2;
  while (used.has(name.toLowerCase())) name = `${base} ${suffix++}`;
  return { ...copy, name, source: 'custom', status: 'draft', taskCount: 0 };
}

export const releaseNumber = value => Number(String(value || '1.0').split('.')[1] || 0) + 1;
export const releaseLabel = value => `V${releaseNumber(value)}`;
export function latestStrategyRows(rows) {
  return rows.filter(row => !rows.some(other => (other.familyId || other.id) === (row.familyId || row.id) && releaseNumber(other.version) > releaseNumber(row.version)));
}
export function createStrategyVersion(source, rows) {
  if (!source || source.status !== 'published') throw new Error('仅已发布策略可创建新版本');
  const familyId = source.familyId || source.id;
  const draft = rows.find(row => (row.familyId || row.id) === familyId && row.status === 'draft');
  if (draft) return draft;
  const highest = Math.max(...rows.filter(row => (row.familyId || row.id) === familyId).map(row => releaseNumber(row.version)));
  return { ...structuredClone(source), id: undefined, familyId, parentId: source.id, source: 'custom', version: `1.${highest}`, status: 'draft', taskCount: 0 };
}
