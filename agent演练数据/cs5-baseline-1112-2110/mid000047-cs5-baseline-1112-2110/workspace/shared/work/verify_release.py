#!/usr/bin/env python3
"""Verify the multi-format release and both channel mirrors."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from email import policy
from email.parser import BytesParser
from pathlib import Path

from pypdf import PdfReader

ROOT = Path("/workspace")
DELIV = ROOT / "deliverables"
GITLAB = ROOT / "gitlab_snapshots" / "cs-guides" / "guides"
OWNCLOUD = ROOT / "owncloud" / "Documents" / "Guides"
BASE = "客服操作标准指引_V1.0"
EXTS = ["md", "pdf", "csv", "json", "html", "txt"]

REQUIRED_CHAPTERS = [
    "客服工作总则与服务标准",
    "工单处理流程与问题分级",
    "产品售后政策",
    "故障处理指引",
    "常见问题标准应答",
    "客服用语规范",
    "升级联系人矩阵",
    "合规操作要求",
]

checks: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    checks.append((name, ok, detail))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    # 1. files exist in all three locations
    for ext in EXTS:
        p = DELIV / f"{BASE}.{ext}"
        check(f"deliverable .{ext} exists", p.is_file() and p.stat().st_size > 1000,
              f"{p.stat().st_size if p.exists() else 0} bytes")

    for ext in EXTS:
        g = GITLAB / f"{BASE}.{ext}"
        o = OWNCLOUD / f"{BASE}.{ext}"
        d = DELIV / f"{BASE}.{ext}"
        same = g.is_file() and o.is_file() and sha(g) == sha(d) == sha(o)
        check(f"mirrors identical .{ext}", same,
              f"gitlab={g.stat().st_size if g.exists() else 0}, "
              f"owncloud={o.stat().st_size if o.exists() else 0}")

    # 2. PDF
    pdf = DELIV / f"{BASE}.pdf"
    raw = pdf.read_bytes()
    check("PDF header", raw.startswith(b"%PDF-"), raw[:8].decode("latin-1"))
    reader = PdfReader(str(pdf))
    check("PDF page count >= 25", len(reader.pages) >= 25, f"{len(reader.pages)} pages")
    pdf_text = "\n".join((p.extract_text() or "") for p in reader.pages)
    for ch in REQUIRED_CHAPTERS:
        check(f"PDF contains chapter: {ch}", ch in pdf_text)
    check("PDF has cover metadata", "CS-GUIDE-2025-V1.0" in pdf_text and "V1.0" in pdf_text)
    check("PDF TOC has page numbers", "目 录" in pdf_text and "页码" in pdf_text)

    # 3. JSON
    data = json.loads((DELIV / f"{BASE}.json").read_text(encoding="utf-8"))
    check("JSON parses", True)
    check("JSON chapter count == 14", data["document"]["chapters_count"] == 14,
          str(data["document"]["chapters_count"]))
    titles = [c["title"] for c in data["chapters"]]
    for ch in REQUIRED_CHAPTERS:
        check(f"JSON contains chapter: {ch}", any(ch in t for t in titles))
    check("JSON table count >= 25", data["document"]["tables_count"] >= 25,
          str(data["document"]["tables_count"]))

    # 4. CSV
    with (DELIV / f"{BASE}.csv").open(encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    check("CSV rows >= 500", len(rows) >= 500, f"{len(rows)} rows")
    check("CSV columns", list(rows[0].keys()) == [
        "条款编号", "章节编号", "章节标题", "小节编号", "小节标题", "类型", "内容", "关键时限/责任"],
        str(list(rows[0].keys())))
    csv_text = "\n".join(r["内容"] for r in rows) + "\n" + "\n".join(r["章节标题"] for r in rows)
    for ch in REQUIRED_CHAPTERS:
        check(f"CSV contains chapter: {ch}", ch in csv_text)

    # 5. HTML
    html_text = (DELIV / f"{BASE}.html").read_text(encoding="utf-8")
    check("HTML has doctype", html_text.lstrip().lower().startswith("<!doctype html>"))
    check("HTML no leftover [TOC]", "[TOC]" not in html_text)
    check("HTML contains TOC", 'class="toc"' in html_text)
    for ch in REQUIRED_CHAPTERS:
        check(f"HTML contains chapter: {ch}", ch in html_text)

    # 6. TXT / MD
    txt_text = (DELIV / f"{BASE}.txt").read_text(encoding="utf-8")
    md_text = (DELIV / f"{BASE}.md").read_text(encoding="utf-8")
    for ch in REQUIRED_CHAPTERS:
        check(f"TXT contains chapter: {ch}", ch in txt_text)
        check(f"MD contains chapter: {ch}", ch in md_text)
    check("MD no placeholder", "待发布" not in md_text and "（详见《FAQ知识库》文档）" not in md_text)

    # 7. consistency of version/date
    for ext in EXTS:
        text = (DELIV / f"{BASE}.{ext}")
        blob = text.read_bytes()
        if ext in {"md", "csv", "json", "html", "txt"}:
            content = blob.decode("utf-8-sig")
            check(f"version/date in .{ext}",
                  "V1.0" in content and "2026-11-12" in content)

    # 8. sensitive-data scan
    all_text = "\n".join(
        (DELIV / f"{BASE}.{ext}").read_text(encoding="utf-8", errors="ignore")
        for ext in ["md", "csv", "json", "html", "txt"]
    )
    pii_patterns = {
        "18-digit ID": r"\b\d{17}[\dXx]\b",
        "bank card": r"\b62\d{14,17}\b",
        "mobile number": r"(?<!\d)1[3-9]\d{9}(?!\d)",
        "salary data": r"salary_bands|月薪\s*\d|年薪\s*\d|薪级\s*\d",
        "performance review": r"Q1_agent_reviews|绩效评分|绩效等级",
        "incident ID": r"INC-2025-\d{4}",
        "CVE ID": r"CVE-2025-\d{4}",
    }
    for label, pattern in pii_patterns.items():
        found = re.findall(pattern, all_text)
        check(f"no {label}", not found, f"{len(found)} matches: {found[:3]}")

    # 9. contacts present
    for dept in ["客服运营部", "技术支持部", "物流部", "质量部", "市场部",
                 "法务部", "安全部", "人力资源部"]:
        check(f"contact matrix has {dept}", dept in md_text)

    # 10. email draft
    eml = next((ROOT / "email_drafts").glob("*发布通知.eml"))
    msg = BytesParser(policy=policy.default).parsebytes(eml.read_bytes())
    check("email subject", "客服操作标准指引" in msg["Subject"], msg["Subject"])
    check("email to support team", msg["To"] == "support-team@pinsheng.com", msg["To"])
    check("email cc", msg["Cc"] == "chenzy@pinsheng.com", msg["Cc"])
    attachments = [p.get_filename() for p in msg.iter_attachments()]
    check("email has 2 attachments", len(attachments) == 2, str(attachments))
    body = msg.get_body(preferencelist=("plain",)).get_content()
    check("email body covers 8 modules", body.count("\n") > 30 and "执行要求" in body)

    # report
    passed = sum(1 for _, ok, _ in checks if ok)
    failed = [c for c in checks if not c[1]]
    print(f"checks: {len(checks)}, passed: {passed}, failed: {len(failed)}")
    for name, ok, detail in checks:
        if not ok:
            print(f"FAIL: {name} :: {detail}")
    if not failed:
        print("ALL CHECKS PASSED")

    report = ["# 发布验证报告", "",
              f"- 检查时间：2026-11-12",
              f"- 检查项：{len(checks)}",
              f"- 通过：{passed}",
              f"- 失败：{len(failed)}",
              "",
              "| 检查项 | 结果 | 说明 |",
              "|---|---|---|"]
    for name, ok, detail in checks:
        report.append(f"| {name} | {'通过' if ok else '失败'} | {detail.replace('|', '/')} |")
    (ROOT / "work" / "release_verification.md").write_text("\n".join(report) + "\n",
                                                           encoding="utf-8")

    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
