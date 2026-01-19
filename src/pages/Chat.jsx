import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Layout, List, Avatar, Input, InputNumber, Typography, Button, Space, Badge, Empty, Spin, theme, Tabs, Modal, Form, message, Tooltip, Dropdown, Drawer, Descriptions, Tag, Image, Upload } from 'antd';
import { SendOutlined, UserOutlined, PictureOutlined, TeamOutlined, PlusOutlined, MessageOutlined, MoreOutlined, SearchOutlined, BellOutlined, UserAddOutlined, DeleteOutlined, ExclamationCircleOutlined, FileOutlined, PaperClipOutlined, CloudDownloadOutlined, CloseOutlined, UploadOutlined, EditOutlined, LogoutOutlined, StopOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import SearchAddModal from '../components/SearchAddModal';
import GlobalSearchBox from '../components/GlobalSearchBox';
import GroupRequestsModal from '../components/group/GroupRequestsModal';
import UserProfileModal from '../components/UserProfileModal';
import RemarkEditModal from '../components/friend/RemarkEditModal';
import { friendApi } from '../api/friend';
import { messageApi } from '../api/message';
import { groupApi } from '../api/group';
import { getUserInfo } from '../api/auth';
import { uploadApi } from '../api/upload';
import { wsClient } from '../utils/websocket';
import useUserCache from '../hooks/useUserCache';
import { getFriendSessionKey, getGroupSessionKey, loadSessionsMeta, onSessionsUpdated, updateSessionMeta } from '../utils/sessionStore';

const { Sider, Content } = Layout;
const { Text, Title } = Typography;
const { TextArea } = Input;
const { confirm } = Modal;

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatSessionTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return formatTime(timestamp);
  return date.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
};

const createClientMsgId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sortGroupMembers = (list) => {
  const members = Array.isArray(list) ? [...list] : [];
  const roleOrder = (role) => (role === 1 ? 0 : role === 2 ? 1 : 2);
  const getJoinAt = (m) => {
    const raw =
      m?.joinedAt ??
      m?.joinAt ??
      m?.joinTime ??
      m?.join_time ??
      m?.createdAt ??
      m?.created_at;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return n > 1e12 ? Math.floor(n / 1000) : n;
  };
  return members
    .map((m, idx) => ({ m, idx }))
    .sort((a, b) => {
      const ra = roleOrder(a.m?.role);
      const rb = roleOrder(b.m?.role);
      if (ra !== rb) return ra - rb;

      const ja = getJoinAt(a.m);
      const jb = getJoinAt(b.m);
      if (ja != null && jb != null && ja !== jb) return ja - jb;

      return a.idx - b.idx;
    })
    .map(({ m }) => m);
};

const sortMessages = (list, chatType) => {
  const items = Array.isArray(list) ? [...list] : [];

  const seenIds = new Set();
  const seenMsgIds = new Set();
  const seenSeq = new Set();
  const deduped = [];

  for (const m of items) {
    const id = m?.id ? String(m.id) : null;
    const msgId = m?.msgId ? String(m.msgId) : null;

    // Check if duplicate by ID
    if (id && seenIds.has(id)) continue;
    // Check if duplicate by msgId
    if (msgId && seenMsgIds.has(msgId)) continue;
    
    // Check if duplicate by Seq (Group only)
    // Only dedupe if seq > 0 (avoid dropping messages with default seq=0)
    if (chatType === 'group' && Number.isFinite(m?.seq) && m.seq > 0) {
      if (seenSeq.has(m.seq)) continue;
      seenSeq.add(m.seq);
    }
    
    if (id) seenIds.add(id);
    if (msgId) seenMsgIds.add(msgId);
    
    deduped.push(m);
  }

  if (chatType === 'group') {
    return deduped.sort((a, b) => {
      const aSeq = a?.seq;
      const bSeq = b?.seq;
      // Only sort by seq if both are valid > 0
      if (Number.isFinite(aSeq) && Number.isFinite(bSeq) && aSeq > 0 && bSeq > 0) return aSeq - bSeq;
      return (a?.createdAt || 0) - (b?.createdAt || 0);
    });
  }
  return deduped.sort((a, b) => (a?.createdAt || 0) - (b?.createdAt || 0));
};

const touchSession = (type, id, msg) => {
  if (!msg) return;
  const key = type === 'friend' ? getFriendSessionKey(id) : getGroupSessionKey(id);
  const text = msg.contentType === 2 ? '[图片]' : msg.contentType === 3 ? '[文件]' : msg.content;
  
  updateSessionMeta(key, (prev) => ({
    ...prev,
    lastAt: msg.createdAt || Date.now() / 1000,
    lastMessage: text,
  }));
};

const normalizeGroupItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const groupId = item.groupId ?? item.groupID ?? item.group_id ?? item.id ?? item.groupIdStr;
  const name = item.name ?? item.groupName ?? item.group_name;
  const avatar = item.avatar ?? item.groupAvatar ?? item.group_avatar;
  const ownerId = item.ownerId ?? item.owner_id ?? item.owner;
  return { ...item, groupId, name, avatar, ownerId };
};

