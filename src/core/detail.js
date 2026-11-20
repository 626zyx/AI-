/* 攻防明细抽屉的通用排版：模型演练与 Agent 演练共用同一套层级。
 * 同层级同呈现：模块标题 mod；字段名 + 短值 field；自然语言长文本 text（统一文本框）。
 * 结果标签 gtag（带边框底色：block 蓝 / pass 绿 / leak 红），过程标注 mtag（灰）。 */
import * as UI from './ui.js';

export const gtag = (r) => `<span class="gtag ${r.key}">${UI.esc(r.label)}</span>`;
export const mtag = (label, title = '') => `<span class="mtag"${title ? ` title="${UI.esc(title)}"` : ''}>${UI.esc(label)}</span>`;
export const field = (label, val) => `<div class="ud-field"><span class="ud-label">${UI.esc(label)}</span><div class="ud-val">${val}</div></div>`;
export const text = (label, s, emptyText = '（空）') => `<div class="ud-field"><span class="ud-label">${UI.esc(label)}</span>${
  s ? `<pre class="ud-text">${UI.esc(s)}</pre>` : `<div class="ud-text ud-placeholder">${UI.esc(emptyText)}</div>`}</div>`;
export const mod = (title, body) => `<section class="ud-mod"><h4 class="ud-mod-title">${UI.esc(title)}</h4>${body}</section>`;
/* 折叠条：收起时只显示标题与摘要，标记放在展开后的内容里 */
export const fold = (title, summary, body) => `<details class="ud-round"><summary><span class="ud-round-no">${UI.esc(title)}</span>
  <span class="ud-round-sum">${UI.esc(summary || '')}</span></summary><div class="ud-round-body">${body}</div></details>`;
