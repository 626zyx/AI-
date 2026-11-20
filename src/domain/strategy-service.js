/* 策略复制只继承配置，不继承发布状态、引用数量或记录身份。 */
export function copyStrategyRecord(source, catalog) {
  const copy = structuredClone(source);
  for (const key of ['id', 'createdAt', 'updatedAt', 'publishedAt']) delete copy[key];
  const used = new Set(catalog.map(strategy => strategy.name.trim().toLowerCase()));
  const base = `${source.name} · 副本`;
  let name = base, suffix = 2;
  while (used.has(name.toLowerCase())) name = `${base} ${suffix++}`;
  return { ...copy, name, status: 'draft', taskCount: 0 };
}
