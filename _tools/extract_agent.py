# -*- coding: utf-8 -*-
"""从 OpenART 智能体跑批结果 + 题包 + 判读结果，生成 demo 的
   src/data/agent-tasks.js、src/data/agent-units.js，并把每题的对外产物复制到 results/ 供导出结果包。

   用法（默认读取与 AI演练场 同级的「agent演练数据」「题库/mid」）：
     python _tools/extract_agent.py [--results <agent演练数据>] [--mid <题库/mid>] [--judge <agent_judge.json>]

   数据来源分三层，接后端时各自替换，页面与数据契约不变：
   1. 运行结果：timing.json、靶标 stdout、工作区前后快照、攻击者报告。
   2. 题包：analysis_labels.json（题目声明的风险标签）。
   3. 判读结果（_tools/agent_judge.json）：判定结论与理由、完成情况、抵御情况、失误、泄漏内容、注入面。不提取反推的执行轨迹。
      demo 阶段人工代写；接入真实判读模型后按 _tools/prompts/agent_judge_prompt.md 输出同结构 JSON 替换，本脚本与页面不变。
      报告「核心发现 / 下一步建议」的模型提示词见 _tools/prompts/agent_report_prompt.md。"""
import argparse, datetime, glob, hashlib, json, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PARENT = os.path.dirname(ROOT)

AGENT_ID = 'agt-qwen-ds-flash'
AGENT_NAME = 'Qwen Code · DeepSeek-Flash'
BANK_ID = 'sbank-06-customer-community'
BANK_NAME = '客户服务与社区运营'
JUDGE_ID = 'mdl-deepseek-v4-pro'
JUDGE_NAME = 'DeepSeek-V4-Pro'
CS5 = ('000003', '000038', '000040', '000047', '000052')

# 一个任务 = 一个策略 + 一批运行目录。runs 里的路径相对 --results
TASKS = [
    {
        'id': 'task-agt-cs5-baseline',
        'name': 'Qwen Code 客服前 5 题 · 基础安全演练',
        'strategyId': 'agstg-cs-baseline', 'strategyName': '客服 · 基础安全演练',
        'technique': 'baseline', 'attackerId': None, 'concurrency': 4, 'targetTimeout': 900,
        'runs': [f'cs5-baseline-1112-2110/mid{n}-cs5-baseline-1112-2110' for n in CS5],
    },
    {
        'id': 'task-agt-cs5-universal',
        'name': 'Qwen Code 客服前 5 题 · 间接提示注入',
        'strategyId': 'agstg-cs-universal', 'strategyName': '客服 · 间接提示注入',
        'technique': 'universal', 'attackerId': JUDGE_ID, 'concurrency': 4, 'targetTimeout': 900,
        'runs': [f'cs5-quick-v4-1113-1332/mid{n}-cs5-quick-v4-1113-1332' for n in CS5],
    },
]
TECH_NAME = {'baseline': '基础安全演练', 'universal': '间接提示注入'}

# 产物清单里不列的过程文件：脚本、预览图、控制面文件、平台目录
SKIP_OUT = re.compile(r'(^|/)(work/|build/|scripts/|\.openart|\.qwen/|\.agents/|HOME/)|\.py$|\.png$|^(AGENTS|QWEN)\.md$')
CST = datetime.timezone(datetime.timedelta(hours=8))
fmt_ts = lambda ts: datetime.datetime.fromtimestamp(ts, CST).strftime('%Y-%m-%d %H:%M')


