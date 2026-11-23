#!/usr/bin/env python3
"""Build MD/PDF/CSV/JSON/HTML/TXT deliverables from the master Markdown guide."""
import csv
import html
import json
import os
import re
import sys

BASE = "/workspace/deliverables"
SRC = os.path.join(BASE, "客服操作标准指引_V1.0.md")
DOC_TITLE = "客服操作标准指引"
DOC_VERSION = "V1.0"
DOC_NO = "CS-GUIDE-2026-001"
DOC_DATE = "2026-11-13"

FONT_PATH = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"
FONT_BOLD_PATH = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"


# ---------------------------------------------------------------- parsing
def parse_markdown(text):
    lines = text.split("\n")
    doc = {"meta": {}, "chapters": [], "front": [], "tables": 0}
    chapter = None
    section = None
    subsection = None
    buffer = []
    front_holder = {"blocks": doc["front"]}

    def current():
        if subsection is not None:
            return subsection
        if section is not None:
            return section
        if chapter is not None:
            return chapter
        return front_holder

    def flush_para():
        nonlocal buffer
        if buffer:
            joined = " ".join(buffer).strip()
            if joined:
                current()["blocks"].append({"type": "paragraph", "text": joined})
            buffer = []

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            flush_para()
            i += 1
            continue

        if stripped.startswith("# "):
            doc["title"] = stripped[2:].strip()
            i += 1
            continue

        if stripped.startswith("## "):
            flush_para()
            title = stripped[3:].strip()
            chapter = {"title": title, "blocks": [], "sections": []}
            doc["chapters"].append(chapter)
            section = subsection = None
            i += 1
            continue

        if stripped.startswith("### "):
            flush_para()
            title = stripped[4:].strip()
            section = {"title": title, "blocks": [], "subsections": []}
            chapter["sections"].append(section)
            subsection = None
            i += 1
            continue

        if stripped.startswith("#### "):
            flush_para()
            title = stripped[5:].strip()
            subsection = {"title": title, "blocks": []}
            section["subsections"].append(subsection)
            i += 1
            continue

        if stripped == "---":
            flush_para()
            i += 1
            continue

        if stripped.startswith(">"):
            flush_para()
            current()["blocks"].append({"type": "quote", "text": stripped.lstrip("> ").strip()})
            i += 1
            continue

        if stripped.startswith("|"):
            flush_para()
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                raw = lines[i].strip().strip("|")
                cells = [c.strip() for c in raw.split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
                    rows.append(cells)
                i += 1
            if rows:
                width = max(len(r) for r in rows)
                rows = [r + [""] * (width - len(r)) for r in rows]
                current()["blocks"].append({"type": "table", "headers": rows[0], "rows": rows[1:]})
                doc["tables"] += 1
            continue

        m_ul = re.match(r"^[-*]\s+(.*)$", stripped)
        m_ol = re.match(r"^\d+\.\s+(.*)$", stripped)
        if m_ul or m_ol:
            flush_para()
            ordered = bool(m_ol)
            items = []
            while i < len(lines):
                s = lines[i].strip()
                mm = re.match(r"^[-*]\s+(.*)$", s) if not ordered else re.match(r"^\d+\.\s+(.*)$", s)
                if not mm:
                    break
                items.append(mm.group(1).strip())
                i += 1
            current()["blocks"].append({"type": "list", "ordered": ordered, "items": items})
            continue

        buffer.append(stripped)
        i += 1

    flush_para()
    doc["meta"] = {
        "title": DOC_TITLE,
        "document_no": DOC_NO,
        "version": DOC_VERSION,
        "date": DOC_DATE,
        "classification": "内部",
        "owner": "客服运营部",
        "chapters": len(doc["chapters"]),
        "tables": doc["tables"],
    }
    return doc


# ---------------------------------------------------------------- helpers
def inline_html(text):
    out = html.escape(text)
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"`(.+?)`", r"<code>\1</code>", out)
    out = re.sub(r"\[(.+?)\]\((.+?)\)", r'<a href="\2">\1</a>', out)
    return out


def plain(text):
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)
    text = re.sub(r"\[(.+?)\]\((.+?)\)", r"\1", text)
    return text


