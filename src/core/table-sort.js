/* Multi-column list sorting. Missing values stay last in either direction. */
export const sortDirection = (view, key) => view.sortKey === key ? (view.sortDesc ? 'descending' : 'ascending') : 'none';

export function toggleSort(view, key) {
  view.sortDesc = view.sortKey === key ? !view.sortDesc : true;
  view.sortKey = key;
}

export function compareValues(a, b, descending = true) {
  const missing = value => value === null || value === undefined || value === '' || value === '—';
  if (missing(a) || missing(b)) return Number(missing(a)) - Number(missing(b));
  const result = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
  return descending ? -result : result;
}
