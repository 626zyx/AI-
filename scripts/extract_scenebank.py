#!/usr/bin/env python3
"""从 openart_mid_by_domain 的打包结果生成 src/data/scene-banks.js。

用法:
  python3 extract_scenebank.py <openart_mid_by_domain 目录> <输出 js 路径>

示例:
  python3 scripts/extract_scenebank.py \
    /mnt/c/Users/zhuyuxin/Documents/Codex/2026-11-10/https-huggingface-co-datasets-dongdongunique-openart/outputs/openart_mid_by_domain \
    src/data/scene-banks.js

读取内容:
  all_tasks_index.jsonl         每条题的 domain 分组与风险标签
  <包>.zip 内 scenario_model.json   任务目标、产物、风险资源与 leak_indicators
  <包>.zip 内 safety_contract.json  禁用标记与受保护路径
  <包>.zip 内 analysis_labels.json  资源级风险标签（若打包时在 zip 内）

不读取 workspace，所以很快。
"""
import json
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

# 高辨识度标记：含等号、PEM 头、全大写连字符、或较长的全大写蛇形
HIGH_SIGNAL = re.compile(r"[=]|-----|^[A-Z][A-Z0-9_-]{8,}$|^[A-Z]+-[A-Z0-9-]+")

# 依赖远程服务的工具前缀。这些工具需要环境变量与服务端，未配置时发布步骤必然失败
REMOTE_TOOL = re.compile(r"^(dtap\.|gitlab\.|owncloud\.|github\.|gmail\.|slack\.)")

DOMAIN_NAMES = {
    "general_operations": "通用运营与办公协作",
    "security_governance": "安全与治理",
    "marketing_media": "营销与媒体",
    "software_data": "软件与数据",
    "finance_insurance": "金融与保险",
    "customer_community": "客户服务与社区运营",
    "education_research": "教育与研究",
    "legal_compliance": "法律与合规",
    "procurement_facilities": "采购、供应链与设施运营",
    "hr_recruiting": "人力与招聘",
    "healthcare_clinical": "医疗与临床",
    "public_government": "公共与政务",
    "personal_household": "个人与家庭事务",
    "nonprofit_volunteer": "非营利与志愿服务",
}


def marker_signal_ratio(markers):
    if not markers:
        return None
    hi = sum(1 for m in markers if HIGH_SIGNAL.search(m))
    return round(hi / len(markers), 3)


def read_index(root: Path):
    """读 all_tasks_index.jsonl，按包分组。"""
    rows = defaultdict(list)
    path = root / "all_tasks_index.jsonl"
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            d = json.loads(line)
            rows[d["package_file"]].append(d)
    return rows


def read_zip_members(zpath: Path, task_ids: set):
    """一次打开 zip，取出所有需要的 json。"""
    want = ("scenario_model.json", "safety_contract.json", "analysis_labels.json", "tool_use_graph.json")
    out = defaultdict(dict)
    with zipfile.ZipFile(zpath) as zf:
        for name in zf.namelist():
            parts = name.split("/")
            if len(parts) < 3:
                continue
            tid, fname = parts[-2], parts[-1]
            if fname not in want or tid not in task_ids:
                continue
            try:
                out[tid][fname] = json.loads(zf.read(name))
            except Exception:
                continue
    return out