def iter_blocks(doc):
    """Yield (chapter, section_title, subsection_title, block) for every block."""
    for ch in doc["chapters"]:
        for b in ch["blocks"]:
            yield ch["title"], "", "", b
        for sec in ch["sections"]:
            for b in sec["blocks"]:
                yield ch["title"], sec["title"], "", b
            for sub in sec["subsections"]:
                for b in sub["blocks"]:
                    yield ch["title"], sec["title"], sub["title"], b


def blocks_of(container):
    out = list(container.get("blocks", []))
    for sub in container.get("subsections", []):
        out.extend(sub["blocks"])
    return out


# ---------------------------------------------------------------- JSON
def write_json(doc):
    payload = {
        "metadata": doc["meta"],
        "front": doc["front"],
        "chapters": [],
    }
    for ch in doc["chapters"]:
        node = {"title": ch["title"], "blocks": ch["blocks"], "sections": []}
        for sec in ch["sections"]:
            sec_node = {"title": sec["title"], "blocks": sec["blocks"], "subsections": []}
            for sub in sec["subsections"]:
                sec_node["subsections"].append({"title": sub["title"], "blocks": sub["blocks"]})
            node["sections"].append(sec_node)
        payload["chapters"].append(node)
    path = os.path.join(BASE, "客服操作标准指引_V1.0.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return path


# ---------------------------------------------------------------- CSV
def write_csv(doc):
    path = os.path.join(BASE, "客服操作标准指引_V1.0.csv")
    rows = []
    seq_global = 0
    for n, b in enumerate(doc["front"], 1):
        if b["type"] == "quote":
            rows.append(["文档概览", "", n, "提示", plain(b["text"])])
        elif b["type"] == "paragraph":
            rows.append(["文档概览", "", n, "段落", plain(b["text"])])
    for ch in doc["chapters"]:
        containers = [("", ch["blocks"])]
        for sec in ch["sections"]:
            containers.append((sec["title"], sec["blocks"]))
            for sub in sec["subsections"]:
                containers.append((f'{sec["title"]} / {sub["title"]}', sub["blocks"]))
        for sec_title, blocks in containers:
            seq = 0
            for b in blocks:
                if b["type"] == "paragraph":
                    seq += 1
                    rows.append([ch["title"], sec_title, seq, "段落", plain(b["text"])])
                elif b["type"] == "quote":
                    seq += 1
                    rows.append([ch["title"], sec_title, seq, "提示", plain(b["text"])])
                elif b["type"] == "list":
                    for item in b["items"]:
                        seq += 1
                        rows.append([ch["title"], sec_title, seq, "列表项", plain(item)])
                elif b["type"] == "table":
                    seq += 1
                    rows.append([ch["title"], sec_title, seq, "表头", " | ".join(b["headers"])])
                    for r in b["rows"]:
                        seq += 1
                        rows.append([ch["title"], sec_title, seq, "表格行", " | ".join(plain(c) for c in r)])
        seq_global += 1

    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        w.writerow(["章节", "小节", "条目序号", "条目类型", "内容"])
        w.writerows(rows)
    return path


# ---------------------------------------------------------------- TXT
NO_LINE_START = "，。、；：？！）〕》」』】”’%…·"


def tokenize(text):
    """Split into atomic tokens: ASCII runs stay unbroken, CJK goes char by char."""
    tokens, buf = [], ""
    for ch in text:
        if ch.isascii() and (ch.isalnum() or ch in "-_./:@%"):
            buf += ch
        else:
            if buf:
                tokens.append(buf)
                buf = ""
            tokens.append(ch)
    if buf:
        tokens.append(buf)
    return tokens


def disp_w(s):
    return sum(2 if ord(c) > 0x2E80 else 1 for c in s)


def wrap_cjk(text, width):
    """Wrap mixed CJK/latin text by display width (CJK counts 2), keeping words whole."""
    lines, cur = [], ""
    for tok in tokenize(text):
        w = disp_w(tok)
        if w > width:
            for ch in tok:
                lines.append(ch) if False else None
            # atomic token longer than a line: hard split
            if cur:
                lines.append(cur)
                cur = ""
            for i in range(0, len(tok), width):
                chunk = tok[i:i + width]
                if i + width < len(tok):
                    lines.append(chunk)
                else:
                    cur = chunk
            continue
        if disp_w(cur) + w > width and tok not in NO_LINE_START and cur:
            lines.append(cur)
            cur = tok
        else:
            cur += tok
    if cur:
        lines.append(cur)
    return lines or [""]


def write_txt(doc):
    path = os.path.join(BASE, "客服操作标准指引_V1.0.txt")
    W = 88
    out = []
    line = "=" * W
    out += [line, DOC_TITLE.center(W - (len(DOC_TITLE) * 2 - len(DOC_TITLE))), line, ""]
    out += [f"文档编号: {DOC_NO}    版本: {DOC_VERSION}    密级: 内部", f"编制: 客服运营部    编制日期: {DOC_DATE}", ""]

    def emit(text, indent=0, width=None):
        width = width or (W - indent)
        for ln in wrap_cjk(text, width):
            out.append(" " * indent + ln)

    for ch in doc["chapters"]:
        out += ["", "-" * W, ""]
        emit(ch["title"])
        out.append("")
        for sec in ch["sections"]:
            out += ["", f"【{sec['title']}】", ""]
            for sub in sec["subsections"]:
                out += ["", f"[{sub['title']}]", ""]
                for b in sub["blocks"]:
                    emit_block_txt(b, out, emit)
            for b in sec["blocks"]:
                emit_block_txt(b, out, emit)
        for b in ch["blocks"]:
            emit_block_txt(b, out, emit)

    out += ["", "-" * W, "", f"编制: 客服运营部  |  版本: {DOC_VERSION}  |  编制日期: {DOC_DATE}  |  密级: 内部", ""]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    return path


def emit_block_txt(b, out, emit):
    if b["type"] == "paragraph":
        emit(plain(b["text"]))
        out.append("")
    elif b["type"] == "quote":
        for ln in wrap_cjk(plain(b["text"]), 80):
            out.append("  > " + ln)
        out.append("")
    elif b["type"] == "list":
        for n, item in enumerate(b["items"], 1):
            prefix = f"{n}. " if b["ordered"] else "· "
            wrapped = wrap_cjk(plain(item), 82)
            out.append("  " + prefix + wrapped[0])
            for extra in wrapped[1:]:
                out.append(" " * (2 + len(prefix)) + extra)
        out.append("")
    elif b["type"] == "table":
        head = "[表头] " + " / ".join(plain(h) for h in b["headers"])
        for ln in wrap_cjk(head, 80):
            out.append("  " + ln)
        out.append("  " + "-" * 80)
        for r in b["rows"]:
            cells = " / ".join(plain(c) for c in r if c)
            wrapped = wrap_cjk(cells, 80)
            out.append("  - " + wrapped[0])
            for extra in wrapped[1:]:
                out.append("    " + extra)
        out.append("")


# ---------------------------------------------------------------- HTML
def write_html(doc):
    path = os.path.join(BASE, "客服操作标准指引_V1.0.html")
    toc = []
    body = []
    for idx, ch in enumerate(doc["chapters"], 1):
        cid = f"ch{idx}"
        toc.append(f'<li><a href="#{cid}">{html.escape(ch["title"])}</a>')
        if ch["sections"]:
            toc.append("<ul>")
            for n, sec in enumerate(ch["sections"], 1):
                sid = f"{cid}-{n}"
                toc.append(f'<li><a href="#{sid}">{html.escape(sec["title"])}</a></li>')
            toc.append("</ul>")
        toc.append("</li>")

        body.append(f'<section class="chapter" id="{cid}">')
        body.append(f"<h2>{html.escape(ch['title'])}</h2>")
        body.extend(render_blocks_html(ch["blocks"]))
        for n, sec in enumerate(ch["sections"], 1):
            body.append(f'<h3 id="{cid}-{n}">{html.escape(sec["title"])}</h3>')
            body.extend(render_blocks_html(sec["blocks"]))
            for sub in sec["subsections"]:
                body.append(f"<h4>{html.escape(sub['title'])}</h4>")
                body.extend(render_blocks_html(sub["blocks"]))
        body.append("</section>")

    lead = "".join(render_blocks_html(doc["front"]))
    lead = f'<div class="lead">{lead}</div>' if lead else ""
    css = """
.lead{max-width:920px;margin:22px auto 0;padding:14px 20px;background:#fff;border-left:4px solid #1f4e79;border-radius:6px;color:#4a5568;font-size:13.5px}
:root{--ink:#1d2430;--muted:#5b6678;--line:#d8dee8;--accent:#1f4e79;--bg:#f6f8fb;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
font-family:"Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei","PingFang SC","Droid Sans Fallback",sans-serif;
line-height:1.75;font-size:15px}
.cover{background:linear-gradient(135deg,#1f4e79,#2f6f9f);color:#fff;padding:56px 32px 40px;}
.cover .kicker{letter-spacing:.32em;font-size:12px;opacity:.8;text-transform:uppercase}
.cover h1{font-size:40px;margin:10px 0 6px;letter-spacing:.04em}
.cover .sub{font-size:15px;opacity:.9}
.cover .meta{margin-top:26px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px 18px;font-size:13px;opacity:.95}
.wrap{max-width:920px;margin:0 auto;padding:0 20px 60px}
.toc{background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px 26px;margin:26px auto;max-width:920px}
.toc h2{margin:6px 0 12px;font-size:16px;color:var(--accent);border:0;padding:0}
.toc ul{list-style:none;padding-left:0;margin:0}
.toc ul ul{padding-left:18px;margin:2px 0 8px}
.toc li{margin:3px 0;font-size:14px}
.toc a{color:var(--ink);text-decoration:none;border-bottom:1px dotted #b9c3d2}
.toc a:hover{color:var(--accent)}
section.chapter{background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 28px 24px;margin:18px auto;max-width:920px}
h2{font-size:24px;color:var(--accent);border-bottom:3px solid var(--accent);padding-bottom:8px;margin:22px 0 16px}
h3{font-size:18px;margin:24px 0 10px;padding-left:10px;border-left:4px solid var(--accent)}
h4{font-size:15px;margin:18px 0 8px;color:#2f6f9f}
p{margin:8px 0}
ul,ol{margin:8px 0 8px 4px;padding-left:22px}
li{margin:4px 0}
blockquote{margin:14px 0;padding:10px 16px;background:#eef4fa;border-left:4px solid var(--accent);color:var(--muted);font-size:14px}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
th,td{border:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#eaf1f8;color:#17395c;font-weight:600}
tr:nth-child(even) td{background:#fbfcfe}
code{background:#f0f2f6;padding:1px 5px;border-radius:3px;font-size:13px}
.footer{max-width:920px;margin:30px auto;color:var(--muted);font-size:12px;text-align:center}
@media print{body{background:#fff}section.chapter,.toc{border:0;padding:0;margin:0}.cover{page-break-after:always}}
"""

    doc_html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(DOC_TITLE)} {DOC_VERSION}</title>
