/* 全站唯一图标表。新增图标只在此处加。 */
/* Business glyphs keep wide gaps and few strokes at the 16 px navigation size. */
const P = {
  grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  shield: 'M12 3 4.5 6v5c0 4.8 3 8.2 7.5 10 4.5-1.8 7.5-5.2 7.5-10V6L12 3Z',
  task: 'M5 4h14v16H5V4ZM9 9h6m-6 6h6',
  gauge: 'M4 19a9 9 0 1 1 16 0H4ZM12 14l5-6',
  assets: 'M3 3h11v11H3V3Zm7 11v7h11V10h-7',
  tag: 'M3 4h8l10 9-8 8L3 11V4Z',
  levels: 'M4 5h16M4 12h11M4 19h6',
  network: 'M3 5h6v6H3V5Zm12 8h6v6h-6v-6ZM9 8h3v8h3',
  agent: 'M5 7h14v12H5V7ZM12 3v4M9 11v3m6-3v3',
  layers: 'm12 4 9 5-9 5-9-5 9-5Zm-9 11 9 5 9-5',
  box: 'M12 3 3 7.5v9L12 21l9-4.5v-9L12 3ZM3 7.5l9 4.5 9-4.5M12 12v9',
  alert: 'm12 3 10 18H2L12 3Zm0 6v5m0 3v1',
  file: 'M14 3H5v18h14V8l-5-5Zm0 0v5h5M9 15h6',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm5.5-2 5 5',
  plus: 'M12 5v14M5 12h14',
  edit: 'm15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6 5-2',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  /* 返回：直角拐弯箭头（自下而上再折向左） */
  back: 'M9 14 4 9l5-5M4 9h16v11',
  first: 'm11 17-5-5 5-5m7 10-5-5 5-5',
  last: 'm13 17 5-5-5-5M6 17l5-5-5-5',
  prev: 'm15 18-6-6 6-6',
  next: 'm9 18 6-6-6-6',
  chevronDown: 'm6 9 6 6 6-6',
  chevronRight: 'm9 5 7 7-7 7',
  arrowUpDown: 'M7 4v16m0-16-3 3m3-3 3 3M17 20V4m0 16 3-3m-3 3-3-3',
  settings: 'M4 7h4m6 0h6M4 17h10M8 4h6v6H8V4Zm6 10h6v6h-6v-6Z',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  bell: 'M5 16h14l-2-4V8a5 5 0 0 0-10 0v4l-2 4Zm5 4h4',
  book: 'M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15',
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94L14.7 6.3Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-1.5c0-2.8 3.6-4.5 8-4.5s8 1.7 8 4.5V21',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  refresh: 'M3 12a9 9 0 0 1 15.4-6.4L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.4 6.4L3 16M3 21v-5h5',
  swapHorizontal: 'M21 9H3l5-5M3 15h18l-5 5',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  play: 'm8 4 12 8-12 8V4Z',
  panel: 'M3 4h18v16H3V4Zm6 0v16',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  cpu: 'M6 6h12v12H6V6ZM12 3v3m0 12v3M3 12h3m12 0h3',
  logout: 'M9 3H3v18h6M9 12h12m-5-5 5 5-5 5',
  /* 任务状态：全站唯一一套，列表与详情共用 */
  stDone: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-4-9 3 3 5-5',
  stRunning: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  stStopped: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12h8',
  stError: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-9v4m0-7v1',
};

export function icon(name, size = 16) {
  const d = P[name] || P.shield;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
}
