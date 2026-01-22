import React, { useEffect, useState } from 'react';
import { Badge, Empty, List, Space, Tabs, Typography, message, Radio, Avatar } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import FriendRequestCard from '../components/friend/FriendRequestCard';
import GroupInvitationCard from '../components/friend/GroupInvitationCard';
import GroupJoinRequestCard from '../components/group/GroupJoinRequestCard';
import GroupEventCard from '../components/group/GroupEventCard';
import { friendApi } from '../api/friend';
import { groupApi } from '../api/group';
import { updateNotificationCounts } from '../utils/notificationStore';
import { loadReadStatus, markAsRead } from '../utils/notificationReadStore';
import { loadGroupEvents, onGroupEventsUpdated, markGroupEventsRead, getUnreadGroupEventCount } from '../utils/groupEventStore';
import useUserCache from '../hooks/useUserCache';

const { Title, Text } = Typography;

const formatEventTime = (timestamp) => {
  if (!timestamp || Number.isNaN(Number(timestamp))) return '-';
  const date = new Date(Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return '-';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const FriendRequests = () => {
  const navigate = useNavigate();
  const { getUser, ensureUsers } = useUserCache();

  // mainTab: 'friend' | 'group' | 'join' | 'group_event'
  const [mainTab, setMainTab] = useState('friend');
  // subTab: 'received' | 'sent'
  const [subTab, setSubTab] = useState('received');

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [workingRequestId, setWorkingRequestId] = useState(null);

  const [groupCache, setGroupCache] = useState({});
  const [badgeCounts, setBadgeCounts] = useState({
    friendReceived: 0,
    friendSent: 0,
    groupReceived: 0,
    groupSent: 0,
    joinReceived: 0,
    joinSent: 0,
    groupEvent: 0
  });
  const [groupEvents, setGroupEvents] = useState([]);

  const getPendingItems = (res) => {
    if (!res) return [];
    const list = Array.isArray(res)
      ? res
      : Array.isArray(res.list)
        ? res.list
        : Array.isArray(res.data?.list)
          ? res.data.list
          : [];
    return list.filter((item) => Number(item?.status) === 0);
  };

  const checkActiveGroups = async (items) => {
    if (!items.length) return 0;
    // Extract unique group IDs
    const groupIds = [...new Set(items.map(it => it.groupId).filter(Boolean))];
    if (!groupIds.length) return items.length;

    try {
      // Check cache first or fetch
      const activeGroupIds = new Set();
      await Promise.all(groupIds.map(async (gid) => {
        const sid = String(gid);
        // If cached and status is 2, it's inactive except if we fetch again?
        // Safer to just fetch or use cache if explicitly known status
        // For accuracy, we might want to fetch, but let's check cache first if available
        // Actually, let's fetch to be sure, or leverage fetchGroupDetails logic?
        // Simple fetch for now.
        try {
          const res = await groupApi.getDetails(gid);
          const info = res?.group || res?.data || res;
          if (info && info.status !== 2) {
            activeGroupIds.add(sid);
          }
        } catch (e) {
          // If fetch fails, assume active or handle error? Assume active to avoid missing notifications?
          // OR assume inactive? Let's assume active if error is network, but assume inactive if 404.
          // For now, let's just log and add to active (conservative).
          console.warn('Check group status failed', gid, e);
          activeGroupIds.add(sid);
        }
      }));

      return items.filter(it => activeGroupIds.has(String(it.groupId))).length;
    } catch {
      return items.length;
    }
  };

  const getProcessedItems = (res) => {
    if (!res) return [];
    const list = Array.isArray(res)
      ? res
      : Array.isArray(res.list)
        ? res.list
        : Array.isArray(res.data?.list)
          ? res.data.list
          : [];
    // Status 1 = accepted, 2 = rejected
    return list.filter((item) => Number(item?.status) === 1 || Number(item?.status) === 2);
  };

  const refreshBadgeCounts = async () => {
    try {
      // Fetch both received (pending) and sent (processed) requests/invitations
      const [
        friendReceivedRes,
        friendSentRes,
        groupReceivedRes,
        groupSentRes,
        joinReceivedRes,
        joinSentRes
      ] = await Promise.all([
        friendApi.getReceivedRequests(1, 200).catch(() => null),
        friendApi.getSentRequests(1, 200).catch(() => null),
        groupApi.getReceivedInvitations(1, 200).catch(() => null),
        groupApi.getSentInvitations(1, 200).catch(() => null),
        groupApi.getReceivedJoinRequests(1, 200).catch(() => null),
        groupApi.getSentJoinRequests(1, 200).catch(() => null),
      ]);

      // Load read status
      const readStatus = loadReadStatus();

      // For friend requests: pending received + unread processed sent
      const friendReceivedPending = getPendingItems(friendReceivedRes);
      const friendSentProcessed = getProcessedItems(friendSentRes).filter(
        item => !readStatus.friendSent.includes(item.id)
      );

      // For group invitations: pending received + unread processed sent (filter out dismissed groups)
      const groupReceivedPending = getPendingItems(groupReceivedRes);
      const groupSentProcessed = getProcessedItems(groupSentRes).filter(
        item => !readStatus.groupSent.includes(item.id)
      );

      const [groupReceivedCount, groupSentCount] = await Promise.all([
        checkActiveGroups(groupReceivedPending),
        checkActiveGroups(groupSentProcessed)
      ]);

      // For join requests: pending received + unread processed sent (filter out dismissed groups)
      const joinReceivedPending = getPendingItems(joinReceivedRes);
      const joinSentProcessed = getProcessedItems(joinSentRes).filter(
        item => !readStatus.joinSent.includes(item.id)
      );

      const [joinReceivedCount, joinSentCount] = await Promise.all([
        checkActiveGroups(joinReceivedPending),
        checkActiveGroups(joinSentProcessed)
      ]);

      const groupEventCount = getUnreadGroupEventCount();
      const next = {
        friendReceived: friendReceivedPending.length,
        friendSent: friendSentProcessed.length,
        groupReceived: groupReceivedCount,
        groupSent: groupSentCount,
        joinReceived: joinReceivedCount,
        joinSent: joinSentCount,
        groupEvent: groupEventCount,
      };
      setBadgeCounts(next);

      // For MainLayout notification count, use totals
      const totalFriend = next.friendReceived + next.friendSent;
      const totalGroup = next.groupReceived + next.groupSent;
      const totalJoin = next.joinReceived + next.joinSent;
      updateNotificationCounts({ friend: totalFriend, group: totalGroup, joinReceived: totalJoin, groupEvent: groupEventCount });
    } catch (e) {
      console.error('Refresh badges failed', e);
    }
  };

  const fetchGroupDetails = async (items) => {
    const ids = new Set();
    items.forEach(item => {
      if (item.groupId) ids.add(String(item.groupId));
    });

    const missingIds = Array.from(ids).filter(id => !groupCache[id]);
    if (missingIds.length === 0) return;

    try {
      const results = await Promise.all(missingIds.map(id => groupApi.getDetails(id).catch(() => null)));

      setGroupCache(prev => {
        const next = { ...prev };
        results.forEach((res, index) => {
          const id = missingIds[index];
          const info = res?.group || res?.data || res;
          if (info && info.groupId) {
            next[String(info.groupId)] = info;
          } else {
            // Cache failed lookups to prevent retries (stale local storage data)
            next[String(id)] = { 
              groupId: id, 
              name: '未知群组(已失效)', 
              status: 2, 
              avatar: null,
              description: '该群组可能已被解散或数据已过期'
            };
          }
        });
        return next;
      });
    } catch (e) {
      console.error('Failed to fetch group details', e);
    }
  };

  const loadGroupEventsState = async (markRead = false) => {
    try {
      const events = loadGroupEvents();
      let nextEvents = events;

      if (markRead && events.some((event) => !event.read)) {
        markGroupEventsRead();
        nextEvents = events.map((event) => ({ ...event, read: true }));
      }

      setGroupEvents(nextEvents);

      const unreadCount = nextEvents.filter((event) => !event?.read).length;
      setBadgeCounts((prev) => ({ ...prev, groupEvent: unreadCount }));
      updateNotificationCounts({ groupEvent: unreadCount });

      const userIds = new Set();
      const groupIds = new Set();
      nextEvents.forEach((event) => {
        const data = event?.eventData || {};
        const groupId = event?.groupId || data.groupId;
        if (groupId) groupIds.add(String(groupId));
        const memberId = data.memberId ?? data.userId;
        const operatorId = data.operatorId;
        if (memberId != null) userIds.add(memberId);
        if (operatorId != null) userIds.add(operatorId);
      });

      if (userIds.size) await ensureUsers(Array.from(userIds));
      if (groupIds.size) {
        await fetchGroupDetails(Array.from(groupIds).map((id) => ({ groupId: id })));
      }
    } catch (e) {
      console.error('Load group events failed', e);
    }
  };

  const load = async (mTab = mainTab, sTab = subTab, p = page) => {
    setLoading(true);
    setList([]); // Clear list immediately to prevent stale data on error
    setTotal(0);
    try {
      let data;
      if (mTab === 'friend') {
        data = sTab === 'received'
          ? await friendApi.getReceivedRequests(p, pageSize)
          : await friendApi.getSentRequests(p, pageSize);
      } else if (mTab === 'group') {
        data = sTab === 'received'
          ? await groupApi.getReceivedInvitations(p, pageSize)
          : await groupApi.getSentInvitations(p, pageSize);
      } else if (mTab === 'join') {
        data = sTab === 'received'
          ? await groupApi.getReceivedJoinRequests(p, pageSize)
          : await groupApi.getSentJoinRequests(p, pageSize);
      }

      let items = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        items = data;
        totalCount = data.length;
      } else if (data && Array.isArray(data.list)) {
        items = data.list;
        totalCount = Number(data.total || data.totalCount || items.length);
      } else if (data && data.data && Array.isArray(data.data.list)) {
        items = data.data.list;
        totalCount = Number(data.data.total || items.length);
      }

      // Filter out invitations from join requests (backend might return mixed data)
      if (mTab === 'join') {
        items = items.filter(item => !item.inviterId);
      }

      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setList(items);
      setTotal(totalCount);

      if (items.length > 0) {
        let ids = [];
        if (mTab === 'friend') {
          ids = sTab === 'received' ? items.map((it) => it.fromUserId) : items.map((it) => it.toUserId);
        } else if (mTab === 'group') {
          const inviters = items.map(it => it.inviterId);
          const invitees = items.map(it => it.inviteeId);
          ids = [...new Set([...inviters, ...invitees])];
        } else if (mTab === 'join') {
          if (sTab === 'received') {
            // For received join requests, we need the applicant's info
            ids = items.map(it => it.userId).filter(id => id > 0);
          } else {
            // For sent join requests, we need the handler's info
            ids = items.map(it => it.handlerId).filter(id => id > 0);
          }
        }
        if (ids.length) await ensureUsers(ids);

        if (mTab === 'group' || mTab === 'join') {
          await fetchGroupDetails(items);
        }
      }

      // Mark as read when viewing sent processed items
      if (sTab === 'sent' && items.length > 0) {
        const processedIds = items
          .filter(item => Number(item?.status) === 1 || Number(item?.status) === 2)
          .map(item => item.id);

        if (processedIds.length > 0) {
          markAsRead(mTab, processedIds);
          // Refresh badge counts to update the UI
          setTimeout(() => refreshBadgeCounts(), 100);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(mainTab, subTab, page);
    refreshBadgeCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, subTab, page]);

  useEffect(() => {
    void loadGroupEventsState(mainTab === 'group_event');
  }, [mainTab]);

  useEffect(() => {
    const unsub = onGroupEventsUpdated(() => {
      void loadGroupEventsState(mainTab === 'group_event');
    });
    return unsub;
  }, [mainTab]);
  const action = async (item, act) => {
    setWorkingRequestId(item.id);
    try {
      if (mainTab === 'friend') {
        await friendApi.handleRequest(item.id, act);
      } else if (mainTab === 'group') {
        await groupApi.handleInvitation({ invitationId: item.id, action: act });
      } else if (mainTab === 'join') {
        await groupApi.handleJoinRequest({ requestId: item.id, action: act });
      }
      message.success(act === 1 ? '已同意' : '已拒绝');
      if (subTab === 'received' && Number(item?.status) === 0) {
        setBadgeCounts((prev) => {
          const next = { ...prev };
          if (mainTab === 'friend') next.friend = Math.max(0, (prev.friend || 0) - 1);
          if (mainTab === 'group') next.group = Math.max(0, (prev.group || 0) - 1);
          if (mainTab === 'join') next.joinReceived = Math.max(0, (prev.joinReceived || 0) - 1);
          updateNotificationCounts({ friend: next.friend, group: next.group, joinReceived: next.joinReceived });
          return next;
        });
      }
      await load(mainTab, subTab, page);
      refreshBadgeCounts();
    } catch (e) {
      console.error(e);
      message.error('操作失败');
    } finally {
      setWorkingRequestId(null);
    }
  };

  const handleEnterGroup = (groupId) => {
    if (!groupId) return;
    navigate(`/chat?type=group&id=${groupId}`);
  };

  const renderGroupEventItem = (event) => {
    const data = event?.eventData || {};
    const groupId = event?.groupId || data.groupId;
    const memberId = data.memberId ?? data.userId;
    const operatorId = data.operatorId;
    
    const userMap = {};
    if (memberId) userMap[memberId] = getUser(memberId);
    if (operatorId) userMap[operatorId] = getUser(operatorId);

    return (
      <List.Item style={{ padding: 0, border: 'none' }}>
        <div style={{ width: '100%' }}>
          <GroupEventCard 
            event={event}
            groupInfo={groupCache[String(groupId)]}
            userMap={userMap}
            onClickGroup={handleEnterGroup}
          />
        </div>
      </List.Item>
    );
  };

  const renderItem = (item) => {
    if (mainTab === 'friend') {
      const uid = subTab === 'received' ? item.fromUserId : item.toUserId;
      const user = getUser(uid);
      return (
        <FriendRequestCard
          request={item}
          user={user}
          mode={subTab}
          working={workingRequestId === item.id}
          onAccept={() => action(item, 1)}
          onReject={() => action(item, 2)}
        />
      );
    } else if (mainTab === 'group') {
      const uid = subTab === 'received' ? item.inviterId : item.inviteeId;
      const user = getUser(uid);
      const groupInfo = groupCache[String(item.groupId)];
      const invitationWithGroup = groupInfo ? {
        ...item,
        groupName: groupInfo.name || item.groupName,
        groupAvatar: groupInfo.avatar || item.groupAvatar
      } : item;

      return (
        <GroupInvitationCard
          invitation={invitationWithGroup}
          user={user}
          mode={subTab}
          groupStatus={groupInfo?.status}
          working={workingRequestId === item.id}
          onAccept={() => action(item, 1)}
          onReject={() => action(item, 2)}
          onEnterGroup={() => handleEnterGroup(item.groupId)}
        />
      );
    } else if (mainTab === 'join') {
      const isReceived = subTab === 'received';
      const groupInfo = groupCache[String(item.groupId)];
      const user = isReceived ? getUser(item.userId) : null;
      return (
        <GroupJoinRequestCard
          request={item}
          user={user}
          group={groupInfo}
          mode={subTab}
          working={workingRequestId === item.id}
          onAccept={isReceived ? () => action(item, 1) : undefined}
          onReject={isReceived ? () => action(item, 2) : undefined}
          onEnterGroup={() => handleEnterGroup(item.groupId)}
        />
      );
    }
  };

  return (
    <MainLayout pageTitle="通知中心">
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ marginBottom: 24, textAlign: 'center', paddingTop: 16 }}>
          <Title level={2} style={{ margin: '0 0 8px 0', fontSize: 28 }}>
            通知中心
          </Title>
          <Text type="secondary" style={{ fontSize: 16 }}>好友申请 · 群组邀请 · 入群申请 · 群组变更</Text>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: 24,
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          minHeight: 400
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
            <Tabs
              activeKey={mainTab}
              onChange={(k) => {
                setMainTab(k);
                setPage(1);
              }}
              items={[
                {
                  key: 'friend',
                  label: (
                    <Space size={6}>
                      <span>好友申请</span>
                      {(badgeCounts.friendReceived + badgeCounts.friendSent) > 0 ?
                        <Badge count={badgeCounts.friendReceived + badgeCounts.friendSent} size="small" /> : null}
                    </Space>
                  )
                },
                {
                  key: 'group',
                  label: (
                    <Space size={6}>
                      <span>群组邀请</span>
                      {(badgeCounts.groupReceived + badgeCounts.groupSent) > 0 ?
                        <Badge count={badgeCounts.groupReceived + badgeCounts.groupSent} size="small" /> : null}
                    </Space>
                  )
                },
                {
                  key: 'join',
                  label: (
                    <Space size={6}>
                      <span>入群申请</span>
                      {(badgeCounts.joinReceived + badgeCounts.joinSent) > 0 ?
                        <Badge count={badgeCounts.joinReceived + badgeCounts.joinSent} size="small" /> : null}
                    </Space>
                  )
                },
                {
                  key: 'group_event',
                  label: (
                    <Space size={6}>
                      <span>群组变更</span>
                      {badgeCounts.groupEvent > 0 ?
                        <Badge count={badgeCounts.groupEvent} size="small" /> : null}
                    </Space>
                  )
                },
              ]}
              size="large"
              centered
              style={{ width: '100%', marginBottom: 16 }}
              tabBarStyle={{ borderBottom: '1px solid #f1f5f9' }}
            />

            {mainTab !== 'group_event' && (
              <Radio.Group
              value={subTab}
              onChange={e => {
                setSubTab(e.target.value);
                setPage(1);
              }}
              buttonStyle="solid"
              size="middle"
              style={{ marginBottom: 8 }}
            >
              <Radio.Button value="received">
                {mainTab === 'friend' || mainTab === 'group' || mainTab === 'join' ? (
                  <Badge
                    count={
                      mainTab === 'friend' ? badgeCounts.friendReceived :
                        mainTab === 'group' ? badgeCounts.groupReceived :
                          badgeCounts.joinReceived
                    }
                    size="small"
                    offset={[6, -2]}
                  >
                    <span>收到的</span>
                  </Badge>
                ) : (
                  '收到的'
                )}
              </Radio.Button>
              <Radio.Button value="sent">
                {mainTab === 'friend' || mainTab === 'group' || mainTab === 'join' ? (
                  <Badge
                    count={
                      mainTab === 'friend' ? badgeCounts.friendSent :
                        mainTab === 'group' ? badgeCounts.groupSent :
                          badgeCounts.joinSent
                    }
                    size="small"
                    offset={[6, -2]}
                  >
                    <span>发出的</span>
                  </Badge>
                ) : (
                  '发出的'
                )}
              </Radio.Button>
                </Radio.Group>
            )}
          </div>

          <List
            loading={loading}
            dataSource={mainTab === 'group_event' ? groupEvents : list}
            rowKey="id"
            locale={{
              emptyText: (
                <Empty
                  description={mainTab === 'group_event' ? '暂无群组变更通知' : '暂无通知'}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
            split={false}
            pagination={
              mainTab === 'group_event'
                ? false
                : {
                    current: page,
                    pageSize,
                    total,
                    hideOnSinglePage: true,
                    onChange: (p) => setPage(p),
                    style: { textAlign: 'center', marginTop: 24 },
                  }
            }
            renderItem={(item) =>
              mainTab === 'group_event' ? (
                renderGroupEventItem(item)
              ) : (
                <List.Item style={{ padding: 0 }}>
                  <div style={{ width: '100%' }}>
                    {renderItem(item)}
                  </div>
                </List.Item>
              )
            }
          />
        </div>
        <div style={{ height: 40 }} />
      </div>
    </MainLayout>
  );
};

export default FriendRequests;










