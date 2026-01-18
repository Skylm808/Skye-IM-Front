import React, { useEffect, useState } from 'react';
import { Avatar, Button, Space, Tag, Typography, theme } from 'antd';
import { CheckOutlined, CloseOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { groupApi } from '../../api/group';

const { Text } = Typography;

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const statusMeta = (status) => {
  if (status === 1) return { color: '#22c55e', bg: '#dcfce7', text: '已同意' };
  if (status === 2) return { color: '#ef4444', bg: '#fee2e2', text: '已拒绝' };
  return { color: '#eab308', bg: '#fef9c3', text: '待处理' };
};

const GroupInvitationCard = ({
  invitation,
  user,
  mode = 'received',
  groupStatus,
  working,
  onAccept,
  onReject,
}) => {
  const isReceived = mode === 'received';
  const status = invitation?.status ?? 0;
  const isDismissed = groupStatus === 2;
  const { token } = theme.useToken();

  const [groupAvatar, setGroupAvatar] = useState(invitation.groupAvatar);
  const [groupName, setGroupName] = useState(invitation.groupName);

  useEffect(() => {
    if (!invitation.groupId) return;
    if (groupAvatar && groupName) return;

    groupApi
      .getDetails(invitation.groupId)
      .then((res) => {
        const info = res?.group || res?.data || res;
        if (info?.avatar) setGroupAvatar(info.avatar);
        if (info?.name) setGroupName(info.name);
      })
      .catch((err) => console.error('Failed to fetch group info for invitation card', err));
  }, [invitation.groupId, groupAvatar, groupName]);

  const personName = isReceived
    ? user?.nickname || user?.username || invitation.inviterName || `用户 ${invitation.inviterId}`
    : user?.nickname || user?.username || invitation.inviteeName || `用户 ${invitation.inviteeId}`;

  const personLabel = isReceived ? '邀请人' : '被邀请人';
  const displayGroupName = groupName || `群组 ${invitation.groupId}`;
  const displayGroupAvatar =
    groupAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${invitation.groupId}`;

  const meta = statusMeta(status);
  const showActions = isReceived && status === 0 && !isDismissed;

  const bg = isDismissed ? '#fafafa' : '#ffffff';
  const shadow = isDismissed ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '16px',
        background: bg,
        boxShadow: shadow,
        border: '1px solid #f1f5f9',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        transition: 'all 0.2s',
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
          shape="square"
          size={52}
          src={displayGroupAvatar}
          icon={<TeamOutlined />}
          style={{ borderRadius: 14, flexShrink: 0, border: '1px solid #f8fafc' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Space size={4}>
                <Text strong style={{ fontSize: 16, color: '#1e293b' }}>{displayGroupName}</Text>
                {isDismissed && <Tag color="default" style={{ marginRight: 0 }}>已解散</Tag>}
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID: {invitation.groupId}
              </Text>
            </div>
            {!showActions && (
              <div style={{
                padding: '4px 10px',
                borderRadius: 20,
                background: isDismissed ? '#f1f5f9' : (status === 0 ? '#fef9c3' : meta.bg),
                color: isDismissed ? '#94a3b8' : (status === 0 ? '#ca8a04' : meta.color),
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}>
                {isDismissed ? '群组已解散' : (!isReceived && status === 0 ? '等待对方处理' : meta.text)}
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
            flexDirection: 'column',
            gap: 2,
            maxWidth: 'fit-content'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserOutlined style={{ fontSize: 12 }} />
              <Text style={{ fontSize: 12, color: '#64748b' }}>
                {personLabel}: <Text strong style={{ color: '#475569' }}>{personName}</Text>
              </Text>
            </div>
            {invitation.message && (
              <Text style={{ fontSize: 13, color: '#334155', marginTop: 2 }}>
                “{invitation.message}”
              </Text>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>
            {formatTime(invitation.createdAt)}
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

export default GroupInvitationCard;
