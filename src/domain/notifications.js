/* Shared activity feed for connection, grading and task notifications. */
const messages = [];
const readIds = new Set();
const listeners = new Set();
export const notificationKey = message => message.id || `${message.type}|${message.at}|${message.title}`;
export const subscribeNotifications = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const notify = () => listeners.forEach(listener => listener());
export function pushNotification(message) {
  const record = { at: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 16), kind: 'all', meta: '', ...message };
  record.id ||= notificationKey(record);
  const existing = messages.findIndex(item => item.id === record.id);
  if (existing >= 0) messages.splice(existing, 1);
  messages.unshift(record);
  if (messages.length > 150) messages.length = 150;
  readIds.delete(record.id);
  notify();
  return record;
}
export const activityNotifications = () => messages.map(item => ({ ...item, read: readIds.has(notificationKey(item)) }));
export const isNotificationRead = item => readIds.has(notificationKey(item));
export function markNotificationsRead(items) { items.forEach(item => readIds.add(notificationKey(item))); notify(); }
