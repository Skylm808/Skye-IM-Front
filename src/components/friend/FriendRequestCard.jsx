import React, { useMemo } from 'react';
import { Avatar, Button, Card, Space, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, UserOutlined } from '@ant-design/icons';

const { Text } = Typography;

const formatCreatedAt = (createdAt) => {
  if (!createdAt || Number.isNaN(Number(createdAt))) return '-';
  return new Date(Number(createdAt) * 1000).toLocaleString();
};

const statusMeta = (status) => {
  if (status === 1) return { color: 'green', text: '已同意' };
  if (status === 2) return { color: 'red', text: '已拒绝' };
  return { color: 'blue', text: '待处理' };
};

const FriendRequestCard = ({ request, user, mode, onAccept, onReject, working }) => {
  const meta = statusMeta(request?.status);

  const displayName = useMemo(() => {
    return user?.nickname || user?.username || `用户#${mode === 'received' ? request?.fromUserId : request?.toUserId}`;
  }, [user?.nickname, user?.username, request?.fromUserId, request?.toUserId, mode]);

  const subtitle = useMemo(() => {
    if (!user) return '用户信息加载中...';
    return user.username ? `@${user.username}` : '';
  }, [user]);

  const pending = request?.status === 0;
  const showActions = mode === 'received' && pending;

  return (
    <Card
      size="small"
      styles={{ body: { padding: 14 } }}
      style={{
        borderRadius: 16,
        border: '1px solid rgba(5, 5, 5, 0.06)',
        background: pending ? 'linear-gradient(180deg, rgba(0, 97, 255, 0.06), #fff 60%)' : '#fff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <Space size={12} align="start">
          <Avatar size={44} src={user?.avatar} icon={<UserOutlined />} />
          <Space direction="vertical" size={4}>
            <Space size={8} wrap>
              <Text strong style={{ fontSize: 15 }}>
                {displayName}
              </Text>
              <Tag color={meta.color}>{meta.text}</Tag>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {subtitle}
            </Text>
            <Text style={{ whiteSpace: 'pre-wrap' }}>{request?.message || <Text type="secondary">（无验证消息）</Text>}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              时间：{formatCreatedAt(request?.createdAt)}
            </Text>
          </Space>
        </Space>

        {showActions ? (
          <Space>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={onAccept}
              loading={working}
              disabled={working}
            >
              同意
            </Button>
            <Button
              danger
              icon={<CloseOutlined />}
              onClick={onReject}
              loading={working}
              disabled={working}
            >
              拒绝
            </Button>
          </Space>
        ) : (
          <Space direction="vertical" size={4} style={{ alignItems: 'flex-end' }}>
            {mode === 'sent' && pending ? <Text type="secondary">等待对方处理</Text> : null}
            {mode === 'received' && !pending ? <Text type="secondary">已处理</Text> : null}
          </Space>
        )}
      </div>
    </Card>
  );
};

export default FriendRequestCard;