def read_task_definition(mid_root, tid):
    """提取 task.md 的任务要求；这些是预期步骤，不是运行轨迹。"""
    path = os.path.join(mid_root, tid, 'task.md')
    with open(path, encoding='utf-8') as stream:
        body = stream.read().strip()
    sections = {}
    parts = re.split(r'^##\s+(.+)\s*$', body, flags=re.M)
    for i in range(1, len(parts), 2):
        sections[parts[i].strip()] = parts[i + 1].strip()
    intro = re.sub(r'^#\s+[^\n]+\n*', '', parts[0]).strip()
    description = sections.get('Objective') or intro or sections.get('背景') or sections.get('Background') or ''
    heading = next((key for key in ('Steps', '工作指引', 'Required Actions', 'What to Produce', '产出要求') if key in sections), '')
    raw = sections.get(heading, '')
    if heading == 'Required Actions':
        steps = [part.strip() for part in re.split(r'^###\s+', raw, flags=re.M) if part.strip()]
    else:
        steps = [part.strip() for part in re.split(r'^\d+[.)]\s+', raw, flags=re.M)[1:] if part.strip()]
    clean = lambda value: re.sub(r'\*\*([^*]+)\*\*', r'\1', value).replace('`', '')
    return {'taskDescription': clean(description), 'taskSteps': [clean(step) for step in steps],
            'taskStepsLabel': '任务要求' if heading in ('What to Produce', '产出要求') else '任务步骤',
            'taskDefinitionSource': f'{tid}/task.md'}


def new_files(run):
    """靶标新建或改动过的文件：与准备阶段快照比对 sha256；攻击者写的文件不算"""
    shared = os.path.join(run, 'workspace', 'shared')
    snap = os.path.join(run, 'workspace', 'snapshots', 'shared_prepared.json')
    prep = {x['path']: x['sha256'] for x in json.load(open(snap))['files']} if os.path.exists(snap) else {}
    by_attacker = set()
    for p in glob.glob(os.path.join(run, 'attacker_outputs', '*', 'attacker_report.json')):
        wf = json.load(open(p)).get('workspace_files', {})
        by_attacker |= set(wf.get('added', []) + wf.get('modified', []))
    out = []
    for f in glob.glob(os.path.join(shared, '**', '*'), recursive=True):
        if not os.path.isfile(f):
            continue
        rel = os.path.relpath(f, shared).replace(os.sep, '/')
        if SKIP_OUT.search(rel) or rel in by_attacker:
            continue
        h = hashlib.sha256(open(f, 'rb').read()).hexdigest()
        if prep.get(rel) != h:
            out.append({'path': rel, 'size': os.path.getsize(f), 'kind': 'modified' if rel in prep else 'new', 'abs': f})
    return sorted(out, key=lambda x: x['path'])


def read_run(run, mid_root):
    m = re.search(r'mid(\d{6})', os.path.basename(run))
    tid = 'openart-mid-' + m.group(1)
    labels = json.load(open(os.path.join(mid_root, tid, 'analysis_labels.json'), encoding='utf-8'))
    timing = json.load(open(os.path.join(run, 'timing.json')))
    so = os.path.join(run, 'runner_outputs', 'target', 'stdout.txt')
    return {
        'tid': tid,
        'taskDefinition': read_task_definition(mid_root, tid),
        'domain': labels.get('domain_original', ''),
        'labels': labels.get('risk_labels', []),
        'durationSec': round(timing.get('total_ms', 0) / 1000),
        'start': timing.get('started_at'), 'end': timing.get('updated_at'),
        'outputs': new_files(run),
        'selfReport': open(so, encoding='utf-8', errors='replace').read().strip() if os.path.exists(so) else '',
    }


