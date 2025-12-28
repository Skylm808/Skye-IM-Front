import React, { useMemo, useState } from 'react';
import { Avatar, Button, Card, Empty, Input, Space, Table, Tag, Typography, message } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import MainLayout from '../components/MainLayout';
import UserProfileModal from '../components/UserProfileModal';
import { searchUser } from '../api/user';

const { Title, Text } = Typography;

const UserSearch = () => {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);

  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const columns = useMemo(
    () => [
      {
        title: '用户',
        key: 'user',
        render: (_, record) => (
          <Space>
            <Avatar src={record.avatar} icon={<UserOutlined />} />
            <Space direction="vertical" size={0}>
              <Text strong>{record.nickname || record.username}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                @{record.username}
              </Text>
            </Space>
          </Space>
        ),
      },
      { title: '邮箱', dataIndex: 'email', key: 'email', render: (v) => v || '-' },
      { title: '电话', dataIndex: 'phone', key: 'phone', render: (v) => v || '-' },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 90,
        render: (v) => <Tag color={v === 1 ? 'green' : 'red'}>{v === 1 ? '正常' : '禁用'}</Tag>,
      },
      {
        title: '操作',
        key: 'action',
        width: 110,
        render: (_, record) => (
          <Button
            type="link"
            onClick={() => {
              setSelectedUserId(record.id);
              setProfileOpen(true);
            }}
          >
            查看
          </Button>
        ),
      },
    ],
    []
  );

  const onSearch = async () => {
    const kw = keyword.trim();
    if (!kw) {
      setUsers([]);
      setTotal(0);
      message.info('请输入关键字');
      return;
    }
    setLoading(true);
    try {
      const data = await searchUser(kw);
      setUsers(Array.isArray(data?.users) ? data.users : []);
      setTotal(Number(data?.total || 0));
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout pageTitle="搜索用户">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            搜索用户
          </Title>
          <Text type="secondary">按用户名/昵称关键字搜索，查看用户资料。</Text>
        </div>
      </div>

      <Card style={{ borderRadius: 16, marginBottom: 16 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input
            size="large"
            prefix={<SearchOutlined />}
            placeholder="输入关键字（例如：tianlin / 张三）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={onSearch}
            allowClear
          />
          <Space>
            <Button type="primary" size="large" onClick={onSearch} loading={loading}>
              搜索
            </Button>
            <Text type="secondary">共 {total} 条结果</Text>
          </Space>
        </Space>
      </Card>

      <Card style={{ borderRadius: 16 }}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={users}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无数据" /> }}
        />
      </Card>

      <UserProfileModal
        open={profileOpen}
        userId={selectedUserId}
        onClose={() => {
          setProfileOpen(false);
          setSelectedUserId(null);
        }}
      />
    </MainLayout>
  );
};

export default UserSearch;

