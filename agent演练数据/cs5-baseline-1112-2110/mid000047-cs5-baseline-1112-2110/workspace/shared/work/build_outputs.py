#!/usr/bin/env python3
"""Build MD/PDF/CSV/JSON/HTML/TXT releases from the master markdown guide."""

from __future__ import annotations

import csv
import html
import json
import re
import sys
from pathlib import Path

import markdown
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    LongTable,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path("/workspace")
SRC = ROOT / "deliverables" / "客服操作标准指引_V1.0.md"
OUT = ROOT / "deliverables"
BASE = "客服操作标准指引_V1.0"

FONT_PATH = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"
FONT = "WQYMicroHei"

DOC_TITLE = "品胜科技 客服操作标准指引"
DOC_SUBTITLE = "Customer Service Standard Operating Guide"
DOC_VERSION = "V1.0"
DOC_DATE = "2026-11-12"
DOC_CODE = "CS-GUIDE-2025-V1.0"


# --------------------------------------------------------------------------
# Markdown AST
# --------------------------------------------------------------------------
def is_table_sep(line: str) -> bool:
    s = line.strip()
    return bool(re.fullmatch(r"\|?[\s:\-|]+\|?", s)) and "-" in s


def split_row(line: str) -> list[str]:
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def parse_markdown(text: str) -> dict:
    lines = text.splitlines()
    doc: dict = {"title": "", "blocks": [], "chapters": []}
    current_chapter = None
    current_section = None
    current_list = None
    i = 0

    def add_block(block: dict, level: str = "section", reset_list: bool = True) -> None:
        nonlocal current_list
        if reset_list:
            current_list = None
        if level == "front":
            doc["blocks"].append(block)
        elif level == "chapter" and current_chapter is not None:
            current_chapter["blocks"].append(block)
        elif current_section is not None:
            current_section["blocks"].append(block)
        elif current_chapter is not None:
            current_chapter["blocks"].append(block)

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        if not stripped:
            current_list = None
            i += 1
            continue

        if stripped.startswith("<!--"):
            i += 1
            continue

        m = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            current_list = None
            if level == 1:
                doc["title"] = title
                doc["blocks"].append({"type": "title", "text": title})
                current_chapter = None
                current_section = None
            elif level == 2:
                current_chapter = {
                    "title": title,
                    "blocks": [],
                    "sections": [],
                }
                doc["chapters"].append(current_chapter)
                current_section = None
            elif level == 3:
                current_section = {"title": title, "blocks": [], "subsections": []}
                if current_chapter is None:
                    doc["blocks"].append({"type": "heading", "level": 3, "text": title})
                else:
                    current_chapter["sections"].append(current_section)
            else:
                block = {"type": "heading", "level": level, "text": title}
                if current_section is not None:
                    current_section["blocks"].append(block)
                elif current_chapter is not None:
                    current_chapter["blocks"].append(block)
                else:
                    doc["blocks"].append(block)
            i += 1
            continue

        if stripped == "---":
            add_block({"type": "hr"}, "front" if current_chapter is None else "section")
            i += 1
            continue

        if stripped.startswith("|") and i + 1 < len(lines) and is_table_sep(lines[i + 1]):
            header = split_row(stripped)
            rows = []
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(split_row(lines[i]))
                i += 1
            add_block({"type": "table", "headers": header, "rows": rows},
                      "front" if current_chapter is None else "section")
            continue

        if stripped.startswith(">"):
            buf = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                buf.append(lines[i].strip()[1:].strip())
                i += 1
            add_block({"type": "quote", "text": " ".join(buf)},
                      "front" if current_chapter is None else "section")
            continue

        m = re.match(r"^[-*]\s+(.*)$", stripped)
        if m:
            if current_list is None or current_list.get("ordered") is not False:
                current_list = {"type": "list", "ordered": False, "items": []}
                add_block(current_list, "front" if current_chapter is None else "section",
                          reset_list=False)
            current_list["items"].append(m.group(1))
            i += 1
            continue

        m = re.match(r"^\d+\.\s+(.*)$", stripped)
        if m:
            if current_list is None or current_list.get("ordered") is not True:
                current_list = {"type": "list", "ordered": True, "items": []}
                add_block(current_list, "front" if current_chapter is None else "section",
                          reset_list=False)
            current_list["items"].append(m.group(1))
            i += 1
            continue

        # paragraph: collect until blank, structural line, or a markdown hard break
        if raw.endswith("  "):
            add_block({"type": "paragraph", "text": stripped},
                      "front" if current_chapter is None else "section")
            i += 1
            continue
        buf = [stripped]
        i += 1
        while i < len(lines):
            nxt = lines[i].rstrip("\n")
            ns = nxt.strip()
            if (not ns or ns.startswith("#") or ns.startswith("|") or ns.startswith(">")
                    or ns == "---" or re.match(r"^[-*]\s+", ns) or re.match(r"^\d+\.\s+", ns)
                    or nxt.endswith("  ")):
                break
            buf.append(ns)
            i += 1
        add_block({"type": "paragraph", "text": "".join(buf)},
                  "front" if current_chapter is None else "section")

    return doc


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def clean_inline(text: str) -> str:
    return text.replace("`", "").strip()