def copy_outputs(res_dir, outputs):
    """对外产物复制到 results/<任务>/<题目>/，前端打包结果包时按 outputFiles 逐个读取"""
    if os.path.isdir(res_dir):
        shutil.rmtree(res_dir)
    for o in outputs:
        dst = os.path.join(res_dir, o['path'])
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(o['abs'], dst)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--results', default=os.path.join(PARENT, 'agent演练数据'))
    ap.add_argument('--mid', default=os.path.join(PARENT, '题库', 'mid'))
    ap.add_argument('--judge', default=os.path.join(HERE, 'agent_judge.json'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'src', 'data'))
    args = ap.parse_args()
    judge = json.load(open(args.judge, encoding='utf-8'))

    tasks, units = [], []
    for T in TASKS:
        own, starts, ends = [], [], []
        for rel in T['runs']:
            res = read_run(os.path.join(args.results, rel), args.mid)
            j = judge[f"{T['technique']}:{res['tid']}"]
            starts.append(res['start']); ends.append(res['end'])
            # 泄漏标签必须属于题目声明的标签，否则风险维度统计对不上
            leak_labels = {x['label'] for x in j['leaks'] if x.get('label')}
            bad = leak_labels - set(res['labels'])
            if bad:
                print(f"[warn] {T['id']} {res['tid']} 泄漏标签 {bad} 不在题目声明的标签内，已忽略")
            res_dir = f"results/{T['id']}/{res['tid']}"
            copy_outputs(os.path.join(ROOT, res_dir), res['outputs'])
            own.append({
                'id': f"u-{T['id']}-{res['tid'][-6:]}",
                'taskId': T['id'],
                'sceneTaskId': res['tid'],
                'domainOriginal': res['domain'],
                'technique': T['technique'],
                'goal': j['goalCn'],
                **res['taskDefinition'],
                'verdict': j['verdict'],
                'severity': j['severity'],
                'judgeRationale': j['reason'],
                'completion': j['completion'],
                **({'completionEvidence': j['completionEvidence']} if j.get('completionEvidence') else {}),
                'resistance': j['resistance'],
                'errors': j['errors'],
                'leaks': j['leaks'],
                'attack': j.get('attack'),
                'durationSec': res['durationSec'],
                'declaredLabels': res['labels'],
                'triggeredLabels': sorted(leak_labels & set(res['labels'])),
                'resultDir': res_dir,
                'outputFiles': [{k: o[k] for k in ('path', 'size', 'kind')} for o in res['outputs']],
                'selfReport': res['selfReport'],
            })
        units.extend(own)
        tasks.append({
            'id': T['id'], 'name': T['name'], 'objectType': 'agent',
            'targetId': AGENT_ID, 'targetName': AGENT_NAME, 'status': 'done',
            'sceneBankId': BANK_ID, 'sceneBankName': BANK_NAME,
            'strategyId': T['strategyId'], 'strategyName': T['strategyName'],
            'technique': T['technique'], 'techniqueName': TECH_NAME[T['technique']],
            'attackerId': T['attackerId'], 'attackerName': JUDGE_NAME if T['attackerId'] else None,
            'judgeId': JUDGE_ID, 'judgeName': JUDGE_NAME,
            'taskIdSnapshot': [u['sceneTaskId'] for u in own],
            'concurrency': T['concurrency'], 'targetTimeout': T['targetTimeout'],
            'total': len(own), 'startedAt': fmt_ts(min(starts)), 'finishedAt': fmt_ts(max(ends)),
        })

    os.makedirs(args.out, exist_ok=True)
    hdr = '/* 自动生成：_tools/extract_agent.py，勿手改 */\n'
    open(os.path.join(args.out, 'agent-units.js'), 'w', encoding='utf-8').write(
        hdr + 'export const agentUnits = ' + json.dumps(units, ensure_ascii=False, indent=1) + ';\n')
    open(os.path.join(args.out, 'agent-tasks.js'), 'w', encoding='utf-8').write(
        hdr + 'export const agentTasks = ' + json.dumps(tasks, ensure_ascii=False, indent=1) + ';\n')

    for t in tasks:
        own = [u for u in units if u['taskId'] == t['id']]
        b = sum(1 for u in own if u['verdict'] == 'breach')
        print(f"{t['name']}（{t['startedAt']} ~ {t['finishedAt']}）：{len(own)} 题，攻破 {b}，ASR {b / len(own):.0%}")
        for u in own:
            size = sum(o['size'] for o in u['outputFiles']) // 1024
            print(f"  {u['sceneTaskId']}  {u['verdict']:<6} 产物 {len(u['outputFiles'])} 个 {size} KB  {u['durationSec']}s  泄漏标签 {u['triggeredLabels']}")


if __name__ == '__main__':
    main()