const Chat = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { getUser, ensureUsers } = useUserCache();
  const [searchParams] = useSearchParams();
  
  const [currentUser, setCurrentUser] = useState(null);
  
  const [sessionList, setSessionList] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [friendsList, setFriendsList] = useState([]); 
  const [blacklist, setBlacklist] = useState(new Set()); // Store blacklisted IDs

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [searchText, setSearchText] = useState('');
  
  
  // Message Search State
  const [isSearchMessageOpen, setIsSearchMessageOpen] = useState(false);
  const [searchMessageKeyword, setSearchMessageKeyword] = useState('');
  const [searchMessageResult, setSearchMessageResult] = useState([]);
  const [searchingMessage, setSearchingMessage] = useState(false);
  const inputRef = useRef(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(null);
  const [mentionCursor, setMentionCursor] = useState(null);
  const [atTargets, setAtTargets] = useState([]);

  const [isAtMeOpen, setIsAtMeOpen] = useState(false);
  const [atMeList, setAtMeList] = useState([]);
  const [atMeLoading, setAtMeLoading] = useState(false);
  const [atMeHasMore, setAtMeHasMore] = useState(false);
  const atMeCursorRef = useRef(null);
  const atMeLoadingRef = useRef(false);
  const [remarkOpen, setRemarkOpen] = useState(false);
  const [remarkSubmitting, setRemarkSubmitting] = useState(false);
  const [remarkTarget, setRemarkTarget] = useState(null);

  const handleGlobalSearch = (value) => {
    setSearchText(value);
  };

  const openChat = useCallback((type, id) => {
    if (!type || id == null) return;
    const normalizedId = type === 'group' ? String(id) : Number(id);
    navigate(`/chat?type=${type}&id=${encodeURIComponent(String(normalizedId))}`, { replace: true });
  }, [navigate]);

  const onGlobalSelect = (value, option) => {
     if (option.type === 'user') {
       const existing = sessionList.find(s => s.type === 'friend' && s.friendId === option.data.id);
       if (existing) {
         openChat('friend', option.data.id);
       } else {
         message.info('请在“发现”中添加好友');
       }
     } else {
       const existing = sessionList.find(s => s.type === 'group' && s.groupId === option.data.groupId);
       if (existing) {
         openChat('group', option.data.groupId);
       } else {
         message.info('请在“发现”中搜索并加入群组');
       }
     }
     setSearchText('');
  };

  const handleSearchMessages = async () => {
    if (!searchMessageKeyword.trim()) return;
    setSearchingMessage(true);
    try {
      const res = await messageApi.searchMessages(searchMessageKeyword);
      const list = res?.list || (Array.isArray(res) ? res : []);
      // Pre-fetch users
      const userIds = list.map(m => m.fromUserId);
      if (userIds.length) await ensureUsers(userIds);
      
      setSearchMessageResult(list);
    } catch (e) {
      console.error(e);
      message.error('搜索失败');
    } finally {
      setSearchingMessage(false);
    }
  };
  
  // Detail Drawer State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]); // For group details
  const [groupDetail, setGroupDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [editGroupForm] = Form.useForm();

  const myRole = useMemo(() => {
    if (activeChat?.type !== 'group') return 3;
    const me = groupMembers.find(m => String(m.userId) === String(currentUser?.id));
    return groupDetail?.role || me?.role || 3;
  }, [activeChat?.type, groupMembers, groupDetail, currentUser?.id]);

  const canAtAll = myRole === 1 || myRole === 2;

  const detectMention = useCallback((text, cursor) => {
    const prefix = text.slice(0, cursor);
    const match = prefix.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) return null;
    return { query: match[1], index: prefix.lastIndexOf('@'), cursor };
  }, []);

  const normalizeGroupMessage = useCallback((raw) => {
    const data = raw ? { ...raw } : {};
    const fromMe = String(data.fromUserId) === String(currentUser?.id);
    if (data.isAtMe === undefined) {
      const ids = Array.isArray(data.atUserIds) ? data.atUserIds : [];
      const isAtAll = ids.includes(-1);
      const isAtMe = !fromMe && (isAtAll || ids.map(String).includes(String(currentUser?.id)));
      data.isAtMe = !!(currentUser?.id && isAtMe);
    }
    return data;
  }, [currentUser?.id]);

  const mentionCandidates = useMemo(() => {
    if (activeChat?.type !== 'group') return [];
    const query = mentionQuery.trim().toLowerCase();
    const list = groupMembers.map((m) => {
      const u = getUser(m.userId);
      const label = m.nickname || u?.nickname || u?.username || String(m.userId);
      return {
        id: Number(m.userId),
        label,
        username: u?.username || '',
        avatar: u?.avatar,
      };
    });
    const filtered = query
      ? list.filter((item) =>
          item.label.toLowerCase().includes(query) ||
          item.username.toLowerCase().includes(query)
        )
      : list;
    const atAll = canAtAll ? [{ id: -1, label: 'all', username: '', avatar: null }] : [];
    return [...atAll, ...filtered];
  }, [activeChat?.type, groupMembers, getUser, mentionQuery, canAtAll]);

  const syncAtTargets = useCallback((text) => {
    setAtTargets((prev) => prev.filter((t) => text.includes(`@${t.label}`)));
  }, []);

  const handleMentionPick = useCallback((target) => {
    const label = target.label;
    const insertText = `@${label} `;
    const start = mentionIndex != null ? mentionIndex : inputValue.length;
    const end = mentionCursor != null ? mentionCursor : inputValue.length;
    const next = inputValue.slice(0, start) + insertText + inputValue.slice(end);
    setInputValue(next);
    setMentionOpen(false);
    setMentionQuery('');
    setMentionIndex(null);
    setMentionCursor(null);
    setAtTargets((prev) => {
      if (prev.some((t) => t.id === target.id)) return prev;
      return [...prev, { id: target.id, label }];
    });
    requestAnimationFrame(() => {
      const node = inputRef.current?.resizableTextArea?.textArea;
      if (!node) return;
      const pos = start + insertText.length;
      node.focus();
      node.setSelectionRange(pos, pos);
    });
  }, [inputValue, mentionIndex, mentionCursor]);

  const handleInputChange = useCallback((e) => {
    const next = e.target.value;
    setInputValue(next);
    syncAtTargets(next);
    if (activeChat?.type !== 'group') {
      setMentionOpen(false);
      setMentionQuery('');
      setMentionIndex(null);
      setMentionCursor(null);
      return;
    }
    const cursor = e.target.selectionStart ?? next.length;
    const match = detectMention(next, cursor);
    if (match) {
      setMentionOpen(true);
      setMentionQuery(match.query);
      setMentionIndex(match.index);
      setMentionCursor(match.cursor);
    } else {
      setMentionOpen(false);
      setMentionQuery('');
      setMentionIndex(null);
      setMentionCursor(null);
    }
  }, [activeChat?.type, detectMention, syncAtTargets]);

  const getAtUserIdsFromContent = useCallback((text) => {
    if (!text) return [];
    const ids = new Set();
    atTargets.forEach((t) => {
      if (text.includes(`@${t.label}`)) ids.add(t.id);
    });
    return Array.from(ids);
  }, [atTargets]);

  const groupNameMap = useMemo(() => {
    const map = {};
    sessionList.forEach((s) => {
      if (s.type === 'group' && s.groupId) map[String(s.groupId)] = s.name || s.groupId;
    });
    return map;
  }, [sessionList]);

  const loadAtMeMessages = useCallback(async (reset = false) => {
    if (atMeLoadingRef.current) return;
    atMeLoadingRef.current = true;
    setAtMeLoading(true);
    try {
      const params = { limit: 20 };
      if (activeChat?.type === 'group') params.groupId = String(activeChat.id);
      if (!reset && atMeCursorRef.current) params.lastMsgId = atMeCursorRef.current;
      
      console.log('Fetching @me messages with params:', params);
      const res = await messageApi.getAtMeMessages(params);
      console.log('Fetching @me result:', res);
      
      const list = res?.list || (Array.isArray(res) ? res : []);
      const hasMore = res?.hasMore ?? (list.length >= 20);

      if (list.length) await ensureUsers(list.map((m) => m.fromUserId));

      if (reset) setAtMeList(list);
      else setAtMeList((prev) => [...prev, ...list]);
      
      if (list.length) atMeCursorRef.current = list[list.length - 1].id || atMeCursorRef.current;
      setAtMeHasMore(hasMore);
    } catch (e) {
      console.error('Fetch @me failed', e);
    } finally {
      atMeLoadingRef.current = false;
      setAtMeLoading(false);
    }
  }, [activeChat?.id, activeChat?.type, ensureUsers]);

  useEffect(() => {
    if (!isAtMeOpen) return;
    atMeCursorRef.current = null;
    setAtMeList([]);
    setAtMeHasMore(false);
    loadAtMeMessages(true);
  }, [isAtMeOpen, activeChat?.id, loadAtMeMessages]);

  useEffect(() => {
    setMentionOpen(false);
    setMentionQuery('');
    setMentionIndex(null);
    setMentionCursor(null);
    setAtTargets([]);
  }, [activeChat?.id]);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState('user');
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isGroupRequestsOpen, setIsGroupRequestsOpen] = useState(false);
  const [inviteFriendId, setInviteFriendId] = useState(null);
  const [inviteMessage, setInviteMessage] = useState('');
  
  const [profileUserId, setProfileUserId] = useState(null);

  const [createGroupForm] = Form.useForm();
  
  const messagesEndRef = useRef(null);
  const lastReadSeqRef = useRef({});
  const lastGroupSeqRef = useRef({});
  const shouldScrollToBottomRef = useRef(false);
  const startupTimeRef = useRef(Date.now() / 1000);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const pendingAckTimersRef = useRef(new Map());
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [pendingAttachment, setPendingAttachment] = useState(null);

  const clearAttachment = () => {
    if (pendingAttachment?.preview) URL.revokeObjectURL(pendingAttachment.preview);
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const sendMediaMessage = async (content, contentType) => {
    if (!activeChat || !currentUser) return;
    
    // Group Mute Check
    if (activeChat.type === 'group') {
        let myMember = groupMembers.find(m => String(m.userId) === String(currentUser?.id));
        if (!myMember || (myMember?.mute === 1 || myMember?.muted === 1 || myMember?.isMuted === true)) {
           try {
             const latestMembers = await fetchDetailInfo();
             if (Array.isArray(latestMembers)) {
                myMember = latestMembers.find(m => String(m.userId) === String(currentUser?.id));
             }
           } catch (e) {
             console.error('Failed to refresh members', e);
           }
        }
        const isMuted = myMember?.mute === 1 || myMember?.muted === 1 || myMember?.isMuted === true;
        if (isMuted) {
          message.warning('你已被禁言，无法发送消息');
          return;
        }
    }

    try {
      const msgId = createClientMsgId();
      let msgData;
      let type;
      
      if (activeChat.type === 'friend') {
        msgData = { msgId, toUserId: Number(activeChat.id), content, contentType };
        type = 'chat';
      } else {
        msgData = { msgId, groupId: String(activeChat.id), content, contentType };
        type = 'group_chat';
      }

      const success = wsClient.send({ type, data: msgData });
      if (!success) {
         message.error('连接断开，正在尝试重连...');
         if (!wsClient.isConnected) {
            wsClient.connect();
         }
         return;
      }
      
      const optimisticMsg = { ...msgData, fromUserId: currentUser.id, createdAt: Date.now() / 1000, localStatus: 'sending' };
      touchSession(activeChat.type, activeChat.id, optimisticMsg);
      upsertMessage(optimisticMsg, activeChat.type);
      scheduleAckTimeout(msgId);
      shouldScrollToBottomRef.current = true;
    } catch (e) {
      console.error('Send failed', e);
      message.error('发送失败');
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setPendingAttachment({ type: 'image', file, preview });
    e.target.value = '';
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingAttachment({ type: 'file', file, name: file.name, size: file.size });
    e.target.value = '';
  };

  const scrollToBottom = (instant = false) => {
    if (instant) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } else {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      scrollToBottom(true);
      shouldScrollToBottomRef.current = false;
    }
  }, [messages]);

  const fetchSessions = useCallback(async (userOverride) => {
    try {
      const user = userOverride || currentUser;
      const [friendRes, groupRes, blacklistRes] = await Promise.all([
        friendApi.getFriendList(1, 100),
        groupApi.getList(1, 100),
        friendApi.getBlacklist(1, 100)
      ]);
      
      const blackSet = new Set((blacklistRes?.list || []).map(b => String(b.friendId)));
      setBlacklist(blackSet);
      
      const friends = (friendRes.list || []).map(f => ({ ...f, type: 'friend', key: `f-${f.friendId}`, unread: 0, lastAt: 0, lastMessage: '' }));
      // Filter out dismissed groups (status === 2)
      const groups = (groupRes.list || [])
        .map(normalizeGroupItem)
        .filter(Boolean)
        .filter(g => g.status !== 2)
        .map(g => ({ ...g, type: 'group', key: `g-${g.groupId}`, unread: 0, lastAt: 0, lastMessage: '', lastSeq: 0 }));
      
      setFriendsList(friends); // Keep raw friend list for invite modal

      await ensureUsers(friends.map(f => f.friendId));
      
      let sessions = [...friends, ...groups];
      
      const meta = loadSessionsMeta();
      
      // Inject Self Session if exists in meta or is forced
      if (user) {
          const selfKey = `f-${user.id}`;
          const selfMeta = meta[selfKey];
          // If we have history for self, add it
          if (selfMeta && (selfMeta.lastMessage || selfMeta.lastAt)) {
             // Check if already in friends (unlikely for self)
             if (!sessions.some(s => s.key === selfKey)) {
                 sessions.push({
                    type: 'friend',
                    friendId: user.id,
                    key: selfKey,
                    unread: 0,
                    lastAt: 0,
                    lastMessage: '',
                    remark: user.nickname || user.username || '我',
                    avatar: user.avatar,
                    isSelf: true
                 });
             }
          }
      }

      setSessionList(prev => {
        const prevMap = new Map((prev || []).map(s => [s.key, s]));
        return sessions.map(s => {
          const old = prevMap.get(s.key);
          const metaItem = meta?.[s.key];
          return {
            ...s,
            unread: metaItem?.unread ?? old?.unread ?? 0,
            lastAt: metaItem?.lastAt ?? old?.lastAt ?? 0,
            lastMessage: metaItem?.lastMessage ?? old?.lastMessage ?? '',
            lastSeq: metaItem?.lastSeq ?? old?.lastSeq ?? s.lastSeq ?? 0,
          };
        });
      });
      
      return { friends, groups };
    } catch (e) {
      console.error('Failed to fetch sessions', e);
      return { friends: [], groups: [] };
    }
  }, [ensureUsers, currentUser]);

  useEffect(() => {
    return () => {
      pendingAckTimersRef.current.forEach((t) => clearTimeout(t));
      pendingAckTimersRef.current.clear();
    };
  }, []);

  const upsertMessage = useCallback((incoming, chatType) => {
    const data = incoming || {};
    const incomingMsgId = data.msgId || data.id;
    const incomingSeq = data.seq;

    setMessages(prev => {
      const list = Array.isArray(prev) ? prev : [];
      const idx = list.findIndex(m => {
        if (incomingMsgId && (m.msgId || m.id) && String(m.msgId || m.id) === String(incomingMsgId)) return true;
        if (chatType === 'group' && Number.isFinite(incomingSeq) && Number.isFinite(m?.seq)) return m.seq === incomingSeq;
        return false;
      });

      if (idx === -1) return sortMessages([...list, data], chatType);
      const merged = { ...list[idx], ...data };
      const next = [...list];
      next[idx] = merged;
      return sortMessages(next, chatType);
    });
  }, []);

  const scheduleAckTimeout = useCallback((msgId) => {
    const key = String(msgId);
    const old = pendingAckTimersRef.current.get(key);
    if (old) clearTimeout(old);

    const timer = setTimeout(() => {
      setMessages(prev => prev.map(m => (
        String(m.msgId || m.id) === key && m.localStatus === 'sending'
          ? { ...m, localStatus: 'failed' }
          : m
      )));
      pendingAckTimersRef.current.delete(key);
    }, 12000);

    pendingAckTimersRef.current.set(key, timer);
  }, []);

  // Init Data (User & Sessions) - Run once
  useEffect(() => {
    const initData = async () => {
      try {
        const userRes = await getUserInfo();
        const user = userRes.user || userRes;
        setCurrentUser(user);
        await fetchSessions(user);
      } catch (error) {
        console.error('Init failed:', error);
      }
    };
    initData();
  }, []);

  // Handle URL Params
  useEffect(() => {
    const type = searchParams.get('type');
    const rawId = searchParams.get('id');
    
    if (type && rawId && (type === 'friend' || type === 'group')) {
       const id = type === 'group' ? rawId : Number(rawId);
       
       setActiveChat(prev => {
          if (prev && prev.type === type && String(prev.id) === String(id)) {
             return prev;
          }
          return { type, id };
       });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!activeChat || !currentUser) return;

    // Special handling for "Self" chat (File Transfer Assistant)
    if (activeChat.type === 'friend' && String(activeChat.id) === String(currentUser.id)) {
      setSessionList(prev => {
        const exists = prev.find(s => s.type === 'friend' && String(s.friendId) === String(currentUser.id));
        if (exists) return prev;

        // Create a synthetic session for self
        const selfSession = {
          type: 'friend',
          friendId: currentUser.id,
          key: `f-${currentUser.id}`,
          unread: 0,
          lastAt: Date.now() / 1000,
          lastMessage: '',
          remark: currentUser.nickname || currentUser.username || '我',
          avatar: currentUser.avatar,
          isSelf: true // marker
        };
        return [selfSession, ...prev];
      });
    }
  }, [activeChat, currentUser]);

  useEffect(() => {
    const unsubscribe = onSessionsUpdated((meta) => {
      setSessionList(prev => prev.map(s => {
        const m = meta?.[s.key];
        if (!m) return s;
        return {
          ...s,
          unread: m.unread ?? s.unread,
          lastAt: m.lastAt ?? s.lastAt,
          lastMessage: m.lastMessage ?? s.lastMessage,
          lastSeq: m.lastSeq ?? s.lastSeq,
        };
      }));
    });
    return unsubscribe;
  }, []);

  const normalizeWsType = (type) => {
    if (!type) return type;
    if (type === 'message') return 'chat';
    if (type === 'group_message') return 'group_chat';
    if (type === 'group_join' || type === 'group_leave' || type === 'group_dismiss') return 'group_event';
    if (type === 'dismissGroup' || type === 'kickMember' || type === 'quitGroup' || type === 'joinGroup') return 'group_event';
    return type;
  };

  // WS Listener
  useEffect(() => {
    const handleWsMessage = (msg) => {
      if (!msg) return;
      if (msg.type === 'status') {
        setWsStatus(msg.status);
        return;
      }

      const normalizedType = normalizeWsType(msg.type);

      if (normalizedType === 'chat') {
        handlePrivateMessage(msg);
      } else if (normalizedType === 'group_chat') {
        handleGroupMessage(msg);
      } else if (normalizedType === 'offline_messages') {
        handleOfflineMessages(msg);
      } else if (normalizedType === 'read') {
        handleReadReceipt(msg);
      } else if (normalizedType === 'ack') {
        handleAck(msg);
      } else if (normalizedType === 'error') {
        const errorMsg = msg.data?.message || msg.message || '未知错误';
        message.error(errorMsg);
      } else if (normalizedType === 'group_event') {
        handleGroupEvent(msg);
      }
    };
    
    const unsubscribe = wsClient.subscribe(handleWsMessage);
    if (wsClient.isConnected) setWsStatus('connected');
    return unsubscribe;
  }, [activeChat, currentUser, blacklist]);

  const handlePrivateMessage = (msg) => {
    const data = msg.data || msg;
    const myId = String(currentUser?.id);
    const fromId = String(data.fromUserId || data.senderId);
    const toId = String(data.toUserId);
    const peerId = fromId === myId ? toId : fromId;

    if (fromId !== myId && blacklist.has(fromId)) {
      return;
    }

    if (activeChat?.type === 'friend' && String(activeChat.id) === String(peerId)) {
      upsertMessage(data, 'friend');
      messageApi.markRead(activeChat.id).catch(() => {});
      shouldScrollToBottomRef.current = true;
    }
  };

  const handleGroupMessage = (msg) => {
    const raw = msg.data || msg;
    const data = normalizeGroupMessage(raw);
    const groupIdStr = String(data.groupId);

    if (activeChat?.type === 'group' && String(activeChat.id) === groupIdStr) {
        const lastSeq = lastGroupSeqRef.current[groupIdStr] || 0;
        if (Number.isFinite(data?.seq) && lastSeq && data.seq > lastSeq + 1) {
          message.warning('群聊消息可能有丢失，已尝试刷新历史记录');
          // Best-effort: refresh recent history (具体缺失拉取取决于后端实现)
          messageApi.getGroupHistory(groupIdStr, 50).then((res) => {
            const list = Array.isArray(res) ? res : (res.list || []);
            setMessages(prev => sortMessages([...list, ...(prev || [])], 'group'));
          }).catch(() => {});
        }
        if (Number.isFinite(data?.seq)) lastGroupSeqRef.current[groupIdStr] = Math.max(lastSeq, data.seq);

        upsertMessage(data, 'group');
        ensureUsers([data.fromUserId]);
        shouldScrollToBottomRef.current = true;
    }
  };

  const handleOfflineMessages = (msg) => {
    const data = msg?.data || {};
    const list = Array.isArray(data.messages) ? data.messages : [];
    if (!activeChat || !currentUser || list.length === 0) return;

    const batchType = data.messageType;
    const activeType = activeChat.type;
    const activeId = activeChat.id;
    const matches = [];
    const userIds = new Set();
    let maxSeq = 0;
    let hasActiveFriend = false;

    list.forEach((item) => {
      if (!item) return;
      const isGroup = batchType === 'group' || item.groupId || item.type === 'group_chat';
      if (isGroup) {
        if (activeType !== 'group') return;
        if (String(item.groupId) !== String(activeId)) return;
        const normalized = normalizeGroupMessage(item);
        matches.push(normalized);
        if (normalized.fromUserId) userIds.add(normalized.fromUserId);
        if (Number.isFinite(normalized.seq)) maxSeq = Math.max(maxSeq, normalized.seq);
        return;
      }

      if (activeType !== 'friend') return;
      const fromId = String(item.fromUserId);
      if (fromId !== String(currentUser.id) && blacklist.has(fromId)) return;
      const peerId = fromId === String(currentUser.id) ? item.toUserId : item.fromUserId;
      if (String(peerId) !== String(activeId)) return;
      matches.push(item);
      if (item.fromUserId) userIds.add(item.fromUserId);
      hasActiveFriend = true;
    });

    if (!matches.length) return;

    matches.forEach((item) => upsertMessage(item, activeType));
    shouldScrollToBottomRef.current = true;

    if (activeType === 'group' && maxSeq) {
      const key = String(activeId);
      const lastSeq = lastGroupSeqRef.current[key] || 0;
      if (maxSeq > lastSeq) lastGroupSeqRef.current[key] = maxSeq;
    }

    if (userIds.size) ensureUsers(Array.from(userIds));
    if (hasActiveFriend) messageApi.markRead(activeId).catch(() => {});
  };

  const handleAck = (msg) => {
    const data = msg.data || {};
    const msgId = data.msgId;
    if (!msgId) return;

    // Handle failed ack with reason
    if (data.status === 'failed') {
      if (data.reason === 'muted') {
        message.error('您已被禁言，无法发送消息');
      } else if (data.reason === 'not_member') {
        message.error('您不是该群组成员');
      } else {
        // Only show generic error if we haven't received a specific error message via the 'error' type channel already
        // But since 'error' type usually comes with detailed message, we might rely on that. 
        // However, ACK failure is definitive for the message state.
        // Let's not double alert if reason is generic, but alert for specific known reasons.
      }
    }

    const key = String(msgId);
    const t = pendingAckTimersRef.current.get(key);
    if (t) clearTimeout(t);
    pendingAckTimersRef.current.delete(key);

    setMessages(prev => prev.map(m => {
      const id = m.msgId || m.id;
      if (!id || String(id) !== key) return m;
      return { ...m, localStatus: data.status || 'sent', ackAt: data.timestamp };
    }));
  };

  const handleReadReceipt = (msg) => {
    const data = msg?.data || {};
    const msgIds = Array.isArray(data.msgIds) ? data.msgIds : [];
    if (!msgIds.length) return;
    const idSet = new Set(msgIds.map((id) => String(id)));

    setMessages(prev => prev.map(m => {
      const id = m.msgId || m.id;
      if (!id || !idSet.has(String(id))) return m;
      return { ...m, localStatus: 'read', readBy: data.readBy, readAt: data.readAt };
    }));
  };

  const handleGroupEvent = (msg) => {
    const rawType = msg?.type;
    let eventType = msg?.eventType || msg?.data?.eventType;
    let eventData = msg?.eventData || msg?.data?.eventData || msg?.data || {};

    if (!eventType) {
      if (rawType === 'group_join') eventType = 'joinGroup';
      if (rawType === 'group_leave') eventType = 'quitGroup';
      if (rawType === 'group_dismiss') eventType = 'dismissGroup';
      if (rawType === 'dismissGroup' || rawType === 'kickMember' || rawType === 'quitGroup' || rawType === 'joinGroup') {
        eventType = rawType;
      }
    }

    const groupId = eventData?.groupId;
    const memberId = eventData?.memberId ?? eventData?.userId;
    const isSelf = memberId != null && String(memberId) === String(currentUser?.id);
    const isActiveGroup =
      groupId && activeChat?.type === 'group' && String(activeChat.id) === String(groupId);

    const removeGroupSession = () => {
      if (!groupId) return;
      setSessionList(prev => prev.filter(s => !(s.type === 'group' && String(s.groupId) === String(groupId))));
      updateSessionMeta(getGroupSessionKey(groupId), (prev) => ({ ...prev, unread: 0 }));
    };

    const exitActiveGroup = () => {
      if (!isActiveGroup) return;
      setActiveChat(null);
      navigate('/chat');
    };

    const removeMemberFromList = () => {
      if (!isActiveGroup || memberId == null) return;
      setGroupMembers(prev => prev.filter(m => String(m.userId) !== String(memberId)));
    };

    let shouldRefreshSessions = false;

    if (eventType === 'dismissGroup') {
      removeGroupSession();
      exitActiveGroup();
      shouldRefreshSessions = true;
    } else if (eventType === 'kickMember') {
      if (isSelf) {
        removeGroupSession();
        exitActiveGroup();
        shouldRefreshSessions = true;
      } else {
        removeMemberFromList();
      }
    } else if (eventType === 'quitGroup') {
      if (isSelf) {
        removeGroupSession();
        exitActiveGroup();
        shouldRefreshSessions = true;
      } else {
        removeMemberFromList();
      }
    } else if (eventType === 'joinGroup') {
      if (isSelf) {
        shouldRefreshSessions = true;
      } else {
      }
      if (isActiveGroup) fetchDetailInfo();
    }

    if (shouldRefreshSessions) fetchSessions();
  };

  useEffect(() => {
    if (!activeChat) return;

    setSessionList(prev => prev.map(s => {
      if (s.type === activeChat.type) {
         if (activeChat.type === 'friend' && s.friendId === activeChat.id) return { ...s, unread: 0 };
         if (activeChat.type === 'group' && s.groupId === activeChat.id) return { ...s, unread: 0 };
      }
      return s;
    }));

    const sessionKey = activeChat.type === 'friend'
      ? getFriendSessionKey(activeChat.id)
      : getGroupSessionKey(activeChat.id);
    updateSessionMeta(sessionKey, (prev) => ({ ...prev, unread: 0 }));

    const loadHistory = async () => {
      setLoadingHistory(true);
      setMessages([]);
      setHasMoreHistory(true);
      try {
        let res;
        if (activeChat.type === 'friend') {
           res = await messageApi.getHistory(activeChat.id, 50);
           await messageApi.markRead(activeChat.id);
        } else {
           res = await messageApi.getGroupHistory(activeChat.id, 50);
           groupApi.getMembers(activeChat.id, 1, 200).then((membersRes) => {
             const list = membersRes?.list || membersRes?.data?.list || membersRes || [];
             if (Array.isArray(list)) setGroupMembers(list);
           }).catch(() => {});
        }

        const rawHistory = Array.isArray(res) ? res : (res.list || []);
        const history = activeChat.type === 'group'
          ? rawHistory.map((item) => normalizeGroupMessage(item))
          : rawHistory;
        console.log('History fetched:', history.length, history);
        
        setMessages(prev => {
          const combined = [...history, ...(prev || [])];
          return sortMessages(combined, activeChat.type);
        });
        
        const sorted = sortMessages(history, activeChat.type); // Keep for seq calculation below
        setHasMoreHistory(history.length >= 50);
        
        if (activeChat.type === 'group') {
           ensureUsers(sorted.map(m => m.fromUserId));
           const maxSeq = sorted.reduce((max, m) => (Number.isFinite(m?.seq) ? Math.max(max, m.seq) : max), 0);
           if (maxSeq) lastGroupSeqRef.current[String(activeChat.id)] = maxSeq;
        }

        // Update session preview/time from the last message
        const last = sorted[sorted.length - 1];
        if (last) touchSession(activeChat.type, activeChat.id, last);

        shouldScrollToBottomRef.current = true;
      } catch (error) {
        console.error('Failed to load history:', error);
        
        const status = error.response?.status;
        // Handle 403 (Kicked), 404 (Not Found), 400 (Bad Request)
        if (status === 403 || status === 404 || status === 400) {
           const map = {
             403: '您已不再是该群组成员或无权访问',
             404: '群组/会话不存在',
             400: '请求无效',
           };
           message.warning(map[status] || '无法访问该会话');
           
           // Remove from session list locally
           setSessionList(prev => prev.filter(s => {
             if (activeChat.type === 'group') return !(s.type === 'group' && String(s.groupId) === String(activeChat.id));
             // For friend, maybe they deleted us? Keep it but clear chat.
             return true; 
           }));
           
           setActiveChat(null);
           navigate('/chat'); // Clear URL params
        }
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
    setIsDetailOpen(false); 
  }, [activeChat, ensureUsers, navigate]);

  useEffect(() => {
    if (!activeChat || activeChat.type !== 'group') return;
    const groupId = String(activeChat.id);
    const maxSeq = messages.reduce((max, m) => (Number.isFinite(m?.seq) ? Math.max(max, m.seq) : max), 0);
    if (!maxSeq) return;
    const lastSent = lastReadSeqRef.current[groupId] || 0;
    if (maxSeq <= lastSent) return;

    lastReadSeqRef.current[groupId] = maxSeq;
    groupApi.read(groupId, maxSeq).catch(() => {});
    updateSessionMeta(getGroupSessionKey(groupId), (prev) => ({
      ...prev,
      readSeq: Math.max(prev.readSeq || 0, maxSeq),
      lastSeq: Math.max(prev.lastSeq || 0, maxSeq),
    }));
  }, [activeChat, messages]);

  const loadMoreHistory = async () => {
    if (!activeChat || loadingMore || !hasMoreHistory) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const lastMsgId = oldest?.msgId || oldest?.id || null;
      let res;
      if (activeChat.type === 'friend') {
        res = await messageApi.getHistory(activeChat.id, 50, lastMsgId);
      } else {
        res = await messageApi.getGroupHistory(activeChat.id, 50, lastMsgId);
      }
      const list = Array.isArray(res) ? res : (res.list || []);
      if (list.length < 50) setHasMoreHistory(false);
      setMessages(prev => sortMessages([...list, ...(prev || [])], activeChat.type));
      if (activeChat.type === 'group') ensureUsers(list.map(m => m.fromUserId));
    } catch (e) {
      console.error('Load more failed', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !pendingAttachment) || !activeChat || !currentUser) return;
    
    // 1. Send Text if exists
    if (inputValue.trim()) {
      const content = inputValue;
      try {
          if (activeChat.type === 'friend') {
            if (blacklist.has(String(activeChat.id))) {
              message.error('该用户已被加入黑名单，无法发送消息');
              return;
            }
            const msgId = createClientMsgId();
          const msgData = { msgId, toUserId: Number(activeChat.id), content, contentType: 1 };
          const success = wsClient.send({ type: 'chat', data: msgData });
          if (success) {
            const optimisticMsg = { ...msgData, fromUserId: currentUser.id, createdAt: Date.now() / 1000, localStatus: 'sending' };
            touchSession(activeChat.type, activeChat.id, optimisticMsg);
            upsertMessage(optimisticMsg, 'friend');
            scheduleAckTimeout(msgId);
          } else {
             message.error('连接断开，正在尝试重连...');
             if (!wsClient.isConnected) wsClient.connect();
          }
        } else {
          const groupId = String(activeChat.id);
          let myMember = groupMembers.find(m => String(m.userId) === String(currentUser?.id));
          
          if (!myMember || (myMember?.mute === 1 || myMember?.muted === 1 || myMember?.isMuted === true)) {
             try {
               const latestMembers = await fetchDetailInfo();
               if (Array.isArray(latestMembers)) {
                  myMember = latestMembers.find(m => String(m.userId) === String(currentUser?.id));
               }
             } catch (e) {
               console.error('Failed to refresh members for mute check', e);
             }
          }
  
          const isMuted = myMember?.mute === 1 || myMember?.muted === 1 || myMember?.isMuted === true;
          if (isMuted) {
            message.warning('你已被禁言，无法发送消息');
            return;
          }
  
          const msgId = createClientMsgId();
          const atUserIds = getAtUserIdsFromContent(content);
          const effectiveRole = groupDetail?.role || myMember?.role || 3;
          const allowAtAll = effectiveRole === 1 || effectiveRole === 2;
          if (atUserIds.includes(-1) && !allowAtAll) {
            message.warning('Only owners/admins can @all.');
            return;
          }
          const msgData = {
            msgId,
            groupId: String(activeChat.id),
            content,
            contentType: 1,
            ...(atUserIds.length ? { atUserIds } : {}),
          };
          const success = wsClient.send({ type: 'group_chat', data: msgData });
          if (success) {
            const optimisticMsg = { ...msgData, fromUserId: currentUser.id, createdAt: Date.now() / 1000, localStatus: 'sending' };
            touchSession(activeChat.type, activeChat.id, optimisticMsg);
            upsertMessage(optimisticMsg, 'group');
            scheduleAckTimeout(msgId);
            setAtTargets([]);
          } else {
             message.error('连接断开，正在尝试重连...');
             if (!wsClient.isConnected) wsClient.connect();
          }
        }
        setInputValue('');
        setMentionOpen(false);
        setMentionQuery('');
        setMentionIndex(null);
        setMentionCursor(null);
        shouldScrollToBottomRef.current = true;
      } catch (e) {
        console.error('Send failed', e);
        message.error('发送失败');
      }
    }

    // 2. Send Attachment if exists
    if (pendingAttachment) {
       try {
         message.loading({ content: '发送附件中...', key: 'send_attach' });
         let content, contentType;
         
         if (pendingAttachment.type === 'image') {
            const res = await uploadApi.uploadImage(pendingAttachment.file);
            content = res.url || res.data?.url;
            contentType = 2;
         } else {
            const res = await uploadApi.uploadFile(pendingAttachment.file);
            const r = res.data || res;
            content = JSON.stringify({ url: r.url, filename: r.filename || pendingAttachment.name, size: r.size || pendingAttachment.size });
            contentType = 3;
         }
         
         await sendMediaMessage(content, contentType);
         message.success({ content: '发送成功', key: 'send_attach' });
         clearAttachment();
       } catch(e) {
         console.error(e);
         message.error({ content: '发送失败', key: 'send_attach' });
       }
    }
  };

  const handleCreateGroup = async (values) => {
    try {
      const payload = {
        name: values.name,
        description: values.description,
        avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=' + values.name
      };
      if (values.maxMembers) payload.maxMembers = Number(values.maxMembers);
      const res = await groupApi.create(payload);
      setIsCreateGroupModalOpen(false);
      createGroupForm.resetFields();
      message.success('创建成功');
      await fetchSessions();
      if (res && res.groupId) openChat('group', res.groupId);
    } catch (e) {
      console.error(e);
      message.error('创建失败');
    }
  };

  const handleInvite = async () => {
    if (!inviteFriendId || activeChat?.type !== 'group') return;
    try {
      // Use the new invitation API
      await groupApi.sendInvitation({
        groupId: String(activeChat.id),
        inviteeId: Number(inviteFriendId),
        message: inviteMessage
      });
      message.success('邀请已发送');
      setIsInviteOpen(false);
      setInviteFriendId(null);
      setInviteMessage('');
      // No need to refresh members immediately if it requires confirmation, 
      // but if mode is direct join (0), we might want to refresh.
      // For now, let's refresh anyway in case it was direct add.
      fetchDetailInfo();
    } catch (e) {
      console.error(e);
      message.error(e?.message || '邀请失败');
    }
  };

  const fetchDetailInfo = async () => {
    if (!activeChat) return;
    if (activeChat.type === 'group') {
      setLoadingDetail(true);
      try {
        const [detailRes, membersRes] = await Promise.all([
          groupApi.getDetails(activeChat.id),
          groupApi.getMembers(activeChat.id, 1, 200),
        ]);

        const detail = detailRes?.group || detailRes?.data || detailRes;
        setGroupDetail(detail || null);

        const list = membersRes?.list || membersRes?.data?.list || membersRes || [];
        setGroupMembers(Array.isArray(list) ? list : []);
        await ensureUsers((Array.isArray(list) ? list : []).map(m => m.userId).filter(Boolean));
        return list;
      } catch (e) {
        console.error('Failed to fetch group members');
        return [];
      } finally {
        setLoadingDetail(false);
      }
    }
    return [];
  };

  const openDetailDrawer = () => {
    fetchDetailInfo();
    setIsDetailOpen(true);
  };

  const roleLabel = (role) => {
    if (role === 1) return '群主';
    if (role === 2) return '管理员';
    return '成员';
  };

  const canManageMember = (myRole) => myRole === 1 || myRole === 2;

  const handleUpdateGroup = async () => {
    if (activeChat?.type !== 'group') return;
    try {
      const values = await editGroupForm.validateFields();
      
      const params = {
        groupId: String(activeChat.id),
      };
      if (values.name) params.name = values.name;
      if (values.avatar) params.avatar = values.avatar;
      if (values.description) params.description = values.description;
      if (values.maxMembers) params.maxMembers = Number(values.maxMembers);

      console.log('Updating group with params:', params);
      
      await groupApi.update(params);
      message.success('群资料已更新');
      setIsEditGroupOpen(false);
      fetchDetailInfo();
      fetchSessions();
    } catch (e) {
      if (e?.errorFields) return;
      console.error('Update group failed:', e);
      message.error('更新失败: ' + (e.message || '未知错误'));
    }
  };

  const getActiveInfo = () => {
    if (!activeChat) return null;
    if (activeChat.type === 'friend') {
      const u = getUser(activeChat.id);
      const rel = sessionList.find(s => s.type === 'friend' && s.friendId === activeChat.id);
      return {
        name: rel?.remark || u?.nickname || u?.username || '用户',
        avatar: u?.avatar,
        status: '',
        data: rel || u 
      };
    } else {
      const g = sessionList.find(s => s.type === 'group' && s.groupId === activeChat.id);
      return {
        name: g?.name || '未知群组',
        avatar: g?.avatar,
        status: `${g?.memberCount || 0} 成员`,
        data: g 
      };
    }
  };

  const openRemark = () => {
    if (!activeChat || activeChat.type !== 'friend') return;
    const rel = sessionList.find(s => s.type === 'friend' && s.friendId === activeChat.id);
    setRemarkTarget({ friendId: activeChat.id, remark: rel?.remark || '' });
    setRemarkOpen(true);
  };

  const submitRemark = async ({ remark }) => {
    if (!remarkTarget?.friendId) return;
    setRemarkSubmitting(true);
    try {
      await friendApi.updateRemark(remarkTarget.friendId, remark);
      message.success('备注已更新');
      setRemarkOpen(false);
      setRemarkTarget(null);
      await fetchSessions();
    } finally {
      setRemarkSubmitting(false);
    }
  };

  const activeInfo = getActiveInfo();
  const isActiveBlack = useMemo(() => {
    if (!activeChat || activeChat.type !== 'friend') return false;
    return blacklist.has(String(activeChat.id));
  }, [activeChat, blacklist]);

  // Search Add Menu
  const addMenu = (
    <List
      style={{ width: 140 }}
      dataSource={[
        { label: '发起群聊', icon: <PlusOutlined />, key: 'create_group', onClick: () => setIsCreateGroupModalOpen(true) },
        { label: '搜索用户', icon: <UserAddOutlined />, key: 'search_user', onClick: () => { setSearchTab('user'); setIsSearchOpen(true); } },
        { label: '搜索群组', icon: <TeamOutlined />, key: 'search_group', onClick: () => { setSearchTab('group'); setIsSearchOpen(true); } },
      ]}
      renderItem={item => (
        <List.Item 
          onClick={item.onClick}
          style={{ cursor: 'pointer', padding: '8px 12px', borderBottom: 'none', transition: 'background 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Space>
             {item.icon}
             <Text>{item.label}</Text>
          </Space>
        </List.Item>
      )}
    />
  );

  // Filtered Session List
  const filteredSessionList = sessionList.filter(item => {
    const isGroup = item.type === 'group';
    const id = isGroup ? item.groupId : item.friendId;
    const u = !isGroup ? getUser(id) : null;
    
    const name = isGroup ? item.name : (item.remark || u?.nickname || u?.username || '');
    const username = u?.username || '';
    const nickname = u?.nickname || '';
    const remark = item.remark || '';
    const lastMsg = item.lastMessage || '';
    
    const query = searchText.toLowerCase();
    
    return (
      name.toLowerCase().includes(query) || 
      lastMsg.toLowerCase().includes(query) ||
      (!isGroup && (
         username.toLowerCase().includes(query) || 
         nickname.toLowerCase().includes(query) || 
         remark.toLowerCase().includes(query)
      ))
    );
  }).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));

  const renderDetailContent = () => {
    if (!activeChat || !activeInfo) return null;
    
    if (activeChat.type === 'friend') {
      const u = getUser(activeChat.id);
      const isSelfChat = String(activeChat.id) === String(currentUser?.id);
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
           <div style={{ 
             background: '#fff', 
             borderRadius: 24, 
             padding: 32, 
             boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
             border: '1px solid #f1f5f9' 
           }}>
             <Avatar 
               src={u?.avatar} 
               size={120} 
               style={{ marginBottom: 20, border: '4px solid #fff', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }} 
             />
             <Title level={3} style={{ marginBottom: 4, color: '#1e293b' }}>{activeInfo.name}</Title>
             <Text type="secondary" style={{ fontSize: 16 }}>@{u?.username}</Text>
             
             <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
               {!isSelfChat && (
                 <Button
                   size="large"
                   block
                   icon={<EditOutlined />}
                   style={{ borderRadius: 12, height: 48 }}
                   onClick={openRemark}
                 >
                   修改备注
                 </Button>
               )}
               {!isSelfChat && (
                 <Button 
                   danger={!isActiveBlack} 
                   size="large" 
                   block 
                   icon={<StopOutlined />} 
                   style={{ borderRadius: 12, height: 48 }}
                   onClick={() => {
                     const shouldBlack = !isActiveBlack;
                     confirm({
                       title: shouldBlack ? '确认拉黑' : '取消拉黑',
                       icon: <ExclamationCircleOutlined />,
                       content: shouldBlack
                         ? '拉黑后将不再接收对方的消息，确认拉黑？'
                         : '取消拉黑后可重新接收对方消息，确认取消拉黑？',
                       okType: shouldBlack ? 'danger' : 'primary',
                       onOk: async () => {
                         try {
                           await friendApi.setBlacklist(activeChat.id, shouldBlack);
                           message.success(shouldBlack ? '已拉黑该用户' : '已取消拉黑');
                           setBlacklist(prev => {
                             const next = new Set(prev);
                             if (shouldBlack) {
                               next.add(String(activeChat.id));
                             } else {
                               next.delete(String(activeChat.id));
                             }
                             return next;
                           });
                         } catch (e) {
                           message.error('操作失败');
                         }
                       }
                     });
                   }}
                 >
                   {isActiveBlack ? '取消拉黑' : '加入黑名单'}
                 </Button>
               )}
               <Button 
                 danger 
                 size="large" 
                 block 
                 icon={<DeleteOutlined />} 
                 style={{ borderRadius: 12, height: 48 }}
               >
                 删除好友
               </Button>
             </div>
           </div>
        </div>
      );
    } else {
      const g = groupDetail || activeInfo.data || {};
      const sortedMembers = sortGroupMembers(groupMembers);
      const myMember = sortedMembers.find(m => String(m.userId) === String(currentUser?.id));
      const myRole = g?.role || myMember?.role || 3;
      const isOwner = myRole === 1;
      const canManage = canManageMember(myRole);

      return (
        <div style={{ padding: '20px' }}>
          {/* Header Info */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: 24, 
            padding: '24px', 
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            border: '1px solid #f1f5f9'
          }}>
            <Avatar
              shape="square"
              src={g?.avatar}
              size={88}
              icon={<TeamOutlined />}
              style={{ borderRadius: 20, marginBottom: 16, border: '1px solid #f1f5f9' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Title level={4} style={{ margin: 0, color: '#0f172a' }}>{g?.name || '群聊'}</Title>
                <Tag color={myRole === 1 ? 'gold' : myRole === 2 ? 'blue' : 'default'} bordered={false} style={{ margin: 0 }}>
                  {roleLabel(myRole)}
                </Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>ID: {g?.groupId || activeChat.id}</Text>
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
               <div style={{ background: '#f8fafc', padding: '6px 16px', borderRadius: 20 }}>
                 <Text type="secondary" style={{ fontSize: 12 }}>
                   <TeamOutlined style={{ marginRight: 6 }} />
                   {groupMembers.length || g?.memberCount || 0} 成员
                 </Text>
               </div>
               {Number.isFinite(g?.maxMembers) && (
                 <div style={{ background: '#f8fafc', padding: '6px 16px', borderRadius: 20 }}>
                   <Text type="secondary" style={{ fontSize: 12 }}>上限 {g.maxMembers}</Text>
                 </div>
               )}
            </div>

            {g?.description && (
              <div style={{ marginTop: 20, padding: '12px 16px', background: '#f8fafc', borderRadius: 12, fontSize: 13, color: '#475569', textAlign: 'left', lineHeight: 1.6 }}>
                {g.description}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            <Button 
              type="primary" 
              size="large" 
              icon={<UserAddOutlined />} 
              onClick={() => setIsInviteOpen(true)} 
              style={{ 
                borderRadius: 12, 
                height: 44, 
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)',
                width: '100%'
              }}
            >
              邀请好友
            </Button>
            
            {canManage && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Button 
                  size="large" 
                  onClick={() => setIsGroupRequestsOpen(true)} 
                  style={{ borderRadius: 12, height: 44 }}
                >
                  入群申请
                </Button>
                <Button
                  size="large"
                  icon={<EditOutlined />}
                  onClick={() => {
                    editGroupForm.setFieldsValue({
                      name: g?.name,
                      avatar: g?.avatar,
                      description: g?.description,
                      maxMembers: g?.maxMembers,
                    });
                    setIsEditGroupOpen(true);
                  }}
                  style={{ borderRadius: 12, height: 44 }}
                >
                  设置
                </Button>
              </div>
            )}
          </div>

          {/* Members List */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
               <Text strong style={{ fontSize: 16, color: '#334155' }}>成员列表</Text>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedMembers.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无成员数据" />
              ) : (
                sortedMembers.slice(0, 50).map((m) => { // Limit render for perf, maybe add pagination later if needed
                  const memberId = m.userId;
                  const u = getUser(memberId);
                  const isSelf = String(memberId) === String(currentUser?.id);
                  const isMuted = m.mute === 1 || m.muted === 1 || m.isMuted === true;
                  const memberRole = m.role || 3;

                  const items = [
                    canManage && !isSelf && { key: 'kick', label: '踢出群', danger: true },
                    canManage && !isSelf && { key: isMuted ? 'unmute' : 'mute', label: isMuted ? '解除禁言' : '设为禁言' },
                    isOwner && !isSelf && { type: 'divider' },
                    isOwner && !isSelf && { key: 'set_admin', label: '设为管理员' },
                    isOwner && !isSelf && { key: 'set_member', label: '设为普通成员' },
                  ].filter(Boolean);

                  return (
                    <div
                      key={memberId}
                      style={{ 
                        padding: '10px 12px', 
                        background: '#fff',
                        borderRadius: 12,
                        border: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#f1f5f9'; }}
                      onClick={() => setProfileUserId(memberId)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                         <Avatar src={u?.avatar} icon={<UserOutlined />} style={{ border: '1px solid #f1f5f9', flexShrink: 0 }} />
                         <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                               <Text style={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }} ellipsis>
                                 {u?.nickname || u?.username || `User ${memberId}`}
                               </Text>
                               {memberRole === 1 && <Tag color="gold" style={{ margin: 0, padding: '0 6px', fontSize: 10, lineHeight: '18px', borderRadius: 10, border: 'none', flexShrink: 0 }}>群主</Tag>}
                               {memberRole === 2 && <Tag color="blue" style={{ margin: 0, padding: '0 6px', fontSize: 10, lineHeight: '18px', borderRadius: 10, border: 'none', flexShrink: 0 }}>管理员</Tag>}
                            </div>
                            {isMuted && <Text type="danger" style={{ fontSize: 11 }}>已禁言</Text>}
                         </div>
                      </div>

                      {items.length > 0 && (
                        <Dropdown
                           menu={{
                             items,
                             onClick: async ({ key, domEvent }) => {
                               domEvent.stopPropagation();
                               try {
                                 if (key === 'kick') {
                                   Modal.confirm({
                                     title: '踢出成员',
                                     icon: <ExclamationCircleOutlined />,
                                     content: `确认将 ${u?.nickname || memberId} 踢出群组？`,
                                     onOk: async () => {
                                       try {
                                          await groupApi.kick(String(activeChat.id), memberId);
                                          message.success('已踢出');
                                          setGroupMembers(prev => prev.filter(m => String(m.userId) !== String(memberId)));
                                          setTimeout(fetchDetailInfo, 300);
                                       } catch (e) {
                                          console.error(e);
                                          message.error('踢出失败');
                                       }
                                     },
                                   });
                                 } else if (key === 'mute' || key === 'unmute') {
                                   await groupApi.mute(String(activeChat.id), memberId, key === 'mute' ? 1 : 0);
                                   message.success(key === 'mute' ? '已禁言' : '已解除禁言');
                                   fetchDetailInfo();
                                 } else if (key === 'set_admin') {
                                   await groupApi.role(String(activeChat.id), memberId, 2);
                                   message.success('已设为管理员');
                                   fetchDetailInfo();
                                 } else if (key === 'set_member') {
                                   await groupApi.role(String(activeChat.id), memberId, 3);
                                   message.success('已设为普通成员');
                                   fetchDetailInfo();
                                 }
                               } catch (e) {
                                 console.error(e);
                                 message.error('操作失败');
                               }
                             }
                           }}
                           trigger={['click']}
                         >
                           <Button type="text" size="small" icon={<MoreOutlined style={{ fontSize: 16, color: '#94a3b8' }} />} onClick={(e) => e.stopPropagation()} />
                         </Dropdown>
                      )}
                    </div>
                  );
                })
              )}
              {sortedMembers.length > 50 && (
                <div style={{ textAlign: 'center', padding: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>仅显示前 50 名成员</Text>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ marginTop: 32 }}>
            <Button 
              danger 
              block 
              size="large"
              icon={<LogoutOutlined />}
              style={{ borderRadius: 12, height: 48, background: '#fff' }}
              onClick={() => {
                const isDismiss = isOwner;
                const action = isDismiss ? groupApi.dismiss : groupApi.quit;
                const text = isDismiss ? '解散群组' : '退出群组';
                confirm({
                  title: text,
                  icon: <ExclamationCircleOutlined />,
                  content: isDismiss ? '解散后所有成员将被移出，无法撤销，确认解散？' : '确认退出该群聊？',
                  okType: 'danger',
                  onOk: async () => {
                    try {
                      await action(String(activeChat.id));
                      message.success(isDismiss ? '群组已解散' : '已退出群组');
                      setSessionList(prev => prev.filter(s => !(s.type === 'group' && String(s.groupId) === String(activeChat.id))));
                      setActiveChat(null);
                      setIsDetailOpen(false);
                      setTimeout(() => fetchSessions(), 500);
                    } catch (e) {
                       console.error(e);
                       message.error('操作失败: ' + (e.message || '未知错误'));
                    }
                  }
                });
              }}
            >
              {isOwner ? '解散群组' : '退出群组'}
            </Button>
          </div>

          <Modal
            title="编辑群资料"
            open={isEditGroupOpen}
            onCancel={() => setIsEditGroupOpen(false)}
            onOk={handleUpdateGroup}
            okText="保存"
            destroyOnClose
          >
            <Form form={editGroupForm} layout="vertical">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                 <Form.Item noStyle shouldUpdate={(prev, curr) => prev.avatar !== curr.avatar}>
                   {({ getFieldValue }) => (
                     <div style={{ position: 'relative', display: 'inline-block' }}>
                        <Avatar 
                          shape="square" 
                          size={100} 
                          src={getFieldValue('avatar')} 
                          icon={<TeamOutlined />} 
                          style={{ border: '1px solid #f0f0f0' }}
                        />
                        <Upload
                           showUploadList={false}
                           accept="image/*"
                           customRequest={async ({ file, onSuccess, onError }) => {
                              try {
                                 message.loading({ content: '上传中...', key: 'upload_avatar' });
                                 const res = await uploadApi.uploadAvatar(file);
                                 const url = res.url || res.data?.url;
                                 editGroupForm.setFieldsValue({ avatar: url });
                                 onSuccess(res);
                                 message.success({ content: '头像上传成功', key: 'upload_avatar' });
                              } catch(e) {
                                 onError(e);
                                 message.error({ content: '上传失败', key: 'upload_avatar' });
                              }
                           }}
                        >
                           <Button 
                             shape="circle" 
                             icon={<UploadOutlined />} 
                             size="small"
                             style={{ position: 'absolute', bottom: -10, right: -10, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} 
                           />
                        </Upload>
                     </div>
                   )}
                 </Form.Item>
              </div>

              <Form.Item name="name" label="群名称" rules={[{ required: true, message: '请输入群名称' }]}>
                <Input placeholder="请输入群名称" maxLength={30} showCount />
              </Form.Item>
              
              <Form.Item name="avatar" label="群头像URL" hidden>
                <Input />
              </Form.Item>

              <Form.Item name="description" label="群描述">
                <Input.TextArea placeholder="介绍一下这个群..." autoSize={{ minRows: 3, maxRows: 6 }} maxLength={200} showCount />
              </Form.Item>
              <Form.Item name="maxMembers" label="最大人数">
                <InputNumber min={2} max={2000} placeholder="默认 200" style={{ width: '100%' }} />
              </Form.Item>
            </Form>
          </Modal>
        </div>
      );
    }
  };

  return (
    <MainLayout pageTitle="消息">
      <Layout style={{ height: 'calc(100vh - 100px)', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Sider width={280} theme="light" style={{ borderRight: '1px solid rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(0,0,0,0.03)', display: 'flex', gap: 8 }}>
            <GlobalSearchBox
              popupMatchSelectWidth={250}
              style={{ flex: 1 }}
              value={searchText}
              onChange={handleGlobalSearch}
              onSelect={onGlobalSelect}
            />
            <Dropdown dropdownRender={() => <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>{addMenu}</div>} trigger={['click']}>
              <Button icon={<PlusOutlined />} shape="circle" style={{ flexShrink: 0 }} />
            </Dropdown>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <List
              dataSource={filteredSessionList}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无结果" /> }}
              renderItem={item => {
                const isGroup = item.type === 'group';
                const id = isGroup ? item.groupId : item.friendId;
                const isActive = activeChat?.type === item.type && activeChat?.id === id;
                const u = !isGroup ? getUser(id) : null;
                
                return (
                  <div style={{ padding: '4px 8px' }}>
                    <div 
                      onClick={() => openChat(item.type, id)}
                      style={{ 
                        padding: '12px 12px', 
                        cursor: 'pointer',
                        background: isActive ? '#e0f2fe' : 'transparent',
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = '#f1f5f9')}
                      onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = 'transparent')}
                    >
                       <Badge count={item.unread} size="small" offset={[-4, 4]}>
                         <Avatar 
                           shape={isGroup ? "square" : "circle"} 
                           src={isGroup ? item.avatar : (u?.avatar || item.avatar)} 
                           icon={isGroup ? <TeamOutlined /> : <UserOutlined />}
                           size={40}
                           style={{ flexShrink: 0, border: '1px solid rgba(0,0,0,0.05)' }}
                         />
                       </Badge>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                             <Text strong style={{ fontSize: 15, color: isActive ? '#0284c7' : '#1e293b' }} ellipsis>
                               {isGroup ? item.name : (item.remark || u?.nickname || u?.username)}
                             </Text>
                             <Text type="secondary" style={{ fontSize: 11 }}>
                               {formatSessionTime(item.lastAt)}
                             </Text>
                          </div>
                          <Text type="secondary" style={{ fontSize: 13, color: isActive ? '#38bdf8' : '#64748b' }} ellipsis>
                             {item.lastMessage || (isGroup ? '点击进入群聊' : '查看消息...')}
                          </Text>
                       </div>
                    </div>
                  </div>
                );
              }}
            />
          </div>
        </Sider>
        
        <Content style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
          {activeChat ? (
            <>
              {/* Header */}
              <div style={{ 
                padding: '0 24px', 
                height: 72,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                background: '#fff',
                borderBottom: '1px solid rgba(0,0,0,0.03)'
              }}>
                <Space size={12}>
                  <Text strong style={{ fontSize: 18, color: '#0f172a' }}>{activeInfo?.name}</Text>
                  {activeChat?.type === 'group' && (
                    <Tag color="blue" style={{ marginInlineStart: 0 }}>
                      {activeInfo?.status}
                    </Tag>
                  )}
                </Space>
                <Space>
                  <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 20 }} />} onClick={() => setIsAtMeOpen(true)} />
                  <Button type="text" shape="circle" icon={<SearchOutlined style={{ fontSize: 20 }} />} onClick={() => setIsSearchMessageOpen(true)} />
                  <Button type="text" shape="circle" icon={<MoreOutlined style={{ fontSize: 20 }} />} onClick={openDetailDrawer} /> 
                </Space>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }}>
                {loadingHistory ? (
                   <div style={{ textAlign: 'center', marginTop: 40 }}><Spin /></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ textAlign: 'center' }}>
                      <Button type="text" size="small" loading={loadingMore} disabled={!hasMoreHistory} onClick={loadMoreHistory}>
                        {hasMoreHistory ? '加载更多' : '没有更多了'}
                      </Button>
                    </div>
                    {messages.map((msg, index) => {
                      const isMe = String(msg.fromUserId) === String(currentUser?.id);
                      const sender = activeChat.type === 'group' && !isMe ? getUser(msg.fromUserId) : null;
                      const statusText = isMe
                        ? (msg.localStatus === 'delivered' ? '对方已收' : msg.localStatus === 'sent' ? '已发送' : msg.localStatus === 'sending' ? '发送中' : msg.localStatus === 'failed' ? '发送失败' : '')
                        : '';
                      const hasAt = Array.isArray(msg.atUserIds) && msg.atUserIds.length > 0;
                      const isAtMeMsg = !!msg.isAtMe;
                      const highlightAt = !isMe && isAtMeMsg;
                      const bubbleBg = msg.contentType === 2 ? 'transparent' : (isMe ? token.colorPrimary : (highlightAt ? '#fff7ed' : '#ffffff'));
                      const bubbleBorder = msg.contentType === 2 ? 'none' : (isMe ? 'none' : (highlightAt ? '1px solid #fdba74' : '1px solid rgba(0,0,0,0.02)'));
                      
                      return (
                        <div key={msg.msgId || msg.id || index} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                           <div style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 12, maxWidth: '75%' }}>
                              <Avatar 
                                src={isMe ? currentUser?.avatar : (sender?.avatar || activeInfo?.avatar)} 
                                size={36} 
                                style={{ marginTop: 2, border: '1px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                                icon={<UserOutlined />}
                              />
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                {sender && (
                                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 2, marginBottom: 4 }}>
                                    {sender.nickname || sender.username}
                                  </Text>
                                )}
                                {(hasAt || isAtMeMsg) && (
                                  <div style={{ marginBottom: 4 }}>
                                    {isAtMeMsg ? <Tag color="orange">@me</Tag> : <Tag color="blue">@</Tag>}
                                  </div>
                                )}
                                <div style={{
                                  padding: msg.contentType === 2 ? '4px' : '12px 16px',
                                  background: bubbleBg,
                                  color: isMe ? '#ffffff' : '#1e293b',
                                  borderRadius: isMe ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
                                  boxShadow: msg.contentType === 2 ? 'none' : (isMe 
                                    ? '0 4px 12px rgba(14, 165, 233, 0.25)' 
                                    : '0 2px 8px rgba(0, 0, 0, 0.04)'),
                                  fontSize: 15,
                                  lineHeight: '1.6',
                                  wordBreak: 'break-word',
                                  border: bubbleBorder
                                }}>
                                  {msg.contentType === 2 ? (
                                     <Image 
                                       src={msg.content} 
                                       width={200}
                                       style={{ borderRadius: 12 }} 
                                       onLoad={() => {
                                          // Only auto-scroll if this is the last message
                                          if (index >= messages.length - 1) scrollToBottom();
                                       }}
                                     />
                                  ) : msg.contentType === 3 ? (
                                     (() => {
                                        let f = {};
                                        try { f = JSON.parse(msg.content); } catch(e){}
                                        return (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 }}>
                                             <Avatar shape="square" icon={<FileOutlined />} style={{ background: isMe ? 'rgba(255,255,255,0.2)' : '#f0f0f0', color: isMe ? '#fff' : '#666' }} />
                                             <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <Text style={{ color: isMe ? '#fff' : '#333', display: 'block', fontSize: 14 }} ellipsis>{f.filename || '文件'}</Text>
                                                <Text style={{ color: isMe ? 'rgba(255,255,255,0.7)' : '#999', fontSize: 12 }}>
                                                   {f.size ? (f.size / 1024 < 1024 ? (f.size/1024).toFixed(1)+' KB' : (f.size/1024/1024).toFixed(2)+' MB') : 'Unknown'}
                                                </Text>
                                             </div>
                                             <a href={f.url} target="_blank" rel="noreferrer" style={{ color: isMe ? '#fff' : token.colorPrimary }} download>
                                                <CloudDownloadOutlined style={{ fontSize: 20 }} />
                                             </a>
                                          </div>
                                        );
                                     })()
                                  ) : (
                                     msg.content
                                  )}
                                </div>
                                <Text type="secondary" style={{ fontSize: 10, marginTop: 6, opacity: 0.7 }}>
                                  {formatTime(msg.createdAt)}{statusText ? ` · ${statusText}` : ''}
                                </Text>
                              </div>
                           </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{ padding: '24px', background: '#fff', borderTop: '1px solid rgba(0,0,0,0.03)' }}>
                <div style={{ 
                  background: '#f8fafc', 
                  borderRadius: 16, 
                  padding: '8px 16px',
                  border: '1px solid #f1f5f9',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'all 0.2s'
                }}>
                  {pendingAttachment && (
                    <div style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {pendingAttachment.type === 'image' ? (
                             <Image src={pendingAttachment.preview} height={60} style={{ borderRadius: 8 }} />
                          ) : (
                             <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                <FileOutlined style={{ fontSize: 24, color: '#64748b' }} />
                                <div>
                                   <Text strong style={{ display: 'block', fontSize: 13 }}>{pendingAttachment.name}</Text>
                                   <Text type="secondary" style={{ fontSize: 11 }}>{(pendingAttachment.size / 1024).toFixed(1)} KB</Text>
                                </div>
                             </div>
                          )}
                       </div>
                       <Button type="text" icon={<CloseOutlined />} onClick={clearAttachment} danger />
                    </div>
                  )}
                  <Space style={{ marginLeft: -8 }} size={4}>
                    <Tooltip title="图片">
                      <Button type="text" icon={<PictureOutlined style={{ color: '#64748b' }} />} size="small" onClick={() => imageInputRef.current?.click()} />
                    </Tooltip>
                    <Tooltip title="文件">
                      <Button type="text" icon={<PaperClipOutlined style={{ color: '#64748b' }} />} size="small" onClick={() => fileInputRef.current?.click()} />
                    </Tooltip>
                    <input 
                       type="file" 
                       accept="image/*" 
                       ref={imageInputRef} 
                       style={{ display: 'none' }} 
                       onChange={handleImageSelect}
                    />
                    <input 
                       type="file" 
                       ref={fileInputRef} 
                       style={{ display: 'none' }} 
                       onChange={handleFileSelect}
                    />
                  </Space>
                  <div style={{ position: 'relative' }}>
                    {mentionOpen && mentionCandidates.length > 0 && (
                      <div style={{ position: 'absolute', left: 0, bottom: '100%', marginBottom: 8, background: '#fff', borderRadius: 10, boxShadow: '0 10px 24px rgba(0,0,0,0.12)', width: 260, maxHeight: 240, overflowY: 'auto', zIndex: 20 }}>
                        <List
                          dataSource={mentionCandidates}
                          renderItem={(item) => (
                            <List.Item
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleMentionPick(item)}
                              style={{ cursor: 'pointer', padding: '6px 12px' }}
                            >
                              <Space size={10}>
                                {item.id === -1 ? (
                                  <Avatar size="small" style={{ background: '#fef3c7', color: '#92400e' }}>@</Avatar>
                                ) : (
                                  <Avatar src={item.avatar} size="small" icon={<UserOutlined />} />
                                )}
                                <div>
                                  <Text strong>{item.id === -1 ? '@all' : `@${item.label}`}</Text>
                                  {item.username ? (
                                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                                      @{item.username}
                                    </Text>
                                  ) : null}
                                </div>
                              </Space>
                            </List.Item>
                          )}
                        />
                      </div>
                    )}
                    <TextArea 
                      ref={inputRef}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={e => {
                        if (e.key === 'Escape' && mentionOpen) {
                          e.preventDefault();
                          setMentionOpen(false);
                          return;
                        }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={isActiveBlack ? '已加入黑名单，无法发送消息' : 'Enter a message...'}
                      autoSize={{ minRows: 2, maxRows: 6 }}
                      bordered={false}
                      disabled={isActiveBlack}
                      style={{ padding: 0, resize: 'none', background: 'transparent' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                     <Button 
                       type="primary" 
                       icon={<SendOutlined />} 
                       onClick={handleSendMessage}
                       style={{ borderRadius: 20, paddingLeft: 20, paddingRight: 20, boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)' }}
                       disabled={isActiveBlack || (!inputValue.trim() && !pendingAttachment)}
                     >
                       发送
                     </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
               <div style={{ textAlign: 'center', opacity: 0.5 }}>
                 <div style={{ 
                    width: 120, height: 120, background: '#e0f2fe', borderRadius: '50%', margin: '0 auto 24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                 }}>
                   <MessageOutlined style={{ fontSize: 56, color: '#0ea5e9' }} />
                 </div>
                 <Title level={4} style={{ color: '#334155' }}>欢迎使用 翱翔SkyeIM</Title>
                 <Text style={{ color: '#64748b' }}>从左侧列表选择好友或群组开始聊天</Text>
               </div>
            </div>
          )}
        </Content>
      </Layout>
      
      {/* Details Drawer */}
      <Drawer
        title="详细信息"
        placement="right"
        onClose={() => setIsDetailOpen(false)}
        open={isDetailOpen}
        width={320}
      >
        {renderDetailContent()}
      </Drawer>

      {/* Message Search Drawer */}
      <Drawer
        title="搜索聊天记录"
        placement="right"
        onClose={() => setIsSearchMessageOpen(false)}
        open={isSearchMessageOpen}
        width={320}
      >
        <Input.Search 
          placeholder="输入关键词" 
          value={searchMessageKeyword}
          onChange={e => setSearchMessageKeyword(e.target.value)}
          onSearch={handleSearchMessages}
          loading={searchingMessage}
          enterButton
          style={{ marginBottom: 16 }}
        />
        <List
          loading={searchingMessage}
          dataSource={searchMessageResult}
          renderItem={item => {
             const u = getUser(item.fromUserId);
             const name = u?.nickname || u?.username || item.senderName || item.fromUserId;
             return (
              <List.Item>
                 <List.Item.Meta
                   title={name}
                   description={
                     <div>
                       <div dangerouslySetInnerHTML={{ __html: (item.content || '').replace(new RegExp(`(${searchMessageKeyword})`, 'gi'), (match) => `<span style="color: #f50">${match}</span>`) }} />
                       <Text type="secondary" style={{ fontSize: 10 }}>{formatTime(item.createdAt)}</Text>
                     </div>
                   }
                 />
              </List.Item>
             );
          }}
        />
      </Drawer>
      {/* @Me Drawer */}
      <Drawer
        title="@ Me"
        placement="right"
        onClose={() => setIsAtMeOpen(false)}
        open={isAtMeOpen}
        width={360}
      >
        <List
          loading={atMeLoading}
          dataSource={atMeList}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No @me messages." /> }}
          renderItem={(item) => {
            const sender = getUser(item.fromUserId);
            const groupName = groupNameMap[String(item.groupId)] || item.groupId;
            const preview = item.contentType === 2 ? '[Image]' : item.contentType === 3 ? '[File]' : item.content;
            return (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setIsAtMeOpen(false);
                  navigate(`/chat?type=group&id=${item.groupId}`);
                }}
              >
                <List.Item.Meta
                  avatar={<Avatar src={sender?.avatar} icon={<UserOutlined />} />}
                  title={
                    <Space size={6}>
                      <Text strong>{sender?.nickname || sender?.username || item.fromUserId}</Text>
                      <Tag color="orange">@me</Tag>
                      <Tag>{groupName}</Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <Text>{preview}</Text>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {formatTime(item.createdAt)}
                        </Text>
                      </div>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
        {atMeHasMore && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Button onClick={() => loadAtMeMessages(false)} loading={atMeLoading}>
              Load more
            </Button>
          </div>
        )}
      </Drawer>

      {/* Modals */}
      <SearchAddModal open={isSearchOpen} onCancel={() => setIsSearchOpen(false)} initialTab={searchTab} />
      
      <Modal
        title="创建群组"
        open={isCreateGroupModalOpen}
        onCancel={() => setIsCreateGroupModalOpen(false)}
        onOk={() => createGroupForm.submit()}
      >
        <Form form={createGroupForm} onFinish={handleCreateGroup} layout="vertical">
          <Form.Item name="name" label="群名称" rules={[{ required: true, message: '请输入群名称' }]}>
            <Input placeholder="例如：技术交流群" />
          </Form.Item>
          <Form.Item name="description" label="群描述">
            <TextArea placeholder="介绍一下这个群..." />
          </Form.Item>
          <Form.Item name="maxMembers" label="最大人数">
            <InputNumber min={2} max={2000} placeholder="默认 200" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="邀请好友入群"
        open={isInviteOpen}
        onCancel={() => setIsInviteOpen(false)}
        onOk={handleInvite}
        okButtonProps={{ disabled: !inviteFriendId }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>选择好友</Text>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
            <List
              dataSource={friendsList.filter(f => !groupMembers.some(m => m.userId === f.friendId))}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可邀请的好友" /> }}
              pagination={false}
              renderItem={item => {
                const u = getUser(item.friendId);
                const isSelected = inviteFriendId === item.friendId;
                return (
                  <List.Item 
                    onClick={() => setInviteFriendId(item.friendId)}
                    style={{ 
                      cursor: 'pointer', 
                      background: isSelected ? '#e0f2fe' : 'transparent',
                      padding: '8px 12px',
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background 0.2s'
                    }}
                  >
                    <List.Item.Meta
                      avatar={<Avatar src={u?.avatar} icon={<UserOutlined />} size="small" />}
                      title={<Text style={{ fontSize: 13 }}>{item.remark || u?.nickname || u?.username}</Text>}
                    />
                    {isSelected && <Tag color="blue" style={{ marginRight: 0 }}>已选</Tag>}
                  </List.Item>
                );
              }}
            />
          </div>
        </div>
        
        <div>
           <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>邀请留言（可选）</Text>
           <Input.TextArea 
              placeholder="来一起聊天吧..." 
              value={inviteMessage}
              onChange={e => setInviteMessage(e.target.value)}
              maxLength={50}
              showCount
              autoSize={{ minRows: 2, maxRows: 3 }}
           />
        </div>
      </Modal>

      <GroupRequestsModal
        open={isGroupRequestsOpen}
        onCancel={() => setIsGroupRequestsOpen(false)}
        groupId={activeChat?.type === 'group' ? String(activeChat.id) : null}
        groupName={activeInfo?.name}
      />

      <RemarkEditModal
        open={remarkOpen}
        initialRemark={remarkTarget?.remark || ''}
        submitting={remarkSubmitting}
        onCancel={() => {
          setRemarkOpen(false);
          setRemarkTarget(null);
        }}
        onSubmit={submitRemark}
      />

      <UserProfileModal
        open={!!profileUserId}
        userId={profileUserId}
        currentUserId={currentUser?.id}
        onClose={() => setProfileUserId(null)}
        onSendMessage={(user) => {
          setProfileUserId(null);
          setIsDetailOpen(false); // Close drawer as well
          // Switch to friend chat (even if it is self)
          openChat('friend', user.id);
          // If needed, we might want to ensure this session exists in list
          // But setActiveChat usually handles loading history which creates ad-hoc session view
        }}
      />
    </MainLayout>
  );
};

export default Chat;