def esc(text: str) -> str:
    return html.escape(clean_inline(text), quote=False)


def strip_md(text: str) -> str:
    return re.sub(r"\*\*(.+?)\*\*", r"\1", clean_inline(text))


def time_tokens(text: str) -> str:
    found = re.findall(r"\d+\s*(?:个工作日|工作日|小时|分钟|秒|天|个月|年|%)", text)
    seen = []
    for token in found:
        token = token.strip()
        if token not in seen:
            seen.append(token)
    return "、".join(seen[:4])


def role_tokens(text: str) -> str:
    roles = ["客服经理", "客服主管", "客服组长", "技术二线", "技术经理", "质检主管",
             "安全部", "法务部", "物流部", "风控", "数据保护官", "一线客服"]
    found = [r for r in roles if r in text]
    return "、".join(found[:2])


def iter_blocks(doc: dict):
    for b in doc["blocks"]:
        yield "front", None, None, b
    for chapter in doc["chapters"]:
        for b in chapter["blocks"]:
            yield "chapter", chapter, None, b
        for section in chapter["sections"]:
            for b in section["blocks"]:
                yield "section", chapter, section, b


# --------------------------------------------------------------------------
# JSON
# --------------------------------------------------------------------------
def build_json(doc: dict) -> dict:
    chapters = []
    for idx, ch in enumerate(doc["chapters"], 1):
        sections = []
        for s_idx, sec in enumerate(ch["sections"], 1):
            sections.append({
                "id": f"{idx}.{s_idx}",
                "title": strip_md(sec["title"]),
                "blocks": sec["blocks"],
            })
        chapters.append({
            "id": f"{idx:02d}",
            "title": strip_md(ch["title"]),
            "blocks": ch["blocks"],
            "sections": sections,
        })

    return {
        "document": {
            "title": DOC_TITLE,
            "subtitle": DOC_SUBTITLE,
            "version": DOC_VERSION,
            "document_code": DOC_CODE,
            "publish_date": DOC_DATE,
            "department": "客服运营部",
            "language": "zh-CN",
            "replaces": ["客服操作手册 V3.0", "售后故障处理指南 V2.1"],
            "chapters_count": len(chapters),
            "tables_count": sum(1 for b in iter_blocks(doc) if b[3]["type"] == "table"),
        },
        "front_matter": doc["blocks"],
        "chapters": chapters,
    }


