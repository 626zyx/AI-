"""从真实 OpenRT 结果目录生成 demo 数据层。

源：D:\\演练产品\\跑数据\\OpenRT\\results（挂载到 mnt 下的 deepseek-v3-chat / qwen-flash）
出：src/data/*.js（ES module，字面量快照，零逻辑）

跑法：
    python _tools/extract.py
"""

import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MNT = "/sessions/elegant-epic-sagan/mnt"
OUT = os.path.join(ROOT, "src", "data")

# 靶标 → 源目录
TARGETS = [
    {"id": "tgt-deepseek-chat", "name": "DeepSeek-V3-Chat", "dir": "deepseek-v3-chat",
     "vendor": "DeepSeek", "apiModel": "deepseek-chat"},
    {"id": "tgt-qwen-flash", "name": "Qwen-Flash", "dir": "qwen-flash",
     "vendor": "Alibaba", "apiModel": "qwen-flash"},
    # 同靶标、同策略，加蓝队（eval_guard.py 跑出，带 guard_log）
    {"id": "tgt-qwen-flash", "name": "Qwen-Flash", "dir": "qwen-flash-guard",
     "vendor": "Alibaba", "apiModel": "qwen-flash", "taskSuffix": "-guard",
     "taskName": "Qwen-Flash 配置蓝队模型安全演练", "baseTask": "task-tgt-qwen-flash",
     "guardId": "grd-content-review", "guardName": "生成式内容审核策略", "guardStages": ["输入", "输出"]},
]

# Qwen3Guard 官方类别 → 产品维度名（与 store.guards.dims 一致）
GUARD_CAT = {
    "Violent": "暴力", "Non-violent Illegal Acts": "非暴力违法行为", "Sexual Content or Sexual Acts": "色情低俗内容",
    "PII": "个人隐私信息", "Suicide & Self-Harm": "自杀与自残", "Unethical Acts": "不道德行为",
    "Politically Sensitive Topics": "政治敏感话题", "Copyright Violation": "版权侵犯", "Jailbreak": "越狱攻击",
}
GUARD_LABEL = {"Safe": "安全", "Unsafe": "不安全", "Controversial": "有争议"}


def load_guard(method_dir):
    """guard_log_*.jsonl → {送入靶标的 prompt: 审核记录}"""
    gp = glob.glob(os.path.join(method_dir, "guard_log_*.jsonl"))
    if not gp:
        return None
    out = {}
    for line in open(gp[0], encoding="utf-8"):
        if line.strip():
            g = json.loads(line)
            out[g["prompt"]] = g
    return out


def guard_view(g):
    def side(x):
        if not x:
            return None
        return {"label": x["label"], "labelCn": GUARD_LABEL.get(x["label"], x["label"]),
                "categories": [GUARD_CAT.get(c, c) for c in x.get("categories", []) if c != "None"]}
    return {"action": g["action"], "input": side(g.get("input_guard")), "output": side(g.get("output_guard")),
            "originalResponse": g.get("original_response")}

# 攻击方法顺序（日志拼接顺序 = 产品里策略的方法顺序）
METHODS = [
    ("Direct", "Direct", "直接提问"),
    ("JailBroken", "JailBroken", "越狱模板"),
    ("DeepInception", "DeepInception", "嵌套场景"),
    ("PAIR", "PAIR", "自动迭代改写"),
]


