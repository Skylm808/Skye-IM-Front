import React, { useMemo } from 'react';
import { Avatar, Space, Typography, Tooltip } from 'antd';
import { 
  TeamOutlined, 
  UserAddOutlined, 
  UserDeleteOutlined, 
  LogoutOutlined, 
  StopOutlined 
} from '@ant-design/icons';

const { Text } = Typography;

const formatEventTime = (timestamp) => {
  if (!timestamp || Number.isNaN(Number(timestamp))) return '-';
  const date = new Date(Number(timestamp) * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday 
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    : date.toLocaleDateString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const GroupEventCard = ({ event, groupInfo, userMap, onClickGroup }) => {
  const { eventType, eventData = {}, createdAt } = event;
  const groupId = event.groupId || eventData.groupId;
  
  // Prefer snapshot data from eventData, fallback to live cache
  const groupName = eventData.groupName || groupInfo?.name || groupId || '群聊';
  const groupAvatar = eventData.groupAvatar || groupInfo?.avatar;

  const memberId = eventData.memberId ?? eventData.userId;
  const operatorId = eventData.operatorId;
  
  const memberUser = userMap[memberId];
  const operatorUser = userMap[operatorId];

  const memberName = eventData.userName || memberUser?.nickname || memberUser?.username || (memberId ? `用户${memberId}` : '');
  const memberAvatar = eventData.userAvatar || memberUser?.avatar;
  const operatorName = operatorUser?.nickname || operatorUser?.username || (operatorId ? `用户${operatorId}` : '');

  const config = useMemo(() => {
    switch (eventType) {
      case 'joinGroup':
        return {
          icon: <UserAddOutlined style={{ color: '#fff', fontSize: 12 }} />,
          badgeBg: '#22c55e', // Green
          title: '新成员加入',
          content: `${memberName} 加入了群聊`,
          showMember: true
        };
      case 'quitGroup':
        return {
          icon: <LogoutOutlined style={{ color: '#fff', fontSize: 12 }} />,
          badgeBg: '#f59e0b', // Amber
          title: '成员退出',
          content: `${memberName} 退出了群聊`,
          showMember: true
        };
      case 'kickMember':
        return {
          icon: <StopOutlined style={{ color: '#fff', fontSize: 12 }} />,
          badgeBg: '#ef4444', // Red
          title: '成员被移出',
          content: `${memberName} 被移出群聊`,
          operator: operatorName ? `操作人: ${operatorName}` : null,
          showMember: true
        };
      case 'dismissGroup':
        return {
          icon: <StopOutlined style={{ color: '#fff', fontSize: 12 }} />,
          badgeBg: '#64748b', // Slate
          title: '群聊解散',
          content: '该群聊已被解散',
          showMember: false
        };
      default:
        return {
          icon: <TeamOutlined style={{ color: '#fff', fontSize: 12 }} />,
          badgeBg: '#3b82f6', // Blue
          title: '群组变更',
          content: '群组信息发生变更',
          showMember: false
        };
    }
  }, [eventType, memberName, operatorName]);

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
        alignItems: 'flex-start',
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
      {/* Left: Group Avatar with Badge */}
      <div style={{ position: 'relative' }}>
        <Avatar 
          shape="square" 
          size={52} 
          src={groupAvatar} 
          icon={<TeamOutlined />} 
          style={{ 
            borderRadius: 12,
            backgroundColor: '#e2e8f0',
            color: '#64748b',
            cursor: 'pointer'
          }}
          onClick={() => onClickGroup && onClickGroup(groupId)}
        />
        <div style={{
          position: 'absolute',
          right: -6,
          bottom: -6,
          width: 22,
          height: 22,
          borderRadius: '50%',
          backgroundColor: config.badgeBg,
          border: '2px solid #fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {config.icon}
        </div>
      </div>

      {/* Middle: Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text strong style={{ fontSize: 15, color: '#1e293b' }}>
            {config.title}
          </Text>
          <Text type="secondary" style={{ fontSize: 11, color: '#94a3b8' }}>
            {formatEventTime(createdAt)}
          </Text>
        </div>

        <div 
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          onClick={() => onClickGroup && onClickGroup(groupId)}
        >
          <Text style={{ fontSize: 13, color: '#0ea5e9', fontWeight: 500 }}>
             {groupName}
          </Text>
        </div>

        {/* Dynamic content based on event type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {config.showMember && memberName && (
               <div style={{ 
                   display: 'flex', 
                   alignItems: 'center', 
                   gap: 6, 
                   background: '#f8fafc', 
                   padding: '4px 8px', 
                   borderRadius: 20,
                   border: '1px solid #f1f5f9'
               }}>
                  <Avatar size={20} src={memberAvatar} icon={<TeamOutlined />} />
                  <Text style={{ fontSize: 12, color: '#475569' }}>{memberName}</Text>
               </div>
            )}
            {config.operator && (
               <Text type="secondary" style={{ fontSize: 11 }}>{config.operator}</Text>
            )}
        </div>
        
        {/* Fallback plain text if no structured data */}
        {!config.showMember && (
           <Text type="secondary" style={{ fontSize: 13, color: '#64748b' }}>
              {config.content}
           </Text>
        )}
      </div>
    </div>
  );
};

export default GroupEventCard;