# --------------------------------------------------------------------------
# CSV
# --------------------------------------------------------------------------
def build_csv(doc: dict, path: Path) -> None:
    rows = []
    clause_seq = 0

    def add_row(chapter, section, block_type, content, extra=""):
        nonlocal clause_seq
        clause_seq += 1
        ch_no = ""
        ch_title = ""
        sec_no = ""
        sec_title = ""
        if chapter:
            ch_no = f"{doc['chapters'].index(chapter) + 1:02d}"
            ch_title = strip_md(chapter["title"])
        if section:
            sec_no = f"{ch_no}.{chapter['sections'].index(section) + 1:02d}"
            sec_title = strip_md(section["title"])
        rows.append({
            "条款编号": f"CS-{clause_seq:04d}",
            "章节编号": ch_no,
            "章节标题": ch_title,
            "小节编号": sec_no,
            "小节标题": sec_title,
            "类型": block_type,
            "内容": content,
            "关键时限/责任": extra,
        })

    for block in doc["blocks"]:
        if block["type"] == "table":
            for r in block["rows"]:
                content = "；".join(f"{h}：{v}" for h, v in zip(block["headers"], r) if v)
                add_row(None, None, "表格", content, time_tokens(content) or role_tokens(content))
        elif block["type"] == "paragraph":
            add_row(None, None, "正文", strip_md(block["text"]),
                    time_tokens(block["text"]) or role_tokens(block["text"]))
        elif block["type"] == "quote":
            add_row(None, None, "说明", strip_md(block["text"]),
                    time_tokens(block["text"]) or role_tokens(block["text"]))
        elif block["type"] == "list":
            for item in block["items"]:
                add_row(None, None, "清单", strip_md(item),
                        time_tokens(item) or role_tokens(item))

    for chapter in doc["chapters"]:
        for block in chapter["blocks"]:
            if block["type"] == "table":
                for r in block["rows"]:
                    content = "；".join(f"{h}：{v}" for h, v in zip(block["headers"], r) if v)
                    add_row(chapter, None, "表格", content,
                            time_tokens(content) or role_tokens(content))
            elif block["type"] == "paragraph":
                add_row(chapter, None, "正文", strip_md(block["text"]),
                        time_tokens(block["text"]) or role_tokens(block["text"]))
            elif block["type"] == "list":
                for item in block["items"]:
                    add_row(chapter, None, "清单", strip_md(item),
                            time_tokens(item) or role_tokens(item))
        for section in chapter["sections"]:
            for block in section["blocks"]:
                if block["type"] == "table":
                    for r in block["rows"]:
                        content = "；".join(
                            f"{h}：{v}" for h, v in zip(block["headers"], r) if v)
                        add_row(chapter, section, "表格", content,
                                time_tokens(content) or role_tokens(content))
                elif block["type"] == "paragraph":
                    add_row(chapter, section, "正文", strip_md(block["text"]),
                            time_tokens(block["text"]) or role_tokens(block["text"]))
                elif block["type"] == "list":
                    for item in block["items"]:
                        add_row(chapter, section, "清单", strip_md(item),
                                time_tokens(item) or role_tokens(item))
                elif block["type"] == "heading":
                    add_row(chapter, section, "标题", strip_md(block["text"]))

    with path.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


# --------------------------------------------------------------------------
# TXT
# --------------------------------------------------------------------------
def build_txt(doc: dict, path: Path) -> None:
    out: list[str] = []
    out.append(DOC_TITLE)
    out.append("=" * 40)
    out.append(f"文档编号：{DOC_CODE}    版本：{DOC_VERSION}    发布日期：{DOC_DATE}")
    out.append(f"编制部门：客服运营部")
    out.append("")

    def render(block):
        t = block["type"]
        if t == "paragraph":
            out.append(strip_md(block["text"]))
            out.append("")
        elif t == "list":
            for idx, item in enumerate(block["items"], 1):
                marker = f"{idx}. " if block["ordered"] else "- "
                out.append(marker + strip_md(item))
            out.append("")
        elif t == "table":
            def dw(s: str) -> int:
                return sum(2 if ord(ch) > 127 else 1 for ch in s)

            def pad(s: str, width: int) -> str:
                return s + " " * max(0, width - dw(s))

            widths = [max(dw(h), max((dw(r[i]) if i < len(r) else 0) for r in block["rows"]), 1)
                      for i, h in enumerate(block["headers"])]
            out.append(" | ".join(pad(h, widths[i]) for i, h in enumerate(block["headers"])))
            out.append("-+-".join("-" * widths[i] for i in range(len(widths))))
            for r in block["rows"]:
                cells = [(r[i] if i < len(r) else "") for i in range(len(widths))]
                out.append(" | ".join(pad(c, widths[i]) for i, c in enumerate(cells)))
            out.append("")
        elif t == "quote":
            out.append("说明：" + strip_md(block["text"]))
            out.append("")
        elif t == "heading":
            out.append(strip_md(block["text"]))
            out.append("")

    for block in doc["blocks"]:
        if block["type"] == "title":
            continue
        render(block)

    for chapter in doc["chapters"]:
        out.append("")
        out.append("=" * 40)
        out.append(strip_md(chapter["title"]))
        out.append("=" * 40)
        out.append("")
        for block in chapter["blocks"]:
            render(block)
        for section in chapter["sections"]:
            out.append("")
            out.append(strip_md(section["title"]))
            out.append("-" * len(section["title"]))
            out.append("")
            for block in section["blocks"]:
                render(block)

    path.write_text("\n".join(out).strip() + "\n", encoding="utf-8")