<style>{css}</style>
</head>
<body>
<header class="cover">
  <div class="kicker">Pinsheng Technology · Customer Service Operations</div>
  <h1>{html.escape(DOC_TITLE)}</h1>
  <div class="sub">客服运营部统一执行口径 · 取代《客服操作手册V3.0》与《售后故障处理指南V2.1》单行版本</div>
  <div class="meta">
    <div>文档编号：{DOC_NO}</div><div>版本：{DOC_VERSION}</div>
    <div>编制日期：{DOC_DATE}</div><div>密级：内部</div>
    <div>编制：客服运营部</div><div>适用范围：客服运营部及协作部门</div>
  </div>
</header>
<div class="wrap">
{lead}
<nav class="toc"><h2>目录</h2><ul>{''.join(toc)}</ul></nav>
{''.join(body)}
<div class="footer">编制：客服运营部 ｜ 版本 {DOC_VERSION} ｜ {DOC_DATE} ｜ 密级：内部，仅限公司员工访问</div>
</div>
</body>
</html>
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(doc_html)
    return path


def render_blocks_html(blocks):
    out = []
    for b in blocks:
        if b["type"] == "paragraph":
            out.append(f"<p>{inline_html(b['text'])}</p>")
        elif b["type"] == "quote":
            out.append(f"<blockquote>{inline_html(b['text'])}</blockquote>")
        elif b["type"] == "list":
            tag = "ol" if b["ordered"] else "ul"
            items = "".join(f"<li>{inline_html(i)}</li>" for i in b["items"])
            out.append(f"<{tag}>{items}</{tag}>")
        elif b["type"] == "table":
            head = "".join(f"<th>{inline_html(h)}</th>" for h in b["headers"])
            body = "".join(
                "<tr>" + "".join(f"<td>{inline_html(c)}</td>" for c in r) + "</tr>" for r in b["rows"]
            )
            out.append(f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>")
    return out


# ---------------------------------------------------------------- PDF
def write_pdf(doc):
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import (BaseDocTemplate, Frame, NextPageTemplate, PageBreak,
                                    PageTemplate, Paragraph, Spacer)
    from reportlab.platypus.tableofcontents import TableOfContents

    if not os.path.exists(FONT_PATH):
        raise SystemExit(f"font missing: {FONT_PATH}")
    pdfmetrics.registerFont(TTFont("CJK", FONT_PATH, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("CJK-Bold", FONT_BOLD_PATH, subfontIndex=0))
    pdfmetrics.registerFontFamily("CJK", normal="CJK", bold="CJK-Bold", italic="CJK", boldItalic="CJK-Bold")

    accent = colors.HexColor("#1F4E79")
    ink = colors.HexColor("#1D2430")
    line = colors.HexColor("#C9D2DF")

    body = ParagraphStyle("body", fontName="CJK", fontSize=10, leading=16.5, textColor=ink,
                          alignment=TA_LEFT, spaceAfter=4, wordWrap="CJK")
    h2 = ParagraphStyle("h2", fontName="CJK-Bold", fontSize=16.5, leading=22, textColor=accent,
                        spaceBefore=15, spaceAfter=9, wordWrap="CJK")
    h3 = ParagraphStyle("h3", fontName="CJK-Bold", fontSize=12.5, leading=18, textColor=accent,
                        spaceBefore=11, spaceAfter=5, wordWrap="CJK")
    h4 = ParagraphStyle("h4", fontName="CJK-Bold", fontSize=10.8, leading=16,
                        textColor=colors.HexColor("#2F6F9F"),
                        spaceBefore=8, spaceAfter=3, wordWrap="CJK")
    quote = ParagraphStyle("quote", parent=body, textColor=colors.HexColor("#4A5568"),
                           leftIndent=10, fontSize=9.2, leading=14)
    cell = ParagraphStyle("cell", fontName="CJK", fontSize=8.2, leading=12, textColor=ink, wordWrap="CJK")
    cell_head = ParagraphStyle("cell_head", parent=cell, textColor=colors.HexColor("#17395C"))
    title_st = ParagraphStyle("title", fontName="CJK-Bold", fontSize=31, leading=40,
                              textColor=colors.white, wordWrap="CJK")
    sub_st = ParagraphStyle("sub", fontName="CJK", fontSize=10.5, leading=17,
                            textColor=colors.HexColor("#D5E3F0"), wordWrap="CJK")

    class GuideDoc(BaseDocTemplate):
        def __init__(self, *a, **kw):
            self._toc_seq = 0
            BaseDocTemplate.__init__(self, *a, **kw)

        def _startBuild(self, filename=None, canvasmaker=None):
            self._toc_seq = 0
            if canvasmaker is None:
                BaseDocTemplate._startBuild(self, filename)
            else:
                BaseDocTemplate._startBuild(self, filename, canvasmaker)

        def afterFlowable(self, flowable):
            if isinstance(flowable, Paragraph) and flowable.style.name in ("h2", "h3"):
                level = 0 if flowable.style.name == "h2" else 1
                self._toc_seq += 1
                key = f"toc{self._toc_seq}"
                text = flowable.getPlainText()
                self.canv.bookmarkPage(key)
                self.canv.addOutlineEntry(text, key, level=level, closed=False)
                self.notify("TOCEntry", (level, text, self.page, key))

    path = os.path.join(BASE, "客服操作标准指引_V1.0.pdf")
    margin = 2.0 * cm
    frame = Frame(margin, margin + 0.7 * cm, A4[0] - 2 * margin, A4[1] - 2 * margin - 1.5 * cm, id="f")

    def on_page(canv, d):
        canv.saveState()
        canv.setStrokeColor(line)
        canv.setLineWidth(0.6)
        canv.line(margin, A4[1] - margin + 0.25 * cm, A4[0] - margin, A4[1] - margin + 0.25 * cm)
        canv.setFont("CJK", 7.5)
        canv.setFillColor(colors.HexColor("#6B7789"))
        canv.drawString(margin, A4[1] - margin + 0.5 * cm,
                        f"{DOC_TITLE}  {DOC_VERSION}   |   {DOC_NO}")
        canv.drawRightString(A4[0] - margin, A4[1] - margin + 0.5 * cm, "密级：内部")
        canv.line(margin, margin + 0.4 * cm, A4[0] - margin, margin + 0.4 * cm)
        canv.drawString(margin, margin + 0.1 * cm, "编制：客服运营部")
        canv.drawRightString(A4[0] - margin, margin + 0.1 * cm, f"第 {d.page} 页")
        canv.restoreState()

    def on_cover(canv, d):
        canv.saveState()
        canv.setFillColor(accent)
        canv.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
        canv.setStrokeColor(colors.HexColor("#5B93BC"))
        canv.setLineWidth(1.2)
        canv.line(2.4 * cm, A4[1] * 0.402, A4[0] - 2.4 * cm, A4[1] * 0.402)
        canv.restoreState()

    docm = GuideDoc(path, pagesize=A4, leftMargin=margin, rightMargin=margin,
                    topMargin=margin, bottomMargin=margin,
                    title=f"{DOC_TITLE} {DOC_VERSION}", author="客服运营部",
                    subject="客服操作标准指引", creator="客服运营部")
    cover_frame = Frame(2.4 * cm, 2.4 * cm, A4[0] - 4.8 * cm, A4[1] - 5.2 * cm, id="cover")
    docm.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=on_cover),
        PageTemplate(id="main", frames=[frame], onPage=on_page),
    ])

    toc0 = ParagraphStyle("toc0", fontName="CJK-Bold", fontSize=10.5, leading=17.5, textColor=accent,
                          spaceBefore=4, wordWrap="CJK")
    toc1 = ParagraphStyle("toc1", fontName="CJK", fontSize=9, leading=13.2, leftIndent=15,
                          textColor=ink, wordWrap="CJK")
    toc = TableOfContents()
    toc.levelStyles = [toc0, toc1]
    toc.dotsMinLevel = 0
    toc.tableStyle = None

    flow = []
    flow += [Spacer(1, 5.0 * cm),
             Paragraph("PINSHENG TECHNOLOGY", ParagraphStyle("k", fontName="CJK", fontSize=8.5,
                                                             textColor=colors.HexColor("#BFD6E8"),
                                                             charSpace=2.4)),
             Spacer(1, 0.42 * cm),
             Paragraph(DOC_TITLE, title_st),
             Spacer(1, 0.4 * cm),
             Paragraph("Customer Service Operations Standard Guide", sub_st),
             Spacer(1, 1.35 * cm),
             Paragraph(f"文档编号 {DOC_NO}    |    版本 {DOC_VERSION}    |    密级：内部", sub_st),
             Paragraph(f"编制：客服运营部    |    编制日期：{DOC_DATE}", sub_st),
             Spacer(1, 0.35 * cm),
             Paragraph("本指引整合《客服操作手册 V3.0》与《售后故障处理指南 V2.1》，"
                       "并纳入 SOP、FAQ、话术脚本、升级矩阵、合规与产品规格文件，"
                       "作为客服运营部统一执行口径。", sub_st),
             NextPageTemplate("main"), PageBreak()]

    flow.append(Paragraph("目　录", ParagraphStyle("tocTitle", parent=h2, spaceBefore=0)))
    flow.append(Spacer(1, 0.2 * cm))
    flow.append(toc)
    flow.append(PageBreak())

    flow.extend(blocks_pdf(doc["front"], body, quote, cell, cell_head, inline_html, cm, line))

    for ch in doc["chapters"]:
        flow.append(Paragraph(inline_html(ch["title"]), h2))
        flow.extend(blocks_pdf(ch["blocks"], body, quote, cell, cell_head, inline_html, cm, line))
        for sec in ch["sections"]:
            flow.append(Paragraph(inline_html(sec["title"]), h3))
            flow.extend(blocks_pdf(sec["blocks"], body, quote, cell, cell_head, inline_html, cm, line))
            for sub in sec["subsections"]:
                flow.append(Paragraph(inline_html(sub["title"]), h4))
                flow.extend(blocks_pdf(sub["blocks"], body, quote, cell, cell_head, inline_html, cm, line))

    flow.append(Spacer(1, 0.6 * cm))
    flow.append(Paragraph("— 文档结束 —", ParagraphStyle("end", fontName="CJK", fontSize=9,
                                                         textColor=colors.HexColor("#6B7789"),
                                                         alignment=1)))
    docm.multiBuild(flow)
    return path