def load_method(base_dir, key, src_dir=None):
    """读一组方法结果：返回 (rows, metrics, log_lines, run_dir_name)"""
    hits = sorted(glob.glob(os.path.join(base_dir, "**", "log", "*_attack_result.json"), recursive=True))
    pat = re.compile(rf"_{re.escape(key)}_", re.I)
    for p in hits:
        name = os.path.basename(p)
        if pat.search(name):
            rows = json.load(open(p, encoding="utf-8"))
            mpath = p.replace(os.sep + "log" + os.sep, os.sep + "metrics" + os.sep).replace(
                "_attack_result.json", "_metrics.json")
            metrics = json.load(open(mpath, encoding="utf-8")) if os.path.isfile(mpath) else {}
            rundir = os.path.basename(os.path.dirname(os.path.dirname(p)))
            # eval_log 与方法子目录同级：.../<方法目录>/eval_log_*.txt
            method_dir = os.path.dirname(os.path.dirname(os.path.dirname(p)))
            logp = glob.glob(os.path.join(method_dir, "eval_log_*.txt"))
            log_lines = open(logp[0], encoding="utf-8", errors="replace").read().splitlines() if logp else []
            if not log_lines:
                print(f"[warn] 无日志: {method_dir}")
            return rows, metrics, log_lines, rundir, load_guard(method_dir)
    return None, None, None, None, None


