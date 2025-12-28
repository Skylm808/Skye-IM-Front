import React, { useMemo, useState } from 'react';
import { Avatar, Button, Card, Empty, Input, Space, Table, Tag, Typography, message } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import MainLayout from '../components/MainLayout';
import AddFriendModal from '../components/friend/AddFriendModal';
import { searchUser } from '../api/user';
import { friendApi } from '../api/friend';

const { Title, Text } = Typography;

const FriendsAdd = () => {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetUser, setTargetUser] = useState(null);

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
        width: 140,
        render: (_, record) => (
          <Button
            type="primary"
            onClick={() => {
              setTargetUser(record);
              setModalOpen(true);
            }}
          >
            申请好友
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

  const submit = async ({ message: verifyMessage }) => {
    if (!targetUser?.id) return;
    setSubmitting(true);
    try {
      await friendApi.addFriendRequest(targetUser.id, verifyMessage);
      message.success('好友申请已发送');
      setModalOpen(false);
      setTargetUser(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout pageTitle="添加好友">
      <div style={{ marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          添加好友
        </Title>
        <Text type="secondary">通过用户名/昵称搜索用户，并发送好友申请。</Text>
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
            <Text type="secondary">共 {total} 条</Text>
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

      <AddFriendModal
        open={modalOpen}
        targetUser={targetUser}
        submitting={submitting}
        onCancel={() => {
          setModalOpen(false);
          setTargetUser(null);
        }}
        onSubmit={submit}
      />
    </MainLayout>
  );
};

export default FriendsAdd;

