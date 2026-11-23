import * as UI from "../core/ui.js";
import * as store from "../domain/store.js";
import {
  releaseLabel,
  releaseNumber,
  strategyDifferences,
  strategyUpdates,
} from "../domain/strategy-service.js";
const view = { kind: "model", before: "", after: "" };
const rowsFor = (kind) =>
  kind === "agent" ? store.agentStrategies : store.strategies;
export const strategyCatalog = (kind) => ({
  banks: kind === "agent" ? store.sceneBanks : store.banks,
  guards: store.guards,
  models: store.models,
});
export function updateBadge(strategy, kind = "model") {
  const updates = strategyUpdates(strategy, strategyCatalog(kind));
  return updates.length ? UI.badge(`${updates.length} 项可更新`, "amber") : "";
}
export function openStrategyVersions(id, kind = "model") {
  const source = rowsFor(kind).find((row) => row.id === id);
  if (!source) return;
  const rows = rowsFor(kind)
    .filter(
      (row) => (row.familyId || row.id) === (source.familyId || source.id),
    )
    .sort((a, b) => releaseNumber(b.version) - releaseNumber(a.version));
  UI.closeModal();
  UI.drawer(
    `${source.name} · 版本`,
    UI.table(
      [
        { title: "版本", render: (row) => releaseLabel(row.version) },
        {
          title: "状态",
          render: (row) =>
            UI.badge(
              store.STRATEGY_STATUS[row.status],
              row.status === "published" ? "blue" : "gray",
            ),
        },
        { title: "更新时间", render: (row) => UI.esc(row.updatedAt || "—") },
        {
          title: "操作",
          render: (row) =>
            `<div class="row-actions">${UI.linkBtn(row.status === "draft" ? "编辑" : "查看", { onclick: `App.${kind === "agent" ? (row.status === "draft" ? "editAgStrategy" : "openAgStrategy") : row.status === "draft" ? "editStrategy" : "openStrategy"}('${row.id}')` })}${rows.length > 1 ? UI.linkBtn("对比", { onclick: `App.svCompare('${kind}','${row.id}')` }) : ""}</div>`,
        },
      ],
      rows,
    ),
    UI.btn("关闭", { onclick: "UI.closeDrawer()" }),
  );
}
function renderComparison() {
  const rows = rowsFor(view.kind),
    before = rows.find((row) => row.id === view.before),
    after = rows.find((row) => row.id === view.after);
  if (!before || !after) return;
  const family = rows.filter(
    (row) => (row.familyId || row.id) === (after.familyId || after.id),
  );
  const selector = (key, label) =>
    `<div class="field"><label>${label}</label><select onchange="App.svDiffChange('${key}',this.value)">${family.map((row) => `<option value="${row.id}" ${view[key] === row.id ? "selected" : ""}>${releaseLabel(row.version)} · ${UI.esc(store.STRATEGY_STATUS[row.status])}</option>`).join("")}</select></div>`;
  const changes = strategyDifferences(
    before,
    after,
    strategyCatalog(view.kind),
  );
  UI.closeDrawer();
  UI.modal(
    `${after.name} · 版本对比`,
    `<div class="form-row">${selector("before", "比较版本")}${selector("after", "目标版本")}</div>${UI.table(
      [
        { title: "变更项", width: "130px", render: (row) => UI.esc(row.label) },
        {
          title: releaseLabel(before.version),
          render: (row) => UI.esc(row.before),
        },
        {
          title: releaseLabel(after.version),
          render: (row) => UI.esc(row.after),
        },
      ],
      changes,
      "配置内容相同",
    )}`,
    UI.btn("关闭", { onclick: "UI.closeModal()" }),
    { wide: true },
  );
}
export const versionActions = {
  svCompare(kind, id) {
    const rows = rowsFor(kind),
      after = rows.find((row) => row.id === id);
    if (!after) return;
    const family = rows
      .filter(
        (row) =>
          (row.familyId || row.id) === (after.familyId || after.id) &&
          row.id !== id,
      )
      .sort((a, b) => releaseNumber(b.version) - releaseNumber(a.version));
    const before =
      family.find(
        (row) => releaseNumber(row.version) < releaseNumber(after.version),
      ) || family[0];
    if (!before) return UI.toast("暂无其他版本");
    Object.assign(view, { kind, before: before.id, after: id });
    renderComparison();
  },
  svDiffChange(key, id) {
    view[key] = id;
    renderComparison();
  },
};
