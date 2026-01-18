// Notification read status management
const STORAGE_KEY = 'notification_read_status';

export const loadReadStatus = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { friendSent: [], groupSent: [], joinSent: [] };
        const data = JSON.parse(raw);
        return {
            friendSent: Array.isArray(data.friendSent) ? data.friendSent : [],
            groupSent: Array.isArray(data.groupSent) ? data.groupSent : [],
            joinSent: Array.isArray(data.joinSent) ? data.joinSent : [],
        };
    } catch {
        return { friendSent: [], groupSent: [], joinSent: [] };
    }
};

export const saveReadStatus = (status) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
    } catch (e) {
        console.error('Failed to save notification read status', e);
    }
};

export const markAsRead = (type, ids) => {
    const current = loadReadStatus();
    const key = `${type}Sent`; // friendSent, groupSent, joinSent
    if (!current[key]) current[key] = [];

    const newIds = Array.isArray(ids) ? ids : [ids];
    const merged = [...new Set([...current[key], ...newIds])];
    current[key] = merged;

    saveReadStatus(current);
    return current;
};

export const isRead = (type, id) => {
    const status = loadReadStatus();
    const key = `${type}Sent`;
    return status[key] && status[key].includes(id);
};

export const clearReadStatus = (type) => {
    const current = loadReadStatus();
    const key = `${type}Sent`;
    current[key] = [];
    saveReadStatus(current);
};
