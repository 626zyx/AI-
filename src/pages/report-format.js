/* 报告列表的题目预览：统一截断长度，完整内容仍保留在提示与详情中。 */
import * as UI from '../core/ui.js';

export const REPORT_QUESTION_LIMIT = 66;

export function reportQuestionText(value) {
  const chars = Array.from(String(value ?? ''));
  return chars.length > REPORT_QUESTION_LIMIT
    ? `${chars.slice(0, REPORT_QUESTION_LIMIT).join('')}...`
    : chars.join('');
}

export const reportQuestionCell = (value) =>
  `<span class="clip-1" data-full="${UI.esc(value)}">${UI.esc(reportQuestionText(value))}</span>`;

/* One document structure for both report types; data and prose stay in presenters. */
export function reportSection(title, body, extra = '') {
  return `<section class="rr-section" data-report-title="${UI.esc(title)}"><header class="rr-section-heading"><h2 class="rr-section-title">${UI.esc(title)}</h2>${extra ? `<div class="rr-section-extra">${extra}</div>` : ''}</header><div class="rr-section-body">${body}</div></section>`;
}

export function reportDocument(sections) {
  const contents = [];
  const visibleSections = sections.filter(Boolean);
  const body = visibleSections.map((section, index) => {
    const id = `report-section-${index + 1}`;
    const number = String(index + 1).padStart(2, '0');
    const title = section.match(/data-report-title="([^"]*)"/)?.[1] || '';
    contents.push(`<li><button type="button" aria-controls="${id}"${index === 0 ? ' aria-current="location"' : ''} onclick="App.reportJump('${id}')"><span>${number}</span>${title}</button></li>`);
    return section.replace('<section class="rr-section"', `<section id="${id}" tabindex="-1" class="rr-section"`)
      .replace('<h2 class="rr-section-title">', `<h2 class="rr-section-title"><span class="rr-section-number" aria-hidden="true">${number}</span>`);
  }).join('');
  return `<article class="rr-analysis rr-document" aria-label="报告结果分析"><nav class="rr-document-index" style="grid-row:1 / span ${Math.max(1, visibleSections.length)}" aria-label="报告目录"><span>目录</span><ol>${contents.join('')}</ol></nav>${body}</article>`;
}

export function mountReportDocument(host) {
  const report = host?.querySelector('.rr-document');
  if (!report) return () => {};
  const scrollRoot = report.closest('.rr-report-scroll') || host;
  const sections = [...report.querySelectorAll('.rr-section')];
  const links = [...report.querySelectorAll('.rr-document-index button')];
  const update = () => {
    const readingTop = scrollRoot.getBoundingClientRect().top + 44;
    const atEnd = scrollRoot.scrollTop > 0 && scrollRoot.scrollHeight - scrollRoot.scrollTop - scrollRoot.clientHeight <= 2;
    const active = atEnd ? sections.at(-1) : sections.filter(section => section.getBoundingClientRect().top <= readingTop).at(-1) || sections[0];
    links.forEach(link => {
      if (link.getAttribute('aria-controls') === active?.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  scrollRoot.addEventListener('scroll', update, { passive: true });
  update();
  return () => scrollRoot.removeEventListener('scroll', update);
}

export const actions = {
  reportJump(id) {
    const section = document.getElementById(id);
    if (!section?.classList.contains('rr-section')) return;
    section.scrollIntoView({ behavior: 'auto', block: 'start' });
    section.focus({ preventScroll: true });
  },
};
