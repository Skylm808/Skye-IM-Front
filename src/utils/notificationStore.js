const STORAGE_KEY = 'skyeim:notifications:v1';
const EVENT_NAME = 'skyeim:notifications_updated';

export const loadNotificationCounts = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { friend: 0, group: 0, joinReceived: 0 };
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return { friend: 0, group: 0, joinReceived: 0 };
    return {
      friend: Number(data.friend) || 0,
      group: Number(data.group) || 0,
      joinReceived: Number(data.joinReceived) || 0,
    };
  } catch {
    return { friend: 0, group: 0, joinReceived: 0 };
  }
};

export const updateNotificationCounts = (next) => {
  try {
    const value = {
      friend: Number(next?.friend) || 0,
      group: Number(next?.group) || 0,
      joinReceived: Number(next?.joinReceived) || 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // ignore
  }
};

export const onNotificationsUpdated = (cb) => {
  const handler = () => cb(loadNotificationCounts());
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};
