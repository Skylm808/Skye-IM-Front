import React, { useEffect, useState } from 'react';
import { Button, Card, Avatar, Typography, Space, Tag, Badge, Tooltip } from 'antd';
import { TeamOutlined, UserOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { groupApi } from '../../api/group';

const { Text } = Typography;

const GroupInvitationCard = ({ invitation, user, mode, working, onAccept, onReject }) => {
  const isReceived = mode === 'received';
  const status = invitation.status; // 0=pending, 1=accepted, 2=rejected

  // Local state for group info
  const [groupAvatar, setGroupAvatar] = useState(invitation.groupAvatar);
  const [groupName, setGroupName] = useState(invitation.groupName);

  useEffect(() => {
    // If avatar OR name is missing/incomplete, try to fetch fresh info
    if (invitation.groupId) {
      groupApi.searchGroupPrecise(invitation.groupId)
        .then(res => {
          // Compatible with various response structures: { group: ... }, { data: ... }, or direct object
          const info = res.group || res.data || res;
          if (info) {
            if (info.avatar) setGroupAvatar(info.avatar);
            if (info.name) setGroupName(info.name);
          }
        })
        .catch(err => console.error('Failed to fetch group info for invitation card', err));
    }
  }, [invitation.groupId]);

  // Determine display name for person
  const personName = isReceived 
    ? (user?.nickname || user?.username || invitation.inviterName || `User ${invitation.inviterId}`)
    : (user?.nickname || user?.username || invitation.inviteeName || `User ${invitation.inviteeId}`);
  
  const personLabel = isReceived ? '邀请人' : '被邀请人';
  
  // Display Name Logic: Use fetched name -> invitation name -> Fallback
  const displayGroupName = groupName || `群组 ${invitation.groupId}`;
  
  // Display Avatar Logic: Use fetched avatar -> Identicon Fallback
  const displayGroupAvatar = groupAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${invitation.groupId}`;

  const renderStatus = () => {
    if (status === 1) {
      return (
        <Tag icon={<CheckOutlined />} color="success">
          已同意
        </Tag>
      );
    }
    if (status === 2) {
      return (
        <Tag icon={<CloseOutlined />} color="default">
          已拒绝
        </Tag>
      );
    }
    if (!isReceived) {
      return <Tag color="warning">等待验证</Tag>;
    }

    return (
      <Space>
        <Tooltip title="拒绝邀请">
          <Button 
            size="small" 
            danger 
            ghost
            icon={<CloseOutlined />}
            onClick={onReject} 
            loading={working}
          />
        </Tooltip>
        <Tooltip title="同意邀请">
          <Button 
            size="small" 
            type="primary" 
            icon={<CheckOutlined />}
            onClick={onAccept} 
            loading={working}
          >
            同意
          </Button>
        </Tooltip>
      </Space>
    );
  };

  return (
    <Card
      size="small"
      style={{
        borderRadius: 16,
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        border: '1px solid #f0f0f0',
        transition: 'all 0.2s',
      }}
      bodyStyle={{ padding: '16px' }}
      hoverable
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Badge count={isReceived ? "邀" : "发"} offset={[-5, 5]} color={isReceived ? '#52c41a' : '#1890ff'}>
             <Avatar 
                shape="square" 
                size={48}
                src={displayGroupAvatar}
                icon={<TeamOutlined />} 
                style={{ backgroundColor: '#f0f0f0', border: '1px solid #d9d9d9' }} 
             />
          </Badge>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <Text strong style={{ fontSize: 15 }}>{displayGroupName}</Text>
            </div>
            
            <Space size={8} style={{ fontSize: 12, color: '#666' }}>
               <Space size={4}>
                 <UserOutlined style={{ fontSize: 10 }} />
                 <span>{personLabel}: <Text strong>{personName}</Text></span>
               </Space>
            </Space>

            {invitation.message && (
              <div style={{ 
                marginTop: 6, 
                background: '#fafafa', 
                padding: '4px 8px', 
                borderRadius: 6,
                border: '1px solid #f0f0f0',
                fontSize: 12,
                color: '#888',
                maxWidth: 300
              }}>
                "{invitation.message}"
              </div>
            )}
            
            <Text type="secondary" style={{ fontSize: 10, marginTop: 4 }}>
              {new Date(invitation.createdAt * 1000).toLocaleString()}
            </Text>
          </div>
        </div>
        <div style={{ paddingLeft: 12 }}>{renderStatus()}</div>
      </div>
    </Card>
  );
};

export default GroupInvitationCard;