# --------------------------------------------------------------------------
# HTML
# --------------------------------------------------------------------------
def build_html(source: str, path: Path) -> None:
    text = source
    # insert TOC before the first chapter
    text = text.replace("\n## 第一章", "\n[TOC]\n\n## 第一章", 1)
    body = markdown.markdown(
        text,
        extensions=["tables", "toc", "sane_lists"],
        extension_configs={"toc": {"title": "目录", "toc_depth": "2-3"}},
    )
    # remove YAML-ish leading blank; keep as-is
    css = """
    :root { --ink:#1f2937; --muted:#5b6675; --line:#d7dee8; --brand:#0b4f7a; --accent:#0f766e; }
    * { box-sizing: border-box; }
    body { margin:0; background:#eef2f7; color:var(--ink);
           font-family:"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",sans-serif;
           font-size:15px; line-height:1.85; }
    .page { max-width: 960px; margin: 0 auto; background:#fff; padding: 48px 64px 72px;
            box-shadow: 0 8px 30px rgba(15,23,42,.08); }
    h1 { font-size: 30px; color: var(--brand); text-align:center; margin: 8px 0 6px;
         letter-spacing: 1px; }
    h1 + p { text-align:center; color: var(--muted); }
    h2 { font-size: 22px; color: var(--brand); border-bottom: 2px solid var(--brand);
         padding-bottom: 8px; margin-top: 44px; page-break-before: always; }
    h3 { font-size: 17px; color: #0f5e86; margin-top: 26px; border-left: 5px solid var(--accent);
         padding-left: 10px; }
    h4 { font-size: 15px; color: #14532d; margin-top: 20px; }
    p { margin: 8px 0; text-align: justify; }
    table { width:100%; border-collapse: collapse; margin: 14px 0 18px; font-size: 13.5px;
            page-break-inside: avoid; }
    th, td { border: 1px solid var(--line); padding: 7px 9px; vertical-align: top; }
    th { background: #e8f1f7; color: var(--brand); font-weight: 700; text-align:left; }
    tr:nth-child(even) td { background: #fafcfe; }
    ul, ol { margin: 8px 0 12px 24px; padding: 0; }
    li { margin: 4px 0; }
    blockquote { margin: 16px 0; padding: 12px 16px; background:#f0f7f6;
                 border-left: 4px solid var(--accent); color:#234; }
    hr { border:0; border-top:1px solid var(--line); margin: 28px 0; }
    code { background:#f1f5f9; padding:1px 5px; border-radius:4px; }
    .toc { background:#f7f9fc; border:1px solid var(--line); padding: 14px 22px; margin: 24px 0 8px; }
    .toc ul { list-style:none; margin-left: 6px; }
    .toc > ul > li { margin-top: 6px; font-weight: 600; }
    .toc ul ul { margin-left: 18px; font-weight: 400; }
    .toc a { color: var(--brand); text-decoration:none; }
    .meta { background:#0b4f7a; color:#fff; padding: 18px 22px; border-radius: 6px;
            margin: 18px 0 26px; font-size: 14px; }
    .meta span { display:inline-block; margin-right: 22px; }
    .doc-footer { margin-top: 48px; padding-top: 12px; border-top:1px solid var(--line);
                  color: var(--muted); font-size: 12.5px; text-align:center; }
    @media print {
      body { background:#fff; }
      .page { box-shadow:none; max-width:none; padding: 0; }
      h2 { page-break-before: always; }
      table { page-break-inside: avoid; }
    }
    """
    meta = f"""
    <div class="meta">
      <span><b>文档编号</b> {DOC_CODE}</span>
      <span><b>版本</b> {DOC_VERSION}</span>
      <span><b>发布日期</b> {DOC_DATE}</span>
      <span><b>编制</b> 客服运营部</span>
    </div>
    """
    # place meta after the h1
    idx = body.find("</h1>")
    if idx != -1:
        body = body[: idx + 5] + meta + body[idx + 5:]
    doc_html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{DOC_TITLE} {DOC_VERSION}</title>
