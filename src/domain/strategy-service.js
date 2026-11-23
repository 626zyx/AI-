/* 策略复制只继承配置，不继承发布状态、引用数量或记录身份。 */
export function copyStrategyRecord(source, catalog) {
  const copy = withoutTaskJudge(source);
  for (const key of [
    "id",
    "createdAt",
    "updatedAt",
    "publishedAt",
    "familyId",
    "parentId",
    "version",
  ])
    delete copy[key];
  const used = new Set(
    catalog.map((strategy) => strategy.name.trim().toLowerCase()),
  );
  const base = `${source.name} · 副本`;
  let name = base,
    suffix = 2;
  while (used.has(name.toLowerCase())) name = `${base} ${suffix++}`;
  return { ...copy, name, source: "custom", status: "draft", taskCount: 0 };
}

export function releaseNumber(value) {
  const text = String(value || "1.0").trim();
  const displayVersion = /^v?(\d+)$/i.exec(text);
  if (displayVersion) return Math.max(1, Number(displayVersion[1]));
  const minor = Number(text.split(".")[1]);
  return Number.isFinite(minor) ? Math.max(1, minor + 1) : 1;
}
export const releaseLabel = (value) => `V${releaseNumber(value)}`;
export function latestStrategyRows(rows) {
  return rows.filter(
    (row) =>
      !rows.some(
        (other) =>
          (other.familyId || other.id) === (row.familyId || row.id) &&
          releaseNumber(other.version) > releaseNumber(row.version),
      ),
  );
}
export function createStrategyVersion(source, rows) {
  if (!source || !["published", "disabled"].includes(source.status))
    throw new Error("仅已发布策略可创建新版本");
  const familyId = source.familyId || source.id;
  const draft = rows.find(
    (row) => (row.familyId || row.id) === familyId && row.status === "draft",
  );
  if (draft) return draft;
  const highest = Math.max(
    ...rows
      .filter((row) => (row.familyId || row.id) === familyId)
      .map((row) => releaseNumber(row.version)),
  );
  return {
    ...withoutTaskJudge(source),
    id: undefined,
    familyId,
    parentId: source.id,
    source: "custom",
    version: `1.${highest}`,
    status: "draft",
    taskCount: 0,
  };
}

/* Judge selection belongs to each task, including judge-dependent attack methods. */
export function withoutTaskJudge(strategy) {
  const result = structuredClone(strategy);
  delete result.judgeId;
  if (result.methods) result.methods = result.methods.map(method => {
    const next = { ...method };
    if (next.aux) { next.aux = { ...next.aux }; delete next.aux.process; }
    if (next.params) next.params = next.params.filter(([label]) => !['裁判模型', '过程裁判', '最终裁判'].includes(label));
    return next;
  });
  return result;
}

export function freezeStrategyDependencies(
  strategy,
  { banks = [], guards = [], models = [] } = {},
) {
  const snapshot = withoutTaskJudge(strategy);
  snapshot.banks = (strategy.banks || []).map((ref) => {
    const bank = banks.find((item) => item.id === ref.bankId);
    return {
      ...ref,
      version: bank?.version || ref.version || "1.0",
      name: bank?.name || ref.name || "",
      judgeRule: structuredClone(bank?.judgeRule || ref.judgeRule || null),
    };
  });
  const guard = guards.find((item) => item.id === strategy.guardId);
  snapshot.guardVersion = guard?.version || strategy.guardVersion || null;
  snapshot.guardSnapshot = guard ? structuredClone(guard) : null;
  snapshot.guardStages = guard
    ? (strategy.guardStages || guard.stages).filter((stage) =>
        guard.stages.includes(stage),
      )
    : [];
  const ids = new Set(
    [
      strategy.attackerModelId,
      guard?.builtin ? null : guard?.modelId,
      ...(snapshot.methods || []).flatMap((method) =>
        Object.values(method.aux || {}),
      ),
    ].filter(Boolean),
  );
  snapshot.modelSnapshots = models
    .filter((model) => ids.has(model.id))
    .map(({ apiKey, ...model }) => structuredClone(model));
  return snapshot;
}

