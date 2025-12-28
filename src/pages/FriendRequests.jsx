import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, List, Space, Tabs, Typography, message } from 'antd';
import MainLayout from '../components/MainLayout';
import FriendRequestCard from '../components/friend/FriendRequestCard';
import { friendApi } from '../api/friend';
import useUserCache from '../hooks/useUserCache';

const { Title, Text } = Typography;

const FriendRequests = () => {
  const { getUser, ensureUsers } = useUserCache();

  const [tab, setTab] = useState('received');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [workingRequestId, setWorkingRequestId] = useState(null);

  const load = async (activeTab = tab, p = page) => {
    setLoading(true);
    try {
      const data =
        activeTab === 'received'
          ? await friendApi.getReceivedRequests(p, pageSize)
          : await friendApi.getSentRequests(p, pageSize);

      const items = Array.isArray(data?.list) ? data.list : [];
      setList(items);
      setTotal(Number(data?.total || 0));

      const ids =
        activeTab === 'received' ? items.map((it) => it.fromUserId) : items.map((it) => it.toUserId);
      await ensureUsers(ids);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);

  const action = async (requestId, act) => {
    setWorkingRequestId(requestId);
    try {
      await friendApi.handleRequest(requestId, act);
      message.success(act === 1 ? '已同意' : '已拒绝');
      await load(tab, page);
    } finally {
      setWorkingRequestId(null);
    }
  };

  const tabs = useMemo(
    () => [
      {
        key: 'received',
        label: '收到的申请',
      },
      {
        key: 'sent',
        label: '发出的申请',
      },
    ],
    []
  );

  return (
    <MainLayout pageTitle="好友申请">
      <div style={{ marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          好友申请
        </Title>
        <Text type="secondary">处理收到的申请，查看发出的申请状态。</Text>
      </div>

      <Card style={{ borderRadius: 16 }}>
        <Tabs
          activeKey={tab}
          onChange={(k) => {
            setTab(k);
            setPage(1);
          }}
          items={tabs}
        />

        <List
          loading={loading}
          dataSource={list}
          locale={{ emptyText: <Empty description="暂无申请" /> }}
          split={false}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
            style: { marginTop: 16 },
          }}
          renderItem={(req) => {
            const uid = tab === 'received' ? req.fromUserId : req.toUserId;
            const user = getUser(uid);
            return (
              <List.Item style={{ padding: 0, marginBottom: 12 }}>
                <FriendRequestCard
                  request={req}
                  user={user}
                  mode={tab}
                  working={workingRequestId === req.id}
                  onAccept={() => action(req.id, 1)}
                  onReject={() => action(req.id, 2)}
                />
              </List.Item>
            );
          }}
        />

        <Space style={{ height: 4 }} />
      </Card>
    </MainLayout>
  );
};

export default FriendRequests;