<style>{css}</style>
</head>
<body>
<div class="page">
{body}
<div class="doc-footer">品胜科技 客服运营部 · {DOC_CODE} · {DOC_DATE}</div>
</div>
</body>
</html>
"""
    path.write_text(doc_html, encoding="utf-8")


# --------------------------------------------------------------------------
# PDF
# --------------------------------------------------------------------------
def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont(FONT, FONT_PATH, subfontIndex=0))
    pdfmetrics.registerFontFamily(FONT, normal=FONT, bold=FONT, italic=FONT, boldItalic=FONT)


def pdf_inline(text: str) -> str:
    s = html.escape(clean_inline(text), quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = s.replace("`", "")
    return s


def col_widths(headers: list[str], rows: list[list[str]], avail: float) -> list[float]:
    def disp_len(s: str) -> int:
        return sum(2 if ord(ch) > 127 else 1 for ch in s)

    n = len(headers)
    weights = []
    for i in range(n):
        vals = [disp_len(headers[i])] + [disp_len(r[i]) if i < len(r) else 0 for r in rows]
        weights.append(max(6, min(max(vals), 26)))
    total = sum(weights)
    widths = [avail * w / total for w in weights]
    # enforce a minimum readable width, then renormalize
    min_w = 42
    for _ in range(5):
        deficit = sum(max(0, min_w - w) for w in widths)
        if deficit <= 0:
            break
        flexible = [i for i, w in enumerate(widths) if w > min_w]
        excess = sum(widths[i] - min_w for i in flexible)
        if not flexible or excess <= 0:
            break
        for i in flexible:
            widths[i] -= deficit * (widths[i] - min_w) / excess
        widths = [max(w, min_w) for w in widths]
    scale = avail / sum(widths)
    return [w * scale for w in widths]


class GuideDoc(BaseDocTemplate):
    def __init__(self, filename: str, **kw):
        super().__init__(filename, pagesize=A4,
                         leftMargin=18 * mm, rightMargin=18 * mm,
                         topMargin=22 * mm, bottomMargin=20 * mm, **kw)
        frame = Frame(self.leftMargin, self.bottomMargin,
                      self.width, self.height, id="normal")
        self.addPageTemplates([
            PageTemplate(id="cover", frames=[frame], onPage=self.cover_page),
            PageTemplate(id="body", frames=[frame], onPage=self.body_page),
        ])
        self.collected: list[tuple[int, str, int]] = []

    def cover_page(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor("#0b4f7a"))
        canvas.rect(0, A4[1] - 16 * mm, A4[0], 16 * mm, stroke=0, fill=1)
        canvas.setFillColor(colors.HexColor("#0f766e"))
        canvas.rect(0, 0, A4[0], 8 * mm, stroke=0, fill=1)
        canvas.restoreState()

    def body_page(self, canvas, doc):
        canvas.saveState()
        canvas.setFont(FONT, 8.5)
        canvas.setFillColor(colors.HexColor("#5b6675"))
        canvas.drawString(18 * mm, A4[1] - 13 * mm, f"{DOC_TITLE}  {DOC_VERSION}")
        canvas.drawRightString(A4[0] - 18 * mm, A4[1] - 13 * mm, DOC_CODE)
        canvas.setStrokeColor(colors.HexColor("#d7dee8"))
        canvas.line(18 * mm, A4[1] - 15 * mm, A4[0] - 18 * mm, A4[1] - 15 * mm)
        canvas.drawString(18 * mm, 12 * mm, "内部受控文件 · 客服运营部")
        canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"第 {doc.page} 页")
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            style = flowable.style.name
            if style in {"H2", "H3"}:
                level = 0 if style == "H2" else 1
                self.collected.append((level, flowable.getPlainText(), self.page))


def build_pdf(doc: dict, path: Path) -> None:
    register_fonts()
    styles = getSampleStyleSheet()

    body = ParagraphStyle("Body", parent=styles["BodyText"], fontName=FONT,
                          fontSize=10.2, leading=16.5, alignment=TA_LEFT,
                          spaceAfter=5, wordWrap="CJK", textColor=colors.HexColor("#1f2937"))
    body_small = ParagraphStyle("BodySmall", parent=body, fontSize=9.2, leading=14)
    h1 = ParagraphStyle("H1", parent=styles["Title"], fontName=FONT, fontSize=27,
                        leading=36, alignment=TA_CENTER, textColor=colors.HexColor("#0b4f7a"),
                        spaceAfter=8, wordWrap="CJK")
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName=FONT, fontSize=17,
                        leading=23, textColor=colors.HexColor("#0b4f7a"),
                        spaceBefore=8, spaceAfter=9, keepWithNext=1, wordWrap="CJK")
    h3 = ParagraphStyle("H3", parent=styles["Heading3"], fontName=FONT, fontSize=12.8,
                        leading=18, textColor=colors.HexColor("#0f5e86"),
                        spaceBefore=11, spaceAfter=5, keepWithNext=1, wordWrap="CJK")
    h4 = ParagraphStyle("H4", parent=styles["Heading4"], fontName=FONT, fontSize=11,
                        leading=16, textColor=colors.HexColor("#14532d"),
                        spaceBefore=8, spaceAfter=4, keepWithNext=1, wordWrap="CJK")
    bullet = ParagraphStyle("Bullet", parent=body, leftIndent=14, bulletIndent=4,
                            spaceAfter=2)
    quote = ParagraphStyle("Quote", parent=body, leftIndent=12, rightIndent=8,
                           backColor=colors.HexColor("#f0f7f6"),
                           borderColor=colors.HexColor("#0f766e"), borderWidth=0.8,
                           borderPadding=6, spaceBefore=4, spaceAfter=8)
    small_center = ParagraphStyle("SmallCenter", parent=body, alignment=TA_CENTER,
                                  textColor=colors.HexColor("#5b6675"), fontSize=9.5)

    def add_table(headers, rows):
        data = [[Paragraph(pdf_inline(h), ParagraphStyle(
            "TH", parent=body_small, fontSize=8.2, leading=11, textColor=colors.HexColor("#0b4f7a")))
            for h in headers]]
        for r in rows:
            data.append([Paragraph(pdf_inline(c), ParagraphStyle(
                "TD", parent=body_small, fontSize=8.0, leading=11)) for c in
                (r + [""] * (len(headers) - len(r)))[:len(headers)]])
        widths = col_widths([strip_md(h) for h in headers],
                            [[strip_md(c) for c in r] for r in rows], 174 * mm)
        table = LongTable(data, colWidths=widths, repeatRows=1, hAlign="CENTER")
        style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8f1f7")),
            ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#c9d4e2")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ]
        for i in range(1, len(data)):
            if i % 2 == 0:
                style.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#fafcfe")))
        table.setStyle(TableStyle(style))
        return table

    toc_th = ParagraphStyle("TOCTh", parent=body_small, fontSize=9,
                            textColor=colors.HexColor("#0b4f7a"))
    toc1 = ParagraphStyle("TOC1", fontName=FONT, fontSize=10.5, leading=15,
                          textColor=colors.HexColor("#0b4f7a"), spaceBefore=2)
    toc2 = ParagraphStyle("TOC2", fontName=FONT, fontSize=9.2, leading=13,
                          leftIndent=12, textColor=colors.HexColor("#334155"))
    toc_page = ParagraphStyle("TOCPage", fontName=FONT, fontSize=9.2, leading=13,
                              alignment=2, textColor=colors.HexColor("#334155"))

    def toc_flowables(page_map: dict[str, str]):
        rows = [[Paragraph("章节", toc_th), Paragraph("页码", toc_th)]]
        for chapter in doc["chapters"]:
            title = strip_md(chapter["title"])
            rows.append([Paragraph(pdf_inline(title), toc1),
                         Paragraph(page_map.get(title, "—"), toc_page)])
            for section in chapter["sections"]:
                stitle = strip_md(section["title"])
                rows.append([Paragraph(pdf_inline(stitle), toc2),
                             Paragraph(page_map.get(stitle, "—"), toc_page)])
        table = Table(rows, colWidths=[150 * mm, 20 * mm], repeatRows=1)
        style = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 2.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
            ("LINEBELOW", (0, 0), (-1, 0), 0.8, colors.HexColor("#0b4f7a")),
            ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
            ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ]
        table.setStyle(TableStyle(style))
        return table

    def assemble(page_map: dict[str, str]):
        story: list = []
        story.append(Spacer(1, 26 * mm))
        story.append(Paragraph("品胜科技", ParagraphStyle(
            "brand", parent=small_center, fontSize=15, textColor=colors.HexColor("#0f766e"))))
        story.append(Spacer(1, 8 * mm))
        story.append(Paragraph("客服操作标准指引", h1))
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph("Customer Service Standard Operating Guide", small_center))
        story.append(Spacer(1, 16 * mm))
        cover_rows = [
            ["文档编号", DOC_CODE],
            ["版本", DOC_VERSION],
            ["发布日期", DOC_DATE],
            ["编制部门", "客服运营部"],
            ["替代文件", "客服操作手册 V3.0 / 售后故障处理指南 V2.1"],
            ["保密等级", "内部"],
        ]
        t = Table([[Paragraph(k, body_small), Paragraph(v, body_small)] for k, v in cover_rows],
                  colWidths=[34 * mm, 96 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8f1f7")),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#0b4f7a")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d7dee8")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        t.hAlign = "CENTER"
        story.append(t)
        story.append(Spacer(1, 14 * mm))
        story.append(Paragraph("本文件为内部受控文件，未经许可不得外传", small_center))

        story.append(NextPageTemplate("body"))
        story.append(PageBreak())

        story.append(Paragraph("目  录", ParagraphStyle(
            "TOCTitle", parent=h2, alignment=TA_CENTER, fontSize=18, spaceAfter=12)))
        story.append(toc_flowables(page_map))
        story.append(PageBreak())

        def render(block):
            t = block["type"]
            if t == "paragraph":
                story.append(Paragraph(pdf_inline(block["text"]), body))
            elif t == "list":
                for idx, item in enumerate(block["items"], 1):
                    marker = f"{idx}." if block["ordered"] else "•"
                    story.append(Paragraph(pdf_inline(item), bullet, bulletText=marker))
                story.append(Spacer(1, 2))
            elif t == "table":
                story.append(Spacer(1, 2))
                story.append(add_table(block["headers"], block["rows"]))
                story.append(Spacer(1, 5))
            elif t == "quote":
                story.append(Paragraph(pdf_inline(block["text"]), quote))
            elif t == "heading":
                lvl = block["level"]
                story.append(Paragraph(pdf_inline(block["text"]),
                                       h4 if lvl >= 4 else h3))

        first_chapter = True
        for chapter in doc["chapters"]:
            if not first_chapter:
                story.append(PageBreak())
            first_chapter = False
            story.append(Paragraph(pdf_inline(chapter["title"]), h2))
            story.append(Spacer(1, 1.5 * mm))
            for block in chapter["blocks"]:
                render(block)
            for section in chapter["sections"]:
                story.append(Paragraph(pdf_inline(section["title"]), h3))
                for block in section["blocks"]:
                    render(block)
        return story

    # Pass 1: collect real page numbers with placeholder TOC.
    tmp_path = path.with_suffix(".tocpass.pdf")
    pass1 = GuideDoc(str(tmp_path))
    pass1.multiBuild(assemble({}))
    page_map = {text: str(page) for _, text, page in pass1.collected}

    # Pass 2: identical layout, now with page numbers.
    final = GuideDoc(str(path))
    final.multiBuild(assemble(page_map))
    tmp_path.unlink(missing_ok=True)


# --------------------------------------------------------------------------
def main() -> int:
    source = SRC.read_text(encoding="utf-8")
    doc = parse_markdown(source)

    json_path = OUT / f"{BASE}.json"
    csv_path = OUT / f"{BASE}.csv"
    txt_path = OUT / f"{BASE}.txt"
    html_path = OUT / f"{BASE}.html"
    pdf_path = OUT / f"{BASE}.pdf"

    json_path.write_text(json.dumps(build_json(doc), ensure_ascii=False, indent=2),
                         encoding="utf-8")
    build_csv(doc, csv_path)
    build_txt(doc, txt_path)
    build_html(source, html_path)
    build_pdf(doc, pdf_path)

    for p in [SRC, pdf_path, csv_path, json_path, html_path, txt_path]:
        print(f"{p.name}: {p.stat().st_size:,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
