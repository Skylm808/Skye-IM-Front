const EVENT_NAME = 'skyeim:group_created';

export const emitGroupCreated = (payload) => {
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload || {} }));
  } catch {
    // ignore
  }
};

export const onGroupCreated = (cb) => {
  const handler = (event) => cb?.(event?.detail || {});
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};