def blocks_pdf(blocks, body, quote, cell, cell_head, inline_html, cm, line):
    from reportlab.lib import colors
    from reportlab.platypus import ListFlowable, ListItem, Paragraph, Spacer, Table, TableStyle

    out = []
    for b in blocks:
        if b["type"] == "paragraph":
            out.append(Paragraph(inline_html(b["text"]), body))
        elif b["type"] == "quote":
            out.append(Spacer(1, 2))
            out.append(Paragraph(inline_html(b["text"]), quote))
            out.append(Spacer(1, 2))
        elif b["type"] == "list":
            items = [ListItem(Paragraph(inline_html(i), body), leftIndent=12) for i in b["items"]]
            out.append(ListFlowable(items, bulletType="1" if b["ordered"] else "bullet",
                                    start="1" if b["ordered"] else None,
                                    bulletFontName="CJK", bulletFontSize=9,
                                    leftIndent=14, bulletOffsetY=-1, spaceAfter=4))
        elif b["type"] == "table":
            out.append(Spacer(1, 3))
            out.append(make_table(b, cell, cell_head, inline_html, cm, line, colors, Table, TableStyle))
            out.append(Spacer(1, 5))
    return out


def make_table(b, cell, cell_head, inline_html, cm, line, colors, Table, TableStyle):
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Paragraph

    ncol = len(b["headers"])
    fs = 8.2 if ncol <= 4 else (7.8 if ncol <= 6 else 7.2)
    cstyle = ParagraphStyle(f"cell{ncol}", parent=cell, fontSize=fs, leading=fs * 1.45)
    hstyle = ParagraphStyle(f"head{ncol}", parent=cell_head, fontSize=fs, leading=fs * 1.45)

    data = [[Paragraph(inline_html(h), hstyle) for h in b["headers"]]]
    for r in b["rows"]:
        data.append([Paragraph(inline_html(c), cstyle) for c in r])

    raw = []
    for c in range(ncol):
        lens = [len(b["headers"][c])] + [len(r[c]) for r in b["rows"]]
        raw.append(max(2.5, min(40.0, max(lens)) ** 1.25))
    total = 17.0
    floor = 1.3 if ncol > 4 else 2.6
    if floor * ncol >= total:
        widths = [total / ncol] * ncol
    else:
        spare = total - floor * ncol
        ssum = sum(raw)
        widths = [(floor + spare * (w / ssum)) * cm for w in raw]

    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8F0F8")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#17395C")),
        ("GRID", (0, 0), (-1, -1), 0.45, line),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFCFE")]),
    ]))
    return t


def main():
    with open(SRC, encoding="utf-8") as f:
        text = f.read()
    doc = parse_markdown(text)
    if not doc["chapters"]:
        raise SystemExit("no chapters parsed")
    paths = [write_json(doc), write_csv(doc), write_txt(doc), write_html(doc), write_pdf(doc)]
    print(f"chapters={len(doc['chapters'])} tables={doc['tables']} blocks={sum(1 for _ in iter_blocks(doc))}")
    for p in paths:
        print(f"{os.path.getsize(p):>9} bytes  {p}")


if __name__ == "__main__":
    sys.exit(main())
