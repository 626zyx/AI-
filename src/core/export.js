/* 导出：Markdown 下载与打印为 PDF。模型演练与 Agent 演练的报告、明细共用。
 * PDF 由 Markdown 转成的简单 HTML 经浏览器打印生成；传入 html 时直接打印该 HTML（带站点样式）。 */
import * as UI from './ui.js';

export function mdToHtml(md) {
  const out = [];
  let code = false, buf = [], table = [];
  const flushTable = () => {
    if (!table.length) return;
    const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim());
    out.push(`<table><thead><tr>${cells(table[0]).map((c) => `<th>${UI.esc(c)}</th>`).join('')}</tr></thead><tbody>${table.slice(2)
      .map((r) => `<tr>${cells(r).map((c) => `<td>${UI.esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    table = [];
  };
  const inline = (s) => UI.esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  for (const line of md.split('\n')) {
    if (line.startsWith('```')) { if (code) { out.push(`<pre>${UI.esc(buf.join('\n'))}</pre>`); buf = []; } code = !code; continue; }
    if (code) { buf.push(line); continue; }
    if (line.startsWith('|')) { table.push(line); continue; }
    flushTable();
    const h = line.match(/^(#{1,3}) (.*)/);
    if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    else if (/^(- |\d+\. )/.test(line)) out.push(`<p class="li">${inline(line)}</p>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  flushTable();
  return out.join('\n');
}
export function printPdf(title, md, html) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => `<link rel="stylesheet" href="${l.href}">`).join('');
  const rich = html ? `${links}<style>body{background:#fff;margin:24px}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .card{break-inside:avoid;margin-bottom:16px}h1{font-size:20px;margin:0 0 16px}</style>` : '';
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${UI.esc(title)}</title>${rich}<style>
    body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#253449;font-size:12px;line-height:1.65;margin:24px}
    h1{font-size:20px}h2{font-size:15px;margin-top:22px;border-bottom:1px solid #e2e7ee;padding-bottom:4px}h3{font-size:13px;margin-top:16px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e7ee;padding:4px 8px;text-align:left}th{background:#f8fafc}
    pre{white-space:pre-wrap;background:#f8fafc;padding:8px;border-radius:4px;font-size:11px}.li{margin:2px 0}
  </style></head><body>${html || mdToHtml(md)}</body></html>`);
  d.close();
  setTimeout(() => {
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch { /* jsdom 无打印 */ }
    setTimeout(() => f.remove(), 1000);
  }, 50);
  UI.toast('已打开打印窗口，请选择「另存为 PDF」');
}
export function emit(name, md, fmt, html) {
  if (fmt === 'md') UI.download(`${name}.md`, md);
  else printPdf(name, md, html);
}
export const closePops = () => document.querySelectorAll('.pop').forEach((p) => (p.hidden = true));
export const fmtOf = (n) => document.querySelector(`input[name="${n}"]:checked`)?.value || 'pdf';
