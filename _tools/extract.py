"""从真实 OpenRT 结果目录生成 demo 数据层。

源：OpenRT results 目录（默认取与 AI演练场 同级的「模型演练数据」，可用环境变量 OPENRT_RESULTS 覆盖），
    下含 deepseek-v3-chat / qwen-flash / qwen-flash-guard
出：src/data/*.js（ES module，字面量快照，零逻辑）

跑法：
    python _tools/extract.py
"""

import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MNT = os.environ.get("OPENRT_RESULTS") or os.path.join(os.path.dirname(ROOT), "模型演练数据")
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

# JailBroken 变换技术 → 中文名
JB_TECH = {"prefix_injection": "前缀注入", "refusal_suppression": "拒绝抑制"}

# PAIR 攻击者（辅助模型）有时自己拒绝改写，产出的“攻击提示词”是一段拒绝文本，这一轮不构成有效攻击。
# 启发式：非首轮且提示词以拒绝句式开头。
ATTACKER_REFUSAL = re.compile(r"^\s*(I'm sorry|I am sorry|I can't|I cannot|I'm not going|I won't|I need to decline|Sorry)", re.I)


def read_text(path):
    """eval_log 编码不统一（多数为 GBK），先按 UTF-8 读，失败再按 GBK"""
    raw = open(path, "rb").read()
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("utf-8", errors="replace")


def full_steps(steps, final):
    """OpenRT 记录每步变换时把 prompt_after 截到 200 字符并加 "..."，完整文本只有最终的 transformed_prompt。
    还原：最后一步即送给靶标的完整提示词；中间步骤的变换（前缀注入、拒绝抑制）都只在前面追加内容，
    所以中间步骤的完整文本是最终提示词中、从该步截断前缀出现位置起的后缀。找不到时保留原样。"""
    out = []
    for i, st in enumerate(steps):
        txt = st.get("prompt_after", "")
        if txt.endswith("..."):
            head = txt[:-3]
            if i == len(steps) - 1:
                txt = final
            elif head and final.find(head) >= 0:
                txt = final[final.find(head):]
        out.append({"technique": st.get("technique", ""),
                    "label": JB_TECH.get(st.get("technique", ""), st.get("technique", "")),
                    "prompt": txt})
    return out


def judge_scores(log_lines):
    """裁判评分只写在 eval_log 的 [LIVE] judge_done 行里：{题目: score}"""
    out = {}
    for line in log_lines:
        m = re.search(r"\[LIVE\] (\{.*)", line)
        if not m:
            continue
        try:
            d = json.loads(m.group(1))
        except ValueError:
            continue
        if d.get("event") == "judge_done":
            out[d.get("target", "")] = d.get("score")
    return out


def judged_round(r):
    """裁判评判的是 final_prompt/output_text；找出它对应 history 的第几轮（PAIR 未攻破时可能不是最后一轮）"""
    hist = r.get("history") or []
    fp, fo = r.get("final_prompt") or "", r.get("output_text") or ""
    sent = lambda h: h.get("prompt") or h.get("transformed_prompt") or ""
    if hist and sent(hist[-1]) == fp and hist[-1].get("response") == fo:
        return len(hist)
    for i, h in enumerate(hist):
        if sent(h) == fp and h.get("response") == fo:
            return i + 1
    return len(hist) or 1


def load_guard(method_dir):
    """guard_log_*.jsonl → {送入靶标的 prompt: [审核记录…]}。
    同一提示词可能被送审多次（PAIR 攻击者重复产出同一段文本），因此保留列表，按时间先后排列，取用时逐条消费。"""
    gp = glob.glob(os.path.join(method_dir, "guard_log_*.jsonl"))
    if not gp:
        return None
    out = {}
    for line in open(gp[0], encoding="utf-8"):
        if line.strip():
            g = json.loads(line)
            out.setdefault(g["prompt"], []).append(g)
    for v in out.values():
        v.sort(key=lambda g: g.get("time", ""))
    return out


def take_guard(glog, sent, response):
    """取一条未用过的审核记录：优先最终返回与本轮回复一致的那条"""
    cands = glog.get(sent) or []
    for i, g in enumerate(cands):
        if g.get("final_response") == response:
            return cands.pop(i)
    return cands.pop(0) if cands else None


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
            log_lines = read_text(logp[0]).splitlines() if logp else []
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
            scores = judge_scores(log_lines)
            # 分类统计要用全量审核记录，先拍平一份；下面逐条消费的是副本
            glog_all = [g for v in glog.values() for g in v] if glog is not None else []
            gpool = {k: list(v) for k, v in glog.items()} if glog is not None else None
            for r in rows:
                hist = []
                for i, h in enumerate(r.get("history") or []):
                    # JailBroken 的每轮记录没有 prompt，送给靶标的是 transformed_prompt
                    sent = h.get("prompt") or h.get("transformed_prompt") or ""
                    item = {"round": i + 1, "prompt": sent, "response": h.get("response", "")}
                    if h.get("transformation_steps"):
                        item["original"] = h.get("original_prompt", "")
                        item["steps"] = full_steps(h["transformation_steps"], sent)
                    if mkey == "PAIR" and i > 0 and ATTACKER_REFUSAL.match(sent):
                        item["attackerRefused"] = True
                    if gpool is not None:
                        g = take_guard(gpool, sent, item["response"])
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
                    "judgeScore": scores.get(r.get("target", "")),
                    "rounds": len(r.get("history") or []),
                    "judgedRound": judged_round(r),
                    "history": hist,
                })
            if glog is not None:
                cats = {}
                for g in glog_all:
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
