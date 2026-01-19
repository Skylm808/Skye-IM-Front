import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Spin, Result, Button, Tooltip, Badge, message } from 'antd';
import {
  LogoutOutlined,
  MessageOutlined,
  RocketOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  BellOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { getProfile } from '../api/user';
import { messageApi } from '../api/message';
import { friendApi } from '../api/friend';
import { groupApi } from '../api/group';
import { wsClient } from '../utils/websocket';
import { getFriendSessionKey, getGroupSessionKey, updateSessionMeta, replaceSessionsMeta, onSessionsUpdated, loadSessionsMeta } from '../utils/sessionStore';
import { loadNotificationCounts, onNotificationsUpdated, updateNotificationCounts } from '../utils/notificationStore';
import { addGroupEvent, getUnreadGroupEventCount } from '../utils/groupEventStore';
import { loadReadStatus } from '../utils/notificationReadStore';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const pickSelectedKey = (pathname) => {
  if (pathname.startsWith('/profile')) return '/profile';
  if (pathname.startsWith('/chat')) return '/chat';
  if (pathname.startsWith('/contacts')) return '/contacts';
  if (pathname.startsWith('/user-search')) return '/user-search';
  if (pathname.startsWith('/friends/requests')) return '/friends/requests';
  if (pathname.startsWith('/friends')) return '/contacts'; // Fallback for other friend routes if any, or map to contacts
  return '/';
};

const normalizeUser = (data) => (data && data.user ? data.user : data);

const normalizeGroupList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.data?.list)) return res.data.list;
  return [];
};

const extractGroupId = (group) =>
  group?.groupId ?? group?.groupID ?? group?.group_id ?? group?.id ?? group?.groupIdStr;

const resolveGroupRole = (info, currentUserId) => {
  const rawRole = info?.role ?? info?.myRole ?? info?.memberRole ?? info?.userRole;
  const role = Number(rawRole);
  if (Number.isFinite(role)) return role;
  if (info?.isOwner) return 1;
  if (info?.isAdmin) return 2;
  const ownerId = info?.ownerId ?? info?.owner_id ?? info?.owner;
  if (ownerId != null && currentUserId != null && String(ownerId) === String(currentUserId)) return 1;
  return null;
};