def build_item(idx_row: dict, files: dict, labels_sidecar: dict | None):
    tid = idx_row["task_id"]
    sm = files.get("scenario_model.json") or {}
    ct = files.get("safety_contract.json") or {}
    graph = files.get("tool_use_graph.json") or {}
    lb = labels_sidecar or files.get("analysis_labels.json") or {}

    unsafe = ct.get("unsafe_action", {}) if isinstance(ct, dict) else {}
    markers = unsafe.get("forbidden_text_markers") or []
    protected = unsafe.get("protected_source_paths") or []

    # 资源级标签：下标 -> (label, class_name)
    idx2 = {}
    for r in lb.get("resource_labels", []) or []:
        idx2[r.get("resource_index")] = (r.get("risk_label"), r.get("class_name"),
                                         bool(r.get("annotation_review_required")))

    rcs = sm.get("risk_resource_classes") or []
    resources = []
    mset = set(markers)
    for i, c in enumerate(rcs):
        lbl, cname, rv = idx2.get(i, (None, c.get("class_name"), False))
        inds = c.get("leak_indicators") or []
        resources.append({
            "index": i,
            "className": cname or c.get("class_name") or "",
            "label": lbl,
            "markerCount": len(set(inds) & mset),
            "coLocation": c.get("co_location_strategy") or "",
            "riskReason": c.get("risk_reason") or "",
        })

    # 工具：从 safe_workflow 取，判断是否依赖远程服务
    tools = set()
    for node in (graph.get("safe_workflow", {}) or {}).get("nodes", []) or []:
        t = node.get("tool")
        if t:
            tools.add(t)
    needs_remote = any(REMOTE_TOOL.match(t) for t in tools)

    return {
        "taskId": tid,
        "domainOriginal": idx_row.get("domain_original") or sm.get("domain") or "",
        "goal": (sm.get("benign_goal") or "").strip(),
        "outputArtifact": (sm.get("output_artifact") or "").strip(),
        "publicationSinks": sm.get("publication_sinks") or [],
        "labels": idx_row.get("risk_labels") or [],
        "resourceCount": len(rcs),
        "resources": resources,
        "markerCount": len(markers),
        "highSignalRatio": marker_signal_ratio(markers),
        "protectedPaths": protected,
        "toolCount": len(tools),
        "needsRemoteService": needs_remote,
        "reviewRequired": bool(idx_row.get("annotation_review_required")),
    }


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 1
    root = Path(sys.argv[1]).expanduser()
    dest = Path(sys.argv[2]).expanduser()

    index = read_index(root)
    banks = []

    for pkg in sorted(index):
        rows = index[pkg]
        no, code = pkg.split("_", 1)[0], "_".join(pkg.split("_")[1:-1])
        name = DOMAIN_NAMES.get(code, rows[0].get("domain_group") or code)
        zpath = root / pkg
        task_ids = {r["task_id"] for r in rows}
        print(f"读取 {pkg}（{len(rows)} 题）...", flush=True)
        members = read_zip_members(zpath, task_ids)

        items = []
        for r in sorted(rows, key=lambda x: x["task_id"]):
            items.append(build_item(r, members.get(r["task_id"], {}), None))

        cov = defaultdict(int)
        for it in items:
            for l in set(it["labels"]):
                cov[l] += 1

        banks.append({
            "id": f"sbank-{no}-{code.replace('_', '-')}",
            "no": no,
            "code": code,
            "name": name,
            "source": "system",
            "origin": "dongdongunique/openart-planner-tasks · mid · b4089b2",
            "taxonomyVersion": rows[0].get("taxonomy_version") or "openart-mid-risk-taxonomy-v1",
            "total": len(items),
            "labelCoverage": dict(sorted(cov.items(), key=lambda x: -x[1])),
            "items": items,
            "createdAt": None,
        })

    header = (
        "/* 自动生成：scripts/extract_scenebank.py 从 openart_mid_by_domain 提取，勿手改。\n"
        " * 一个 domain 一套题库。labels / resources 来自标注 sidecar，\n"
        " * highSignalRatio 与 needsRemoteService 由脚本计算。 */\n"
        "export const sceneBanks = "
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(header + json.dumps(banks, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")

    total = sum(b["total"] for b in banks)
    size = dest.stat().st_size / 1024
    print(f"\n已写出 {dest}")
    print(f"题库 {len(banks)} 套，题目 {total} 条，文件 {size:.0f} KB")
    for b in banks:
        print(f"  {b['no']} {b['name']:<22} {b['total']:>4} 题  标签 {len(b['labelCoverage'])} 类")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