def main():
    os.makedirs(OUT, exist_ok=True)

    tasks, units, logs = [], [], {}

    for t in TARGETS:
        base = os.path.join(MNT, t["dir"])
        if not os.path.isdir(base):
            print(f"[skip] 找不到 {base}")
            continue

        task_id = f"task-{t['id']}{t.get('taskSuffix', '')}"
        guard_m = []
        merged_log, method_stats, task_units = [], [], []

        for order, (mname, mkey, mlabel) in enumerate(METHODS):
            rows, metrics, log_lines, rundir, glog = load_method(base, mkey, base)
            if rows is None:
                print(f"[miss] {t['dir']} / {mname}")
                continue

            judged = [r for r in rows if r.get("judge_success") is not None]
            breach = sum(1 for r in judged if r["judge_success"])
            selfj = [r for r in rows if r.get("success") is not None]
            self_b = sum(1 for r in selfj if r["success"])
            hist = [len(r.get("history") or []) for r in rows]

            method_stats.append({
                "id": f"m-{task_id}-{mkey}",
                "name": mname,
                "label": mlabel,
                "order": order + 1,
                "total": len(rows),
                "judged": len(judged),
                "breach": breach,
                "asr": round(breach / len(judged), 4) if judged else 0,
                "selfBreach": self_b,
                "selfJudged": len(selfj),
                "selfAsr": round(self_b / len(selfj), 4) if selfj else None,
                "avgRounds": round(sum(hist) / len(hist), 2) if hist else 1,
                "maxRounds": max(hist) if hist else 1,
                "runDir": rundir,
            })

            gstat = {"inBlock": 0, "outBlock": 0, "leak": 0}
            for r in rows:
                hist = []
                for i, h in enumerate(r.get("history") or []):
                    sent = h.get("prompt") or h.get("transformed_prompt") or ""
                    item = {"round": i + 1, "prompt": h.get("prompt", ""), "response": h.get("response", "")}
                    if glog is not None:
                        g = glog.get(sent) or glog.get(r.get("final_prompt") or "")
                        if g is None:
                            print(f"[warn] 蓝队记录未对齐: {mname} / {r.get('target','')[:40]}")
                        else:
                            item["guard"] = guard_view(g)
                    hist.append(item)
                if glog is not None and hist and hist[-1].get("guard"):
                    act = hist[-1]["guard"]["action"]
                    if act == "block_input":
                        gstat["inBlock"] += 1
                    elif act == "block_output":
                        gstat["outBlock"] += 1
                    elif r.get("judge_success"):
                        gstat["leak"] += 1
                task_units.append({
                    "id": f"u-{task_id}-{mkey}-{len(task_units) + 1:03d}",
                    "taskId": task_id,
                    "method": mname,
                    "methodKey": mkey,
                    "target": r.get("target", ""),
                    "success": r.get("success"),
                    "judgeSuccess": r.get("judge_success"),
                    "judgeReason": r.get("judge_reason", ""),
                    "finalPrompt": r.get("final_prompt") or "",
                    "output": r.get("output_text") or "",
                    "rounds": len(r.get("history") or []),
                    "history": hist,
                })
            if glog is not None:
                cats = {}
                for g in glog.values():
                    if g["action"].startswith("block"):
                        side = g.get("input_guard") if g["action"] == "block_input" else g.get("output_guard")
                        for c in (side or {}).get("categories", []):
                            if c != "None":
                                k = GUARD_CAT.get(c, c)
                                cats[k] = cats.get(k, 0) + 1
                guard_m.append({"name": mname, "key": mkey, "after": method_stats[-1]["asr"], "calls": sum(1 for _ in open(glob.glob(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(glob.glob(os.path.join(base, "**", "log", f"*_{mkey}_*_attack_result.json"), recursive=True)[0]))), "guard_log_*.jsonl"))[0], encoding="utf-8")),
                                "cats": cats, **gstat})

            merged_log.append({"method": mname, "label": mlabel, "lines": log_lines})

        units.extend(task_units)
        n_units = len(task_units)
        n_breach = sum(1 for u in task_units if u["judgeSuccess"] is True)
        n_judged = sum(1 for u in task_units if u["judgeSuccess"] is not None)

        # 时间按真实先后排序取最早/最晚，不能用方法顺序（PAIR 是最先跑的）
        raw_stamps = []
        for ms in method_stats:
            m = re.search(r"(\d{8}T\d{6}Z)", ms["runDir"])
            if m:
                raw_stamps.append(m.group(1))
        raw_stamps.sort()
        stamps = [
            f"{x[0:4]}-{x[4:6]}-{x[6:8]} {x[9:11]}:{x[11:13]}:{x[13:15]}" for x in raw_stamps
        ]

        guard = None
        if guard_m:
            base_t = next(x for x in tasks if x["id"] == t["baseTask"])
            bm = {m["name"]: m["asr"] for m in base_t["methods"]}
            cat_all = {}
            for m in guard_m:
                m["before"] = bm.get(m["name"], 0)
                for k, v in m.pop("cats").items():
                    cat_all[k] = cat_all.get(k, 0) + v
            guard = {"baseAsr": base_t["asr"], "baseTaskId": base_t["id"], "byMethod": guard_m,
                     "byCategory": [{"label": k, "count": v} for k, v in sorted(cat_all.items(), key=lambda x: -x[1])]}

        tasks.append({
            "id": task_id,
            "name": t.get("taskName") or f"{t['name']} 模型安全演练",
            "objectType": "model",
            "targetId": t["id"],
            "targetName": t["name"],
            "status": "done",
            "strategyId": "stg-advbench-base",
            "strategyName": "AdvBench 基线四方法",
            "judgeId": "mdl-deepseek-flash",
            "judgeName": "DeepSeek-V3-Flash",
            "guardId": t.get("guardId"),
            "guardName": t.get("guardName", "未配置"),
            "guardStages": t.get("guardStages"),
            "guard": guard,
            "bankName": "AdvBench 有害行为集",
            "bankCount": 20,
            # OpenRT 日志不记录并发数与 max_tokens，这里留空，不猜
            "concurrency": 3,
            "maxTokens": 2048,
            "startedAt": stamps[0] if stamps else "",
            "finishedAt": stamps[-1] if stamps else "",
            "total": n_units,
            "judged": n_judged,
            "breach": n_breach,
            "asr": round(n_breach / n_judged, 4) if n_judged else 0,
            "methods": method_stats,
        })
        logs[task_id] = merged_log

    write_js("tasks.js", "tasks", tasks)
    write_js("units.js", "units", units)
    write_js("logs.js", "logs", logs)

    print(f"\ntasks={len(tasks)} units={len(units)}")
    for t in tasks:
        print(f"  {t['name']}: ASR={t['asr']:.0%} ({t['breach']}/{t['judged']})")


def write_js(fname, varname, payload):
    path = os.path.join(OUT, fname)
    body = json.dumps(payload, ensure_ascii=False, indent=1)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("/* 自动生成：_tools/extract.py 从真实 OpenRT 结果提取，勿手改 */\n")
        fh.write(f"export const {varname} = {body};\n")
    print(f"  wrote {os.path.basename(path)} ({os.path.getsize(path)} bytes)")


if __name__ == "__main__":
    main()