const MainLayout = ({ pageTitle, children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState(wsClient.isConnected ? 'connected' : 'disconnected');

  // Persist collapsed state
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('skyeim_sider_collapsed') === 'true';
  });

  // Badges
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [notificationCount, setNotificationCount] = useState(() => {
    const counts = loadNotificationCounts();
    return (counts.friend || 0) + (counts.group || 0) + (counts.joinReceived || 0) + (counts.groupEvent || 0);
  });

  const userRef = useRef(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const pendingDisconnectRef = useRef(null);
  const startupTimeRef = useRef(Date.now() / 1000);
  const privateOfflineIgnoreRef = useRef(0);
  const groupOfflineIgnoreRef = useRef(0);
  const offlineReceivedRef = useRef(false);
  const offlineFallbackTimerRef = useRef(null);
  const offlineFetchInFlightRef = useRef(false);
  const seenMsgIdsRef = useRef(new Set());
  const seenMsgQueueRef = useRef([]);
  const lastUserIdRef = useRef(null);
  const groupSyncInFlightRef = useRef(false);
  const groupSyncTimerRef = useRef(null);
  const offlineSyncRequestedRef = useRef({ private: false, group: false });
  const groupRoleCacheRef = useRef(new Map());

  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = useMemo(() => pickSelectedKey(location.pathname), [location.pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('skyeim_sider_collapsed', String(next));
  };

  const getNotificationTotal = (counts) =>
    (counts.friend || 0) + (counts.group || 0) + (counts.joinReceived || 0) + (counts.groupEvent || 0);

  const updateNotificationTotal = (updater) => {
    const current = loadNotificationCounts();
    const next =
      typeof updater === 'function'
        ? updater(current)
        : { ...current, ...(updater || {}) };
    updateNotificationCounts(next);
    setNotificationCount(getNotificationTotal(next));
    return next;
  };

  const cacheGroupRole = (groupId, role) => {
    if (groupId == null || role == null) return;
    groupRoleCacheRef.current.set(String(groupId), role);
  };

  const getCachedGroupRole = (groupId) => {
    if (groupId == null) return null;
    return groupRoleCacheRef.current.get(String(groupId));
  };

  const fetchGroupRole = async (groupId) => {
    if (!groupId) return null;
    const cached = getCachedGroupRole(groupId);
    if (cached != null) return cached;
    try {
      const res = await groupApi.getDetails(groupId);
      const info = res?.group || res?.data || res;
      const role = resolveGroupRole(info, user?.id);
      if (role != null) cacheGroupRole(groupId, role);
      return role;
    } catch (e) {
      console.warn('Fetch group role failed', groupId, e);
      return null;
    }
  };

  const isGroupManager = async (groupId) => {
    const role = await fetchGroupRole(groupId);
    return role === 1 || role === 2;
  };

  const normalizeGroupEvent = (msg) => {
    const rawType = msg?.type;
    let eventType = msg?.eventType || msg?.data?.eventType;
    let eventData = msg?.eventData || msg?.data?.eventData || msg?.data || {};
    if (!eventType) {
      if (rawType === 'group_join') eventType = 'joinGroup';
      if (rawType === 'group_leave') eventType = 'quitGroup';
      if (rawType === 'group_dismiss') eventType = 'dismissGroup';
      if (
        rawType === 'dismissGroup' ||
        rawType === 'kickMember' ||
        rawType === 'quitGroup' ||
        rawType === 'joinGroup'
      ) {
        eventType = rawType;
      }
    }
    if (!eventData || typeof eventData !== 'object') eventData = {};
    return { eventType, eventData };
  };

  const handleGroupEventNotification = async (msg) => {
    const { eventType, eventData } = normalizeGroupEvent(msg);
    if (!eventType) return;

    const groupId = eventData?.groupId || msg?.data?.groupId || msg?.groupId;
    const memberId = eventData?.memberId ?? eventData?.userId;
    const currentUser = userRef.current;
    const isSelf = memberId != null && currentUser?.id != null && String(memberId) === String(currentUser.id);

    if (eventType !== 'dismissGroup') {
      const manager = await isGroupManager(groupId);
      if (!manager && !isSelf) return;
    }

    let groupName = groupId;
    let groupAvatar = null;
    try {
      if (groupId) {
        const res = await groupApi.getDetails(groupId);
        const info = res?.group || res?.data || res;
        if (info?.name) groupName = info.name;
        if (info?.avatar) groupAvatar = info.avatar;
      }
    } catch (e) {
      console.warn('Failed to fetch group details for notification', e);
    }

    const groupLabel = groupName && groupName !== groupId ? groupName : (groupId ? `群聊 ${groupId}` : '群聊');

    if (eventType === 'dismissGroup') {
      message.warning(`${groupLabel} 已解散`);
      if (groupId) groupRoleCacheRef.current.delete(String(groupId));
    } else if (eventType === 'kickMember') {
      message.warning(isSelf ? `你已被移出 ${groupLabel}` : `${groupLabel} 有成员被移出`);
      if (isSelf && groupId) groupRoleCacheRef.current.delete(String(groupId));
    } else if (eventType === 'quitGroup') {
      message.info(isSelf ? `你已退出 ${groupLabel}` : `${groupLabel} 有成员退出`);
      if (isSelf && groupId) groupRoleCacheRef.current.delete(String(groupId));
    } else if (eventType === 'joinGroup') {
      message.info(isSelf ? `你已加入 ${groupLabel}` : `${groupLabel} 有新成员加入`);
      if (isSelf && groupId) await fetchGroupRole(groupId);
    }

    addGroupEvent({
      eventType,
      eventData: {
        ...eventData,
        groupName,
        groupAvatar
      },
      groupId
    });
    const unread = getUnreadGroupEventCount();
    updateNotificationTotal((current) => ({ ...current, groupEvent: unread }));
  };
  // Fetch initial data
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    }
    (async () => {
      try {
        const [profile, conversations, groupsRes] = await Promise.all([
          getProfile(),
          messageApi.getConversations().catch(() => ({ list: [] })),
          groupApi.getList(1, 200).catch(() => ({ list: [] }))
        ]);

        const normalizedProfile = normalizeUser(profile);
        setUser(normalizedProfile);

        const groupList = normalizeGroupList(groupsRes);
        groupList.forEach((item) => {
          const groupId = extractGroupId(item);
          const role = resolveGroupRole(item, normalizedProfile?.id);
          if (groupId && role != null) cacheGroupRole(groupId, role);
        });

        // Initialize sessions
        const list = conversations.list || conversations || [];
        const existingMeta = loadSessionsMeta();
        const nextMeta = { ...existingMeta };

        // Create a Set of current valid session keys from server
        const currentSessionKeys = new Set();
        list.forEach(item => {
          const isGroup = item.type === 2 || item.type === 'group' || !!item.groupId;
          const id = isGroup ? item.groupId : (item.peerId || item.userId || item.friendId);
          if (!id) return;
          const key = isGroup ? getGroupSessionKey(id) : getFriendSessionKey(id);
          currentSessionKeys.add(key);

          const prev = existingMeta[key] || {};
          const prevUnread = Number(prev.unread ?? 0) || 0;
          const unreadRaw = item.unread ?? item.unreadCount;
          const unreadCandidate = unreadRaw == null ? null : Number(unreadRaw);
          let unread = prevUnread;
          if (unreadCandidate === 0) {
            unread = 0;
          } else if (prevUnread === 0 && unreadCandidate != null && !Number.isNaN(unreadCandidate)) {
            unread = unreadCandidate;
          }

          const prevLastAt = Number(prev.lastAt ?? 0) || 0;
          const lastAtRaw = item.lastAt ?? item.updatedAt;
          const lastAtCandidate = Number(lastAtRaw) || 0;
          const useServerLast = lastAtCandidate > prevLastAt;
          const lastAt = useServerLast ? lastAtCandidate : prevLastAt;
          const lastMessageRaw = item.lastMessage ?? item.lastContent;
          const lastMessage = useServerLast
            ? (lastMessageRaw || '')
            : (prev.lastMessage ?? (lastMessageRaw || ''));

          const prevLastSeq = Number(prev.lastSeq ?? 0) || 0;
          const lastSeqCandidate = Number(item.lastSeq ?? 0) || 0;
          const lastSeq = Math.max(prevLastSeq, lastSeqCandidate);

          nextMeta[key] = {
            ...prev,
            unread,
            lastAt,
            lastMessage,
            lastSeq,
          };
        });

        // 2. Clean up unread counts for sessions not in server list (e.g. quit groups)
        Object.keys(existingMeta).forEach(key => {
          if (!currentSessionKeys.has(key)) {
            // Keep the session meta but clear unread count to fix ghost badges
            if (nextMeta[key]) {
              nextMeta[key] = { ...nextMeta[key], unread: 0 };
            } else {
              // If it was not in server list, we still keep it in local but zero out unread
              // But actually if it's not in server list, we probably shouldn't show it at all in nextMeta?
              // existingMeta was copied to nextMeta at start. 
              // We should update nextMeta[key] to zero unread if it exists there (it does since we copied)
              nextMeta[key] = { ...existingMeta[key], unread: 0 };
            }
          }
        });

        replaceSessionsMeta(nextMeta);
        const totalUnread = Object.values(nextMeta).reduce((acc, curr) => acc + (curr.unread || 0), 0);
        setUnreadTotal(totalUnread);

        // Fetch Notifications Count (with read status filtering)
        const countPending = (res) => {
          if (!res) return 0;
          const list = Array.isArray(res)
            ? res
            : Array.isArray(res.list)
              ? res.list
              : Array.isArray(res.data?.list)
                ? res.data.list
                : [];
          if (!list.length) return 0;
          return list.filter((item) => Number(item?.status) === 0).length;
        };

        const countProcessedUnread = (res, type) => {
          if (!res) return 0;
          const list = Array.isArray(res)
            ? res
            : Array.isArray(res.list)
              ? res.list
              : Array.isArray(res.data?.list)
                ? res.data.list
                : [];
          if (!list.length) return 0;

          const readStatus = loadReadStatus();
          const key = `${type}Sent`;

          return list.filter((item) =>
            (Number(item?.status) === 1 || Number(item?.status) === 2) &&
            !(readStatus[key] && readStatus[key].includes(item.id))
          ).length;
        };

        const checkActiveGroups = async (items) => {
          if (!items.length) return 0;
          const groupIds = [...new Set(items.map(it => it.groupId).filter(Boolean))];
          if (!groupIds.length) return items.length;

          try {
            const activeGroupIds = new Set();
            await Promise.all(groupIds.map(async (gid) => {
              try {
                const res = await groupApi.getDetails(gid);
                const info = res?.group || res?.data || res;
                if (info && info.status !== 2) {
                  activeGroupIds.add(String(gid));
                }
              } catch (e) {
                console.warn('Check group status failed', gid, e);
                activeGroupIds.add(String(gid));
              }
            }));

            return items.filter(it => activeGroupIds.has(String(it.groupId))).length;
          } catch {
            return items.length;
          }
        };

        const [
          friendReceivedReqs,
          friendSentReqs,
          groupReceivedInvs,
          groupSentInvs,
          joinReceivedReqs,
          joinSentReqs
        ] = await Promise.all([
          friendApi.getReceivedRequests(1, 200).catch(() => null),
          friendApi.getSentRequests(1, 200).catch(() => null),
          groupApi.getReceivedInvitations(1, 200).catch(() => null),
          groupApi.getSentInvitations(1, 200).catch(() => null),
          groupApi.getReceivedJoinRequests(1, 200).catch(() => null),
          groupApi.getSentJoinRequests(1, 200).catch(() => null),
        ]);

        const fReceivedCount = countPending(friendReceivedReqs);
        const fSentCount = countProcessedUnread(friendSentReqs, 'friend');

        // For group-related, need to filter out dismissed groups
        const readStatus = loadReadStatus();

        const groupReceivedPending = (groupReceivedInvs?.list || groupReceivedInvs?.data?.list || [])
          .filter(item => Number(item?.status) === 0);
        const groupSentProcessed = (groupSentInvs?.list || groupSentInvs?.data?.list || [])
          .filter(item =>
            (Number(item?.status) === 1 || Number(item?.status) === 2) &&
            !(readStatus.groupSent && readStatus.groupSent.includes(item.id))
          );

        const joinReceivedPending = (joinReceivedReqs?.list || joinReceivedReqs?.data?.list || [])
          .filter(item => Number(item?.status) === 0);
        const joinSentProcessed = (joinSentReqs?.list || joinSentReqs?.data?.list || [])
          .filter(item =>
            (Number(item?.status) === 1 || Number(item?.status) === 2) &&
            !(readStatus.joinSent && readStatus.joinSent.includes(item.id))
          );

        const [gReceivedCount, gSentCount, jReceivedCount, jSentCount] = await Promise.all([
          checkActiveGroups(groupReceivedPending),
          checkActiveGroups(groupSentProcessed),
          checkActiveGroups(joinReceivedPending),
          checkActiveGroups(joinSentProcessed)
        ]);

        const fCount = fReceivedCount + fSentCount;
        const gCount = gReceivedCount + gSentCount;
        const jCount = jReceivedCount + jSentCount;

        updateNotificationTotal({ friend: fCount, group: gCount, joinReceived: jCount });

        wsClient.connect();
      } catch (e) {
        console.error('Init failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  // Subscribe to Session Updates for Unread Total
  useEffect(() => {
    const unsub = onSessionsUpdated((meta) => {
      let total = 0;
      Object.values(meta).forEach(s => {
        total += (s.unread || 0);
      });
      setUnreadTotal(total);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onNotificationsUpdated((counts) => {
      setNotificationCount(getNotificationTotal(counts));
    });
    return unsub;
  }, []);

  // Message & WS Handling
  useEffect(() => {
    if (!user?.id) return;

    const loadSeenCache = (userId) => {
      if (!userId) return { set: new Set(), queue: [] };
      try {
        const raw = localStorage.getItem(`skyeim:seenMsgIds:v1:${userId}`);
        const list = JSON.parse(raw || '[]');
        if (!Array.isArray(list)) return { set: new Set(), queue: [] };
        const trimmed = list.slice(-500);
        return { set: new Set(trimmed), queue: trimmed };
      } catch {
        return { set: new Set(), queue: [] };
      }
    };

    const saveSeenCache = (userId) => {
      if (!userId) return;
      try {
        localStorage.setItem(`skyeim:seenMsgIds:v1:${userId}`, JSON.stringify(seenMsgQueueRef.current.slice(-500)));
      } catch {
        // ignore
      }
    };

    if (lastUserIdRef.current !== user.id) {
      lastUserIdRef.current = user.id;
      const cache = loadSeenCache(user.id);
      seenMsgIdsRef.current = cache.set;
      seenMsgQueueRef.current = cache.queue;
      offlineReceivedRef.current = false;
      privateOfflineIgnoreRef.current = 0;
      groupOfflineIgnoreRef.current = 0;
      offlineSyncRequestedRef.current = { private: false, group: false };
      if (offlineFallbackTimerRef.current) {
        clearTimeout(offlineFallbackTimerRef.current);
        offlineFallbackTimerRef.current = null;
      }
    }

    const isChatActive = (type, id) => {
      if (!location.pathname.startsWith('/chat')) return false;
      const searchParams = new URLSearchParams(location.search);
      const currentType = searchParams.get('type');
      const currentId = searchParams.get('id');
      return currentType === type && String(currentId) === String(id);
    };

    const getMessageKey = (payload) => {
      const key = payload?.msgId ?? payload?.id;
      return key != null ? String(key) : null;
    };

    const markSeen = (payload) => {
      const key = getMessageKey(payload);
      if (!key) return false;
      const seen = seenMsgIdsRef.current;
      if (seen.has(key)) return true;
      seen.add(key);
      seenMsgQueueRef.current.push(key);
      if (seenMsgQueueRef.current.length > 500) {
        const drop = seenMsgQueueRef.current.shift();
        if (drop) seen.delete(drop);
      }
      saveSeenCache(user.id);
      return false;
    };

    const formatPreview = (payload) => {
      const rawContent = payload?.content ?? '';
      if (payload?.contentType === 2) return '[Image]';
      if (payload?.contentType === 3) return '[File]';
      return rawContent;
    };

    const applyMessageToSession = (payload, isGroup, { isOffline = false } = {}) => {
      if (!payload) return;
      if (markSeen(payload)) return;

      const id = isGroup
        ? payload.groupId
        : (String(payload.fromUserId) === String(user.id) ? payload.toUserId : payload.fromUserId);
      if (!id) return;

      const sessionKey = isGroup ? getGroupSessionKey(id) : getFriendSessionKey(id);
      const createdAt = payload.createdAt || Date.now() / 1000;
      const content = formatPreview(payload);
      const seq = payload.seq;
      const isIncoming = String(payload.fromUserId) !== String(user.id);

      let shouldCount = isIncoming;
      if (shouldCount && isChatActive(isGroup ? 'group' : 'friend', id)) shouldCount = false;

      updateSessionMeta(sessionKey, (prev) => {
        const prevLastAt = prev.lastAt || 0;
        const prevLastSeq = prev.lastSeq || 0;
        const nextLastAt = Math.max(prevLastAt, createdAt);
        const nextLastSeq = isGroup && Number.isFinite(seq)
          ? Math.max(prevLastSeq, seq)
          : prevLastSeq;
        const shouldUpdatePreview = isGroup && Number.isFinite(seq)
          ? seq >= prevLastSeq
          : createdAt >= prevLastAt;
        return {
          ...prev,
          lastAt: nextLastAt,
          lastMessage: shouldUpdatePreview ? content : prev.lastMessage,
          lastSeq: nextLastSeq,
          unread: shouldCount ? (prev.unread || 0) + 1 : (prev.unread || 0),
        };
      });
    };

    const applyOfflineList = (list, messageType) => {
      if (!Array.isArray(list) || list.length === 0) return;
      list.forEach((msg) => {
        const chatType = msg?.chatType ?? msg?.type;
        const isGroup =
          messageType === 'group' ||
          chatType === 2 ||
          chatType === 'group' ||
          msg?.type === 'group_chat' ||
          msg?.groupId;
        applyMessageToSession(msg, isGroup, { isOffline: true });
      });
    };

    const syncGroupOffline = async () => {
      if (groupSyncInFlightRef.current) return;
      groupSyncInFlightRef.current = true;
      try {
        const meta = loadSessionsMeta();
        const groupEntries = Object.entries(meta).filter(([key]) => key.startsWith('g-'));
        for (const [key, value] of groupEntries) {
          const groupId = key.slice(2);
          const seq = Math.max(Number(value?.lastSeq ?? 0), Number(value?.readSeq ?? 0)) || 0;
          try {
            const res = await messageApi.syncGroupMessages(groupId, seq, 200);
            const list = res?.list || res?.data?.list || (Array.isArray(res) ? res : []);
            if (!Array.isArray(list) || list.length === 0) continue;

            list.forEach((msg) => applyMessageToSession(msg, true, { isOffline: true }));
          } catch (e) {
            // ignore per-group errors
          }
        }
      } finally {
        groupSyncInFlightRef.current = false;
      }
    };

    const scheduleGroupSync = () => {
      if (groupSyncTimerRef.current) return;
      groupSyncTimerRef.current = setTimeout(() => {
        groupSyncTimerRef.current = null;
        syncGroupOffline();
      }, 300);
    };

    const fetchOfflineMessages = async (initialSkip = 0) => {
      if (offlineFetchInFlightRef.current) return;
      offlineFetchInFlightRef.current = true;
      let skip = initialSkip;
      let hasMore = true;
      try {
        while (hasMore) {
          const res = await messageApi.getOfflineMessages(skip, 200);
          const list = res?.list || [];
          hasMore = res?.hasMore;
          skip += list.length;
          if (list.length === 0) break;
          applyOfflineList(list);
        }
      } catch (e) {
        // ignore
      } finally {
        offlineFetchInFlightRef.current = false;
      }
    };

    const requestPrivateOfflineSync = () => {
      if (offlineSyncRequestedRef.current.private) return;
      offlineSyncRequestedRef.current.private = true;
      fetchOfflineMessages(0);
    };

    const scheduleOfflineFallback = () => {
      if (offlineReceivedRef.current) return;
      if (offlineFallbackTimerRef.current) return;
      offlineFallbackTimerRef.current = setTimeout(() => {
        offlineFallbackTimerRef.current = null;
        if (!offlineReceivedRef.current) requestPrivateOfflineSync();
      }, 2000);
    };

    if (wsClient.isConnected) {
      scheduleOfflineFallback();
      scheduleGroupSync();
    }

    const unsubscribe = wsClient.subscribe((msg) => {
      if (!msg) return;

      // Handle connection status
      if (msg.type === 'status') {
        setWsStatus(msg.status);
        if (msg.status === 'connected') {
          offlineReceivedRef.current = false;
          scheduleOfflineFallback();
          scheduleGroupSync();
        }
        return;
      }

      if (msg.type === 'connected') {
        scheduleOfflineFallback();
        scheduleGroupSync();
      }

      // Update notifications on events
      if (msg.type === 'friend_request') {
        message.info(`收到好友请求: ${msg.data?.message || ''}`);
        updateNotificationTotal((current) => ({
          ...current,
          friend: (current.friend || 0) + 1,
        }));
        return;
      }

      if (msg.type === 'friend_request_handled') {
        const action = msg.data?.action;
        const actionText =
          action === 'accepted'
            ? '已接受'
            : action === 'rejected'
              ? '已拒绝'
              : '已处理';
        message.info(`好友请求${actionText}`);
        updateNotificationTotal((current) => ({
          ...current,
          friend: (current.friend || 0) + 1,
        }));
        return;
      }

      if (msg.type === 'group_invitation') {
        message.info(`收到群组邀请: ${msg.data?.message || ''}`);
        updateNotificationTotal((current) => ({
          ...current,
          group: (current.group || 0) + 1,
        }));
        return;
      }

      if (msg.type === 'group_invitation_handled') {
        const action = msg.data?.action;
        const actionText =
          action === 'accepted'
            ? '已接受'
            : action === 'rejected'
              ? '已拒绝'
              : '已处理';
        message.info(`群组邀请${actionText}`);
        updateNotificationTotal((current) => ({
          ...current,
          group: (current.group || 0) + 1,
        }));
        return;
      }

      if (msg.type === 'group_join_request') {
        message.info('收到新的入群申请');
        updateNotificationTotal((current) => ({
          ...current,
          joinReceived: (current.joinReceived || 0) + 1,
        }));
        return;
      }

      if (
        msg.type === 'group_event' ||
        msg.type === 'group_join' ||
        msg.type === 'group_leave' ||
        msg.type === 'group_dismiss' ||
        msg.type === 'dismissGroup' ||
        msg.type === 'kickMember' ||
        msg.type === 'quitGroup' ||
        msg.type === 'joinGroup'
      ) {
        void handleGroupEventNotification(msg);
        return;
      }

      if (msg.type === 'offline_messages') {
        offlineReceivedRef.current = true;
        if (offlineFallbackTimerRef.current) {
          clearTimeout(offlineFallbackTimerRef.current);
          offlineFallbackTimerRef.current = null;
        }
        const data = msg.data || msg;
        const messageType = String(data?.messageType || '').toLowerCase();
        const pushCount = Number(data?.pushCount ?? data?.push_count ?? 0) || 0;
        const hasMore = !!data?.hasMore;
        if (messageType === 'private' && pushCount > 0) {
          privateOfflineIgnoreRef.current = pushCount;
        }
        if (messageType === 'group' && pushCount > 0) {
          groupOfflineIgnoreRef.current = pushCount;
        }
        if (messageType === 'private' && hasMore) {
          requestPrivateOfflineSync();
        }
        if (messageType === 'group' && hasMore) {
          scheduleGroupSync();
        }
        return;
      }

      const normalizedType =
        msg.type === 'message' ? 'chat' :
          msg.type === 'group_message' ? 'group_chat' :
            msg.type;

      if (normalizedType === 'chat' || normalizedType === 'group_chat') {
        const isGroup = normalizedType === 'group_chat';
        const payload = msg.data || msg;
        const hasOfflinePush = isGroup
          ? groupOfflineIgnoreRef.current > 0
          : privateOfflineIgnoreRef.current > 0;
        if (hasOfflinePush) {
          if (isGroup) groupOfflineIgnoreRef.current -= 1;
          else privateOfflineIgnoreRef.current -= 1;
        }
        applyMessageToSession(payload, isGroup, { isOffline: hasOfflinePush });
      }
    });

    return () => {
      unsubscribe();
      if (offlineFallbackTimerRef.current) {
        clearTimeout(offlineFallbackTimerRef.current);
        offlineFallbackTimerRef.current = null;
      }
      if (groupSyncTimerRef.current) {
        clearTimeout(groupSyncTimerRef.current);
        groupSyncTimerRef.current = null;
      }
    };
  }, [location.pathname, user?.id]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      wsClient.disconnect();
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      navigate('/login');
    }
  };

  const menuItems = [
    {
      key: '/chat',
      icon: <MessageOutlined style={{ fontSize: 20 }} />,
      label: '消息',
      badge: unreadTotal > 0 ? unreadTotal : 0
    },
    {
      key: '/contacts',
      icon: <TeamOutlined style={{ fontSize: 20 }} />,
      label: '联系人'
    },
    {
      key: '/user-search',
      icon: <SearchOutlined style={{ fontSize: 20 }} />,
      label: '搜索'
    },
    {
      key: '/friends/requests',
      icon: <BellOutlined style={{ fontSize: 20 }} />,
      label: '通知',
      badge: notificationCount
    }
  ];

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  if (!user) return null;

  const content = typeof children === 'function' ? children({ user }) : children;

  return (
    <Layout style={{ minHeight: '100vh', background: '#fff' }}>
      <Sider
        theme="light"
        collapsible
        collapsed={collapsed}
        onCollapse={toggleCollapsed}
        trigger={null}
        width={220}
        collapsedWidth={80}
        style={{
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          borderRight: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 10px rgba(0,0,0,0.03)'
        }}
      >
        {/* Logo */}
        <div style={{
          height: 80, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
          paddingLeft: collapsed ? 0 : 24, cursor: 'pointer', transition: 'all 0.2s'
        }} onClick={() => navigate('/')}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <RocketOutlined style={{ fontSize: 20, color: '#fff' }} />
          </div>
          {!collapsed && (
            <span style={{ marginLeft: 12, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>SkyeIM</span>
          )}
        </div>

        {/* Menu */}
        <div style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {menuItems.map(item => {
            const isActive = selectedKey === item.key || (item.key === '/friends/requests' && location.pathname === '/friends/requests');
            // For messages and notifs: simply show count if > 0
            const showBadge = item.badge > 0;

            return (
              <div
                key={item.key}
                onClick={() => navigate(item.key)}
                style={{
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? 0 : '0 16px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  color: isActive ? '#0ea5e9' : '#64748b',
                  background: isActive ? '#e0f2fe' : 'transparent',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#334155';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                  }
                }}
              >
                <Badge
                  count={item.badge}
                  overflowCount={99}
                  size="small"
                  offset={[5, -5]}
                >
                  {item.icon}
                </Badge>
                {!collapsed && (
                  <span style={{ marginLeft: 16, fontSize: 15, fontWeight: 500 }}>{item.label}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Collapse Trigger */}
          <div
            onClick={toggleCollapsed}
            style={{
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? 0 : '0 16px',
              borderRadius: 8,
              cursor: 'pointer',
              color: '#94a3b8',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            {!collapsed && <span style={{ marginLeft: 16 }}>{collapsed ? '展开' : '收起'}</span>}
          </div>

          {/* Logout */}
          <div
            onClick={handleLogout}
            style={{
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? 0 : '0 16px',
              borderRadius: 8,
              cursor: 'pointer',
              color: '#ef4444',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <LogoutOutlined />
            {!collapsed && <span style={{ marginLeft: 16 }}>退出登录</span>}
          </div>
        </div>
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'all 0.2s', background: '#fff', minHeight: '100vh' }}>
        <div style={{ height: 64, padding: '0 32px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Dropdown
            menu={{
              items: [
                { key: 'profile', icon: <UserOutlined />, label: '个人资料', onClick: () => navigate('/profile') },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true, onClick: handleLogout }
              ]
            }}
            placement="bottomRight"
          >
            <Space style={{ cursor: 'pointer' }} size={12}>
              <div style={{ textAlign: 'right' }}>
                <Text strong style={{ display: 'block', lineHeight: 1.2 }}>{user.nickname || user.username}</Text>
                <Space size={6} style={{ justifyContent: 'flex-end' }}>
                  <Badge status={wsStatus === 'connected' ? 'success' : 'default'} text={wsStatus === 'connected' ? '在线' : '离线'} />
                </Space>
              </div>
              <Avatar src={user.avatar} size="large" icon={<UserOutlined />} style={{ border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
            </Space>
          </Dropdown>
        </div>

        <Content style={{ height: 'calc(100vh - 64px)', overflow: 'hidden', padding: '0 24px 24px' }}>
          {content}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;




