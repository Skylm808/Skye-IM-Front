import React, { useMemo } from 'react';
import { Avatar, Button, Card, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, StopOutlined, UserOutlined } from '@ant-design/icons';

const { Text } = Typography;

const formatCreatedAt = (createdAt) => {
  if (!createdAt || Number.isNaN(Number(createdAt))) return '-';
  return new Date(Number(createdAt) * 1000).toLocaleString();
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
    <Card
      size="small"
      styles={{ body: { padding: 14 } }}
      style={{
        borderRadius: 16,
        border: '1px solid rgba(5, 5, 5, 0.06)',
        background: isBlack ? 'linear-gradient(180deg, rgba(245, 34, 45, 0.06), #fff 60%)' : '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Space size={12}>
          <Avatar size={44} src={user?.avatar} icon={<UserOutlined />} />
          <Space direction="vertical" size={0}>
            <Space size={8} wrap>
              <Text strong style={{ fontSize: 15 }}>
                {displayName}
              </Text>
              {isBlack ? <Tag color="red">已拉黑</Tag> : <Tag color="green">正常</Tag>}
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {subtitle || '用户信息加载中...'}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              添加时间：{formatCreatedAt(relation?.createdAt)}
            </Text>
          </Space>
        </Space>

        <Space size={6}>
          <Tooltip title="查看资料">
            <Button type="text" icon={<EyeOutlined />} onClick={onViewProfile} disabled={working} />
          </Tooltip>
          <Tooltip title="修改备注">
            <Button type="text" icon={<EditOutlined />} onClick={onEditRemark} disabled={working} />
          </Tooltip>
          <Tooltip title={isBlack ? '取消拉黑' : '拉黑'}>
            <Button
              type="text"
              icon={<StopOutlined />}
              onClick={onToggleBlacklist}
              disabled={working}
              danger={!isBlack}
            />
          </Tooltip>
          <Popconfirm
            title="删除好友？"
            description="删除后需要重新发送申请才能再次添加。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={onDelete}
          >
            <Tooltip title="删除">
              <Button type="text" icon={<DeleteOutlined />} danger disabled={working} />
            </Tooltip>
          </Popconfirm>
        </Space>
      </div>
    </Card>
  );
};

export default FriendCard;

