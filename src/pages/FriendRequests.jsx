import React, { useEffect, useState } from 'react';
import { Empty, List, Space, Tabs, Typography, message, Radio } from 'antd';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import FriendRequestCard from '../components/friend/FriendRequestCard';
import GroupInvitationCard from '../components/friend/GroupInvitationCard';
import GroupJoinRequestCard from '../components/group/GroupJoinRequestCard';
import { friendApi } from '../api/friend';
import { groupApi } from '../api/group';
import useUserCache from '../hooks/useUserCache';

const { Title, Text } = Typography;

const FriendRequests = () => {
  const navigate = useNavigate();
  const { getUser, ensureUsers } = useUserCache();

  // mainTab: 'friend' | 'group' | 'join_request'
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
             }
        });
        return next;
      });
    } catch (e) {
      console.error('Failed to fetch group details', e);
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
      } else if (mTab === 'join_request') {
        data = await groupApi.getSentJoinRequests(p, pageSize);
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
      if (mTab === 'join_request') {
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
        } else if (mTab === 'join_request') {
             ids = items.map(it => it.handlerId).filter(id => id > 0);
        }
        if (ids.length) await ensureUsers(ids);

        if (mTab === 'group' || mTab === 'join_request') {
           await fetchGroupDetails(items);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(mainTab, subTab, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, subTab, page]);

  const action = async (item, act) => {
    setWorkingRequestId(item.id);
    try {
      if (mainTab === 'friend') {
          await friendApi.handleRequest(item.id, act);
      } else if (mainTab === 'group') {
          await groupApi.handleInvitation({ invitationId: item.id, action: act });
      }
      message.success(act === 1 ? '已同意' : '已拒绝');
      await load(mainTab, subTab, page);
    } catch(e) {
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
              working={workingRequestId === item.id}
              onAccept={() => action(item, 1)}
              onReject={() => action(item, 2)}
              onEnterGroup={() => handleEnterGroup(item.groupId)}
            />
        );
      } else if (mainTab === 'join_request') {
        const groupInfo = groupCache[String(item.groupId)];
        return (
          <GroupJoinRequestCard
            request={item}
            group={groupInfo} 
            mode="sent"
            working={false}
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
          <Text type="secondary" style={{ fontSize: 16 }}>好友申请 · 群组邀请 · 入群申请</Text>
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
                    { key: 'friend', label: '好友申请' },
                    { key: 'group', label: '群组邀请' },
                    { key: 'join_request', label: '我的入群申请' },
                ]}
                size="large"
                centered
                style={{ width: '100%', marginBottom: 16 }}
                tabBarStyle={{ borderBottom: '1px solid #f1f5f9' }}
            />

            {mainTab !== 'join_request' && (
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
                  <Radio.Button value="received">收到的</Radio.Button>
                  <Radio.Button value="sent">发出的</Radio.Button>
              </Radio.Group>
            )}
          </div>

          <List
            loading={loading}
            dataSource={list}
            rowKey="id"
            locale={{ emptyText: <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            split={false}
            pagination={{
              current: page,
              pageSize,
              total,
              hideOnSinglePage: true,
              onChange: (p) => setPage(p),
              style: { textAlign: 'center', marginTop: 24 },
            }}
            renderItem={(item) => (
                <List.Item style={{ padding: 0 }}>
                    <div style={{ width: '100%' }}>
                      {renderItem(item)}
                    </div>
                </List.Item>
            )}
          />
        </div>
        <div style={{ height: 40 }} />
      </div>
    </MainLayout>
  );
};

export default FriendRequests;
