import React, { useMemo } from 'react';
import { Avatar, Button, Space, Tag, Typography, theme } from 'antd';
import { CheckOutlined, CloseOutlined, UserOutlined } from '@ant-design/icons';

const { Text } = Typography;

const formatCreatedAt = (createdAt) => {
  if (!createdAt || Number.isNaN(Number(createdAt))) return '-';
  const date = new Date(Number(createdAt) * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday 
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    : date.toLocaleDateString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const statusMeta = (status) => {
  if (status === 1) return { color: '#22c55e', bg: '#dcfce7', text: '已同意' };
  if (status === 2) return { color: '#ef4444', bg: '#fee2e2', text: '已拒绝' };
  return { color: '#3b82f6', bg: '#dbeafe', text: '待处理' };
};

const FriendRequestCard = ({ request, user, mode, onAccept, onReject, working }) => {
  const meta = statusMeta(request?.status);
  const { token } = theme.useToken();

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
    <div
      style={{
        padding: '16px',
        borderRadius: '16px',
        background: '#ffffff',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        border: '1px solid #f1f5f9',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
      }}
    >
      <div style={{ display: 'flex', gap: 16, flex: 1, alignItems: 'center' }}>
        <Avatar 
          size={52} 
          src={user?.avatar} 
          icon={<UserOutlined />} 
          style={{ 
             flexShrink: 0, 
             border: '1px solid #f8fafc',
             background: mode === 'sent' ? '#f0f9ff' : undefined,
             color: mode === 'sent' ? '#0ea5e9' : undefined,
          }} 
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <Text strong style={{ fontSize: 16, color: '#1e293b' }}>{displayName}</Text>
                   <Text type="secondary" style={{ fontSize: 12 }}>{subtitle}</Text>
                </div>
                 {!showActions && (
                    <div style={{ 
                      padding: '4px 10px', 
                      borderRadius: 20, 
                      background: meta.bg, 
                      color: meta.color,
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}>
                      {mode === 'sent' && pending ? '等待回复' : meta.text}
                    </div>
                  )}
            </div>

            <div style={{ 
              marginTop: 6, 
              fontSize: 13, 
              color: '#64748b', 
              background: '#f8fafc', 
              padding: '4px 8px', 
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              maxWidth: 'fit-content'
            }}>
              <Text style={{ fontSize: 13, color: '#475569', maxWidth: 300 }} ellipsis>
                {request?.message || '请求添加好友'}
              </Text>
            </div>
             <Text type="secondary" style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>
              {formatCreatedAt(request?.createdAt)}
            </Text>
        </div>
      </div>

      {showActions && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            shape="circle"
            size="middle"
            icon={<CloseOutlined />}
            onClick={onReject}
            loading={working}
            disabled={working}
            style={{ color: '#ef4444', borderColor: '#fee2e2', background: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          />
          <Button
            type="primary"
            shape="circle"
            size="middle"
            icon={<CheckOutlined />}
            onClick={onAccept}
            loading={working}
            disabled={working}
            style={{ background: '#3b82f6', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)' }}
          />
        </div>
      )}
    </div>
  );
};

export default FriendRequestCard;

