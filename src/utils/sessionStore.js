const STORAGE_KEY = 'skyeim:sessions:v1';
const EVENT_NAME = 'skyeim:sessions_updated';

export const loadSessionsMeta = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return {};
    return data;
  } catch {
    return {};
  }
};

export const saveSessionsMeta = (meta) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta || {}));
  } catch {
    // ignore
  }
};

export const emitSessionsUpdated = () => {
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // ignore
  }
};

export const updateSessionMeta = (sessionKey, patchOrUpdater) => {
  if (!sessionKey) return null;
  const meta = loadSessionsMeta();
  const prev = meta[sessionKey] || {};
  const next =
    typeof patchOrUpdater === 'function'
      ? patchOrUpdater(prev)
      : { ...prev, ...(patchOrUpdater || {}) };
  meta[sessionKey] = next;
  saveSessionsMeta(meta);
  emitSessionsUpdated();
  return next;
};

export const batchUpdateSessionMeta = (updates) => {
  if (!updates || Object.keys(updates).length === 0) return;
  const meta = loadSessionsMeta();
  
  Object.entries(updates).forEach(([sessionKey, patchOrUpdater]) => {
    const prev = meta[sessionKey] || {};
    const next =
      typeof patchOrUpdater === 'function'
        ? patchOrUpdater(prev)
        : { ...prev, ...(patchOrUpdater || {}) };
    meta[sessionKey] = next;
  });
  
  saveSessionsMeta(meta);
  emitSessionsUpdated();
};

export const onSessionsUpdated = (cb) => {
  const handler = () => cb(loadSessionsMeta());
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};

export const replaceSessionsMeta = (meta) => {
  saveSessionsMeta(meta || {});
  emitSessionsUpdated();
};

export const getFriendSessionKey = (friendId) => `f-${String(friendId)}`;
export const getGroupSessionKey = (groupId) => `g-${String(groupId)}`;
