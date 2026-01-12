import React, { useMemo, useState } from 'react';
import { Avatar, Button, Card, Empty, Input, List, Space, Table, Tag, Tabs, Typography, message } from 'antd';
import { PlusOutlined, SearchOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import MainLayout from '../components/MainLayout';
import UserProfileModal from '../components/UserProfileModal';
import { searchUser } from '../api/user';
import { groupApi } from '../api/group';

const { Title, Text } = Typography;

const UserSearch = () => {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('user');
  const [groups, setGroups] = useState([]);
  const [searched, setSearched] = useState(false);

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

  const handleTabChange = (key) => {
    setActiveTab(key);
    setKeyword('');
    setUsers([]);
    setGroups([]);
    setTotal(0);
    setSearched(false);
  };

  const handleJoinGroup = async (groupId) => {
    message.info(`加群申请功能暂未开放（${groupId}）`);
  };

  const activeMeta =
    activeTab === 'group'
      ? {
          title: '搜索群组',
          description: '仅支持精确匹配，请输入完整群组 ID 或完整群组名称。',
          placeholder: '输入完整群组 ID 或群组名称',
        }
      : {
          title: '搜索用户',
          description: '仅支持精确匹配，请输入完整用户名/手机号/邮箱。',
          placeholder: '输入完整用户名/手机号/邮箱',
        };

  const resultCount = activeTab === 'group' ? groups.length : (total || users.length);

  const renderGroupList = () => (
    <List
      loading={loading}
      dataSource={groups}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searched
                ? 'No results (exact match required).'
                : '请输入完整群组 ID 或群组名称。'
            }
          />
        ),
      }}
      renderItem={(item) => (
        <List.Item
          actions={[
            <Button
              key="join"
              type="primary"
              ghost
              icon={<PlusOutlined />}
              onClick={() => handleJoinGroup(item.groupId)}
            >
              申请加入
            </Button>,
          ]}
        >
          <List.Item.Meta
            avatar={<Avatar shape="square" src={item.avatar} icon={<TeamOutlined />} />}
            title={item.name}
            description={
              <Space direction="vertical" size={0}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ID: {item.groupId}
                </Text>
                <Text type="secondary">{item.description || '-'}</Text>
              </Space>
            }
          />
        </List.Item>
      )}
    />
  );

  const onSearch = async () => {
    const kw = keyword.trim();
    if (!kw) {
      setUsers([]);
      setGroups([]);
      setTotal(0);
      setSearched(false);
      message.info('请输入关键词');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      if (activeTab === 'group') {
        const res = await groupApi.searchGroupPrecise(kw);
        const list = Array.isArray(res) ? res : (res ? [res] : []);
        setGroups(list);
        setUsers([]);
        setTotal(0);
        return;
      }
      const data = await searchUser(kw);
      setUsers(Array.isArray(data?.users) ? data.users : []);
      setGroups([]);
      setTotal(Number(data?.total || data?.users?.length || 0));
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout pageTitle="发现">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            {activeMeta.title}
          </Title>
          <Text type="secondary">{activeMeta.description}</Text>
        </div>
      </div>

      <Card style={{ borderRadius: 16, marginBottom: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={[
            { key: 'user', label: '用户', icon: <UserOutlined /> },
            { key: 'group', label: '群组', icon: <TeamOutlined /> },
          ]}
        />
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input
            size="large"
            prefix={<SearchOutlined />}
            placeholder={activeMeta.placeholder}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={onSearch}
            allowClear
          />
          <Space>
            <Button type="primary" size="large" onClick={onSearch} loading={loading}>
              搜索
            </Button>
            <Text type="secondary">共 {resultCount} 条</Text>
          </Space>
        </Space>
      </Card>

      <Card style={{ borderRadius: 16 }}>
        {activeTab === 'user' ? (
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={users}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    searched
                      ? '暂无结果（需精确匹配）'
                      : '请输入完整用户名/手机号/邮箱。'
                  }
                />
              ),
            }}
          />
        ) : (
          renderGroupList()
        )}
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
