import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Descriptions, Modal, Result, Skeleton, Space, Tag, Typography } from 'antd';
import { UserOutlined, MessageOutlined } from '@ant-design/icons';
import { getUserById } from '../api/user';

const { Text } = Typography;

const GENDER_MAP = {
  0: '未知',
  1: '男',
  2: '女',
};

const normalizeUser = (data) => (data && data.user ? data.user : data);

const formatCreatedAt = (createdAt) => {
  if (!createdAt || Number.isNaN(Number(createdAt))) return '-';
  return new Date(Number(createdAt) * 1000).toLocaleString();
};

const UserProfileModal = ({ open, userId, currentUserId, onClose, onSendMessage }) => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  const title = useMemo(() => {
    if (!user) return '用户资料';
    return user.nickname ? `${user.nickname}（${user.username}）` : user.username;
  }, [user]);

  const isSelf = String(userId) === String(currentUserId);

  useEffect(() => {
    if (!open || !userId) return;
    let canceled = false;
    (async () => {
      setLoading(true);
      setError('');
      setUser(null);
      try {
        const data = await getUserById(userId);
        if (canceled) return;
        setUser(normalizeUser(data));
      } catch (e) {
        if (canceled) return;
        setError(e?.message || '加载失败');
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [open, userId]);

  return (
    <Modal 
      title={title} 
      open={open} 
      onCancel={onClose} 
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>关闭</Button>
          {user && onSendMessage && (
            <Button 
              type="primary" 
              icon={<MessageOutlined />} 
              onClick={() => onSendMessage(user)}
            >
              {isSelf ? '发消息给自己' : '发消息'}
            </Button>
          )}
        </div>
      }
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : error ? (
        <Result status="error" title="加载失败" subTitle={error} />
      ) : !user ? (
        <Text type="secondary">暂无数据</Text>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space>
            <Avatar size={56} src={user.avatar} icon={<UserOutlined />} />
            <Space direction="vertical" size={2}>
              <Text strong style={{ fontSize: 16 }}>
                {user.nickname || user.username}
              </Text>
              <Text type="secondary">@{user.username}</Text>
            </Space>
            <Tag color={user.status === 1 ? 'green' : 'red'}>{user.status === 1 ? '正常' : '禁用'}</Tag>
          </Space>

          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="用户 ID">{user.id}</Descriptions.Item>
            <Descriptions.Item label="个性签名">{user.signature || '-'}</Descriptions.Item>
            <Descriptions.Item label="性别">{GENDER_MAP[user.gender] || '未知'}</Descriptions.Item>
            <Descriptions.Item label="地区">{user.region || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{user.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="电话">{user.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="注册时间">{formatCreatedAt(user.createdAt)}</Descriptions.Item>
          </Descriptions>
        </Space>
      )}
    </Modal>
  );
};

export default UserProfileModal;