export function strategyUpdates(
  strategy,
  { banks = [], guards = [], models = [] } = {},
) {
  const updates = [];
  for (const reference of strategy.banks || []) {
    const current = banks.find((bank) => bank.id === reference.bankId);
    if (!current?.authoringId) continue;
    const latest = banks
      .filter(
        (bank) =>
          bank.authoringId === current.authoringId &&
          bank.status === "published",
      )
      .sort((a, b) => releaseNumber(b.version) - releaseNumber(a.version))[0];
    if (
      latest &&
      releaseNumber(latest.version) > releaseNumber(current.version)
    )
      updates.push({
        kind: "bank",
        from: current.id,
        to: latest.id,
        name: latest.name,
        version: latest.version,
      });
  }
  const guard = guards.find((item) => item.id === strategy.guardId);
  if (guard) {
    const latest = guards
      .filter(
        (item) =>
          (item.familyId || item.id) === (guard.familyId || guard.id) &&
          item.status === "published",
      )
      .sort((a, b) => releaseNumber(b.version) - releaseNumber(a.version))[0];
    if (latest && releaseNumber(latest.version) > releaseNumber(guard.version))
      updates.push({
        kind: "guard",
        from: guard.id,
        to: latest.id,
        name: latest.name,
        version: latest.version,
      });
  }
  for (const snapshot of strategy.modelSnapshots || []) {
    const current = models.find((model) => model.id === snapshot.id);
    if (current && current.revision !== snapshot.revision)
      updates.push({
        kind: "model",
        from: snapshot.id,
        to: current.id,
        name: current.name,
      });
  }
  return updates;
}

export function upgradedStrategy(strategy, catalog) {
  const next = structuredClone(strategy);
  for (const update of strategyUpdates(strategy, catalog)) {
    if (update.kind === "bank")
      next.banks = next.banks.map((ref) =>
        ref.bankId === update.from
          ? { ...ref, bankId: update.to, version: update.version }
          : ref,
      );
    if (update.kind === "guard") {
      next.guardId = update.to;
      next.guardVersion = update.version;
      const guard = catalog.guards.find((row) => row.id === update.to);
      next.guardStages = (next.guardStages || []).filter((stage) =>
        guard.stages.includes(stage),
      );
    }
  }
  return next;
}

export function strategyDifferences(
  before,
  after,
  { banks = [], guards = [], models = [] } = {},
) {
  const modelName = (id) =>
    models.find((row) => row.id === id)?.name || id || "未配置";
  const bankText = (strategy) =>
    (strategy.banks || [])
      .map((ref) => {
        const bank = banks.find((row) => row.id === ref.bankId);
        return `${bank?.name || ref.name || ref.bankId} · ${bank?.source==='system'?'':`${releaseLabel(ref.version || bank?.version)} · `}${ref.count ? `前 ${ref.count} 题` : "全部题目"}`;
      })
      .join("；");
  const guardText = (strategy) =>
    strategy.guardId
      ? `${guards.find((row) => row.id === strategy.guardId)?.name || strategy.guardSnapshot?.name || strategy.guardId} · ${(guards.find((row) => row.id === strategy.guardId)||strategy.guardSnapshot)?.builtin?'':`${releaseLabel(strategy.guardVersion)} · `}${(strategy.guardStages || []).join(" / ")}`
      : "未启用";
  const methodText = (strategy) =>
    strategy.methods
      ? strategy.methods
          .map(
            (method) =>
              `${method.name}${method.params?.length ? `（${method.params.map(([k, v]) => `${k}：${v}`).join("；")}）` : ""}`,
          )
          .join("；")
      : strategy.methodId || "未选择";
  return [
    ["策略名称", (s) => s.name],
    ["业务说明", (s) => s.desc || "—"],
    ["演练方法", methodText],
    ["题库版本与范围", bankText],
    ["攻击生成模型", (s) => modelName(s.attackerModelId)],
    ["防护配置", guardText],
  ]
    .map(([label, read]) => ({
      label,
      before: read(before),
      after: read(after),
    }))
    .filter((row) => row.before !== row.after);
}
