const STORAGE_KEY = 'skyeim:group_events:v1';
const EVENT_NAME = 'skyeim:group_events_updated';
const MAX_EVENTS = 100;

const toArray = (raw) => {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const loadGroupEvents = () => {
  return toArray(localStorage.getItem(STORAGE_KEY));
};

const saveGroupEvents = (list) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // ignore
  }
};

export const addGroupEvent = (event) => {
  const list = loadGroupEvents();
  const createdAt = Number(event?.createdAt) || Math.floor(Date.now() / 1000);
  const id = String(event?.id || `${event?.groupId || 'group'}-${event?.eventType || 'event'}-${createdAt}`);
  const entry = {
    ...event,
    id,
    createdAt,
    read: false,
  };
  const next = [entry, ...list].slice(0, MAX_EVENTS);
  saveGroupEvents(next);
  return entry;
};

export const markGroupEventsRead = (ids) => {
  const list = loadGroupEvents();
  const idSet = Array.isArray(ids) ? new Set(ids.map((id) => String(id))) : null;
  const next = list.map((item) => {
    if (!idSet) return { ...item, read: true };
    if (idSet.has(String(item.id))) return { ...item, read: true };
    return item;
  });
  saveGroupEvents(next);
  return next;
};

export const getUnreadGroupEventCount = () => {
  return loadGroupEvents().filter((item) => !item?.read).length;
};

export const onGroupEventsUpdated = (cb) => {
  const handler = () => cb(loadGroupEvents());
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};
