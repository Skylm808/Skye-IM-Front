import React, { useMemo } from 'react';
import { Avatar, Button, Space, Tag, Typography, theme } from 'antd';
import { CheckOutlined, CloseOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';

const { Text } = Typography;

const formatTime = (timestamp) => {
  if (!timestamp || Number.isNaN(Number(timestamp))) return '-';
  const date = new Date(Number(timestamp) * 1000);
  if (isNaN(date.getTime())) return '-';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const GroupJoinRequestCard = ({
  request,
  user,
  group,
  mode = 'received',
  working,
  onAccept,
  onReject,
}) => {
  const { token } = theme.useToken();

  const status = request?.status;
  const isDismissed = group?.status === 2; // 2 = Dismissed
  const pending = status === 0;
  const approved = status === 1;
  const rejected = status === 2;

  // Determine actions visibility
  const showActions = mode === 'received' && pending && !isDismissed;

  // UI Colors
  const getStatusColor = () => {
    if (isDismissed) return '#94a3b8'; // slate-400
    if (approved) return '#22c55e'; // green-500
    if (rejected) return '#ef4444'; // red-500
    if (pending) return '#3b82f6'; // blue-500
    return '#94a3b8';
  };

  const getStatusBg = () => {
    if (isDismissed) return '#f1f5f9'; // slate-100
    if (approved) return '#dcfce7'; // green-100
    if (rejected) return '#fee2e2'; // red-100
    if (pending) return '#dbeafe'; // blue-100
    return '#f1f5f9';
  };

  const getStatusText = () => {
    if (isDismissed) return '群组已解散';
    if (approved) return '已通过';
    if (rejected) return '已拒绝';
    if (pending) return '待审核';
    return '未知';
  };

  const displayName = useMemo(() => {
    if (mode === 'sent') return group?.name || request?.groupName || `群组 ${request?.groupId}`;
    return user?.nickname || user?.username || `用户 ${request?.userId}`;
  }, [mode, group?.name, request?.groupName, request?.groupId, user]);

  const subtitle = useMemo(() => {
    if (mode === 'sent') return request?.groupId ? `ID: ${request.groupId}` : '';
    return user?.username ? `@${user.username}` : '';
  }, [mode, request?.groupId, user]);

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '16px',
        background: isDismissed ? '#fafafa' : '#ffffff',
        // Modern shadow
        boxShadow: isDismissed ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        border: '1px solid #f1f5f9', // slate-100
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'default',
        opacity: isDismissed ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (isDismissed) return;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)';
      }}
      onMouseLeave={(e) => {
        if (isDismissed) return;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
      }}
    >
      {/* Left Info */}
      <div style={{ display: 'flex', gap: 16, flex: 1, alignItems: 'center' }}>
        <Avatar
          shape={mode === 'sent' ? 'square' : 'circle'}
          size={52}
          src={mode === 'sent' ? (group?.avatar || request?.groupAvatar) : user?.avatar}
          icon={<UserOutlined />}
          style={{
            borderRadius: mode === 'sent' ? 14 : '50%',
            backgroundColor: mode === 'sent' ? '#f0f9ff' : undefined,
            color: mode === 'sent' ? '#0ea5e9' : undefined,
            border: '1px solid #f8fafc',
            flexShrink: 0
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Space size={4}>
                <Text strong style={{ fontSize: 16, color: '#1e293b' }}>{displayName}</Text>
                {isDismissed && <Tag color="default" style={{ marginRight: 0 }}>已解散</Tag>}
              </Space>

              {/* Target Group Info for Received Mode */}
              {mode === 'received' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>申请加入</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', padding: '2px 8px', borderRadius: 12 }}>
                    <Avatar size={14} src={group?.avatar} icon={<TeamOutlined />} style={{ background: '#cbd5e1' }} />
                    <Text style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>{group?.name || `ID: ${request?.groupId}`}</Text>
                  </div>
                </div>
              )}

              {subtitle && <Text type="secondary" style={{ fontSize: 12 }}>{subtitle}</Text>}
            </div>
            {/* Status Badge */}
            {!showActions && (
              <div style={{
                padding: '4px 10px',
                borderRadius: 20,
                background: getStatusBg(),
                color: getStatusColor(),
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}>
                {getStatusText()}
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
            gap: 6,
            maxWidth: 'fit-content'
          }}>
            <span style={{ opacity: 0.7 }}>理由:</span>
            <Text style={{ fontSize: 13, color: '#475569', maxWidth: 300 }} ellipsis>
              {request?.message || '无'}
            </Text>
          </div>

          <Text type="secondary" style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>
            {formatTime(request?.createdAt)}
          </Text>
        </div>
      </div>

      {/* Right Actions */}
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

export default GroupJoinRequestCard;
