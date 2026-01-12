import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, List, Space, Tabs, Typography, message, Radio } from 'antd';
import MainLayout from '../components/MainLayout';
import FriendRequestCard from '../components/friend/FriendRequestCard';
import GroupInvitationCard from '../components/friend/GroupInvitationCard';
import { friendApi } from '../api/friend';
import { groupApi } from '../api/group';
import useUserCache from '../hooks/useUserCache';

const { Title, Text } = Typography;

const FriendRequests = () => {
  const { getUser, ensureUsers } = useUserCache();

  // mainTab: 'friend' | 'group'
  const [mainTab, setMainTab] = useState('friend');
  // subTab: 'received' | 'sent'
  const [subTab, setSubTab] = useState('received');
  
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [workingRequestId, setWorkingRequestId] = useState(null);

  const load = async (mTab = mainTab, sTab = subTab, p = page) => {
    setLoading(true);
    try {
      let data;
      if (mTab === 'friend') {
        data = sTab === 'received'
          ? await friendApi.getReceivedRequests(p, pageSize)
          : await friendApi.getSentRequests(p, pageSize);
      } else {
        data = sTab === 'received'
            ? await groupApi.getReceivedInvitations(p, pageSize)
            : await groupApi.getSentInvitations(p, pageSize);
      }
      
      console.log('FriendRequests load data:', { mTab, sTab, data });

      // Handle various response structures:
      // 1. { list: [...], total: N } (Standard)
      // 2. [...] (Direct array)
      // 3. { data: { list: [...] } } (Nested, though interceptor usually handles this)
      let items = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        items = data;
        totalCount = data.length;
      } else if (data && Array.isArray(data.list)) {
        items = data.list;
        totalCount = Number(data.total || data.totalCount || items.length);
      } else if (data && data.data && Array.isArray(data.data.list)) {
         // Just in case interceptor didn't unwrap completely or structure is deep
         items = data.data.list;
         totalCount = Number(data.data.total || items.length);
      }

      console.log('Processed items:', items);
      setList(items);
      setTotal(totalCount);

      // Cache users
      if (items.length > 0) {
        let ids = [];
        if (mTab === 'friend') {
             ids = sTab === 'received' ? items.map((it) => it.fromUserId) : items.map((it) => it.toUserId);
        } else {
             // For group invitations, cache inviter and invitee
             const inviters = items.map(it => it.inviterId);
             const invitees = items.map(it => it.inviteeId);
             ids = [...new Set([...inviters, ...invitees])];
        }
        await ensureUsers(ids);
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
      } else {
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
      } else {
        // Group Invitation
        // We can pass user objects if needed, but currently card handles display mostly from item data
        // For 'Received', we might want to show Inviter info.
        // For 'Sent', we might want to show Invitee info.
        const uid = subTab === 'received' ? item.inviterId : item.inviteeId;
        const user = getUser(uid);
        return (
            <GroupInvitationCard
              invitation={item}
              user={user}
              mode={subTab}
              working={workingRequestId === item.id}
              onAccept={() => action(item, 1)}
              onReject={() => action(item, 2)}
            />
        );
      }
  };

  return (
    <MainLayout pageTitle="通知中心">
      <div style={{ marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          通知中心
        </Title>
        <Text type="secondary">查看好友申请和群组邀请。</Text>
      </div>

      <Card style={{ borderRadius: 16 }}>
        <Tabs
            activeKey={mainTab}
            onChange={(k) => {
                setMainTab(k);
                setPage(1);
            }}
            items={[
                { key: 'friend', label: '好友申请' },
                { key: 'group', label: '群组邀请' },
            ]}
            style={{ marginBottom: 16 }}
        />

        <div style={{ marginBottom: 16 }}>
            <Radio.Group 
                value={subTab} 
                onChange={e => {
                    setSubTab(e.target.value);
                    setPage(1);
                }}
                buttonStyle="solid"
            >
                <Radio.Button value="received">收到的</Radio.Button>
                <Radio.Button value="sent">发出的</Radio.Button>
            </Radio.Group>
        </div>

        <List
          loading={loading}
          dataSource={list}
          locale={{ emptyText: <Empty description="暂无通知" /> }}
          split={false}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
            style: { marginTop: 16 },
          }}
          renderItem={(item) => (
              <List.Item style={{ padding: 0, marginBottom: 12 }}>
                  {renderItem(item)}
              </List.Item>
          )}
        />

        <Space style={{ height: 4 }} />
      </Card>
    </MainLayout>
  );
};

export default FriendRequests;

