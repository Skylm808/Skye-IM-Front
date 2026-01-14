import React, { useMemo } from 'react';
import { Avatar, Button, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, StopOutlined, UserOutlined } from '@ant-design/icons';

const { Text } = Typography;

const formatCreatedAt = (createdAt) => {
  if (!createdAt || Number.isNaN(Number(createdAt))) return '-';
  const date = new Date(Number(createdAt) * 1000);
  return date.toLocaleDateString();
};

const FriendCard = ({
  relation,
  user,
  onViewProfile,
  onEditRemark,
  onDelete,
  onToggleBlacklist,
  working,
}) => {
  const isSelf = !!relation?.isSelf;

  const displayName = useMemo(() => {
    const remark = relation?.remark?.trim();
    if (remark) return remark;
    return user?.nickname || user?.username || `用户#${relation?.friendId ?? '-'}`;
  }, [relation?.remark, relation?.friendId, user?.nickname, user?.username]);

  const subtitle = useMemo(() => {
    if (!user) return '';
    const nick = user.nickname || '';
    const uname = user.username ? `@${user.username}` : '';
    if (nick && uname) return `${nick} · ${uname}`;
    return nick || uname;
  }, [user]);

  const isBlack = relation?.status === 2;

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '16px',
        background: isBlack ? '#fef2f2' : '#ffffff',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        border: isBlack ? '1px solid #fee2e2' : '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!isBlack) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isBlack) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
        }
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
        <Avatar 
          size={52} 
          src={user?.avatar} 
          icon={<UserOutlined />} 
          style={{ 
             flexShrink: 0, 
             border: '1px solid #f8fafc',
             backgroundColor: isSelf ? '#3b82f6' : undefined 
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text strong style={{ fontSize: 16, color: '#1e293b' }}>
              {displayName}
            </Text>
            {isSelf ? (
               <Tag color="blue" bordered={false} style={{ borderRadius: 10 }}>我</Tag>
            ) : isBlack ? (
               <Tag color="red" bordered={false} style={{ borderRadius: 10 }}>已拉黑</Tag>
            ) : null}
          </div>
          <Text type="secondary" style={{ fontSize: 13, color: '#64748b' }} ellipsis>
            {subtitle || '加载中...'}
          </Text>
          {!isSelf && relation?.createdAt && (
            <Text type="secondary" style={{ fontSize: 11, color: '#94a3b8' }}>
              {formatCreatedAt(relation.createdAt)} 添加
            </Text>
          )}
        </div>
      </div>

      <Space size={4}>
        {onViewProfile && (
          <Tooltip title={isSelf ? '发消息' : '查看资料'}>
            <Button 
               shape="circle"
               type={isSelf ? 'primary' : 'text'}
               icon={isSelf ? <UserOutlined /> : <EyeOutlined />} 
               onClick={onViewProfile} 
               disabled={working} 
               style={isSelf ? { boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)' } : {}}
            />
          </Tooltip>
        )}
        
        {onEditRemark && (
          <Tooltip title="修改备注">
            <Button type="text" shape="circle" icon={<EditOutlined />} onClick={onEditRemark} disabled={working} />
          </Tooltip>
        )}
        
        {onToggleBlacklist && (
          <Tooltip title={isBlack ? '取消拉黑' : '拉黑'}>
            <Button
              type="text"
              shape="circle"
              icon={<StopOutlined />}
              onClick={onToggleBlacklist}
              disabled={working}
              danger={!isBlack}
            />
          </Tooltip>
        )}
        
        {onDelete && (
          <Popconfirm
            title="删除好友？"
            description="删除后需要重新发送申请才能再次添加。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={onDelete}
          >
            <Tooltip title="删除">
              <Button type="text" shape="circle" icon={<DeleteOutlined />} danger disabled={working} />
            </Tooltip>
          </Popconfirm>
        )}
      </Space>
    </div>
  );
};

export default FriendCard;

