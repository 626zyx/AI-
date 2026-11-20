#!/usr/bin/env python3
"""从本地解压后的题包目录生成 src/data/scene-banks.js。

与 extract_scenebank.py（读 openart_mid_by_domain 的 zip 打包结果）产出同一份数据结构，
区别是直接读解压目录：每个子目录是一道题（openart-mid-XXXXXX），含
scenario_model.json / safety_contract.json / analysis_labels.json / tool_use_graph.json。

用法（默认读取与 AI演练场 同级的「题库/mid」）：
  python3 scripts/extract_scenebank_dir.py [<题包目录>] [<输出 js>]

14 个 domain 题库骨架全部保留；目录里有题的 domain 填入 items，其余 items 为空。"""
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from extract_scenebank import DOMAIN_NAMES, build_item  # noqa: E402  复用同一套题目字段计算

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = 'dongdongunique/openart-planner-tasks · mid · b4089b2'
TAXONOMY = 'openart-mid-risk-taxonomy-v1'

# 与 openart_mid_by_domain 的包编号、打包题数一致
DOMAINS = [
    ('01', 'general_operations', 509), ('02', 'security_governance', 83), ('03', 'marketing_media', 76),
    ('04', 'software_data', 57), ('05', 'finance_insurance', 49), ('06', 'customer_community', 47),
    ('07', 'education_research', 46), ('08', 'legal_compliance', 36), ('09', 'procurement_facilities', 34),
    ('10', 'hr_recruiting', 33), ('11', 'healthcare_clinical', 27), ('12', 'public_government', 21),
    ('13', 'personal_household', 18), ('14', 'nonprofit_volunteer', 10),
]


def load(p: Path):
    try:
        return json.loads(p.read_text(encoding='utf-8'))
    except Exception:
        return {}


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / '题库' / 'mid'
    dest = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'src' / 'data' / 'scene-banks.js'

    by_code = defaultdict(list)
    for d in sorted(p for p in src.iterdir() if p.is_dir() and p.name.startswith('openart-mid-')):
        lb = load(d / 'analysis_labels.json')
        files = {n: load(d / n) for n in ('scenario_model.json', 'safety_contract.json', 'analysis_labels.json', 'tool_use_graph.json')}
        row = {
            'task_id': d.name,
            'domain_original': lb.get('domain_original'),
            'risk_labels': lb.get('risk_labels') or [],
            'annotation_review_required': lb.get('annotation_review_required'),
        }
        by_code[lb.get('domain_group_code') or 'unknown'].append(build_item(row, files, lb))

    banks = []
    for no, code, packed in DOMAINS:
        items = by_code.get(code, [])
        cov = defaultdict(int)
        for it in items:
            for l in set(it['labels']):
                cov[l] += 1
        banks.append({
            'id': f"sbank-{no}-{code.replace('_', '-')}",
            'no': no, 'code': code, 'name': DOMAIN_NAMES[code],
            'source': 'system', 'origin': ORIGIN, 'taxonomyVersion': TAXONOMY,
            'total': len(items) or packed,
            'labelCoverage': dict(sorted(cov.items(), key=lambda x: -x[1])),
            'items': items,
            'createdAt': None,
        })

    header = (
        '/* 自动生成：scripts/extract_scenebank_dir.py 从本地题包目录提取，勿手改。\n'
        ' * 一个 domain 一套题库；目录里没有题的 domain 只有骨架（items 为空，total 为打包题数）。 */\n'
        'export const sceneBanks = '
    )
    dest.write_text(header + json.dumps(banks, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    for b in banks:
        if b['items']:
            print(f"{b['no']} {b['name']}：{len(b['items'])} 题，标签 {dict(b['labelCoverage'])}")
    print(f'已写出 {dest}（{dest.stat().st_size // 1024} KB）')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
