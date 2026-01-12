import React, { useState } from 'react';
import { Modal, Input, List, Avatar, Button, Tabs, message, Empty, Tag, Space, Typography } from 'antd';
import { UserOutlined, TeamOutlined, SearchOutlined, UserAddOutlined, PlusOutlined } from '@ant-design/icons';
import { searchUser } from '../api/user';
import { groupApi } from '../api/group';
import { friendApi } from '../api/friend';

const { Text } = Typography;

const SearchAddModal = ({ open, onCancel, initialTab = 'user' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      if (activeTab === 'user') {
        const res = await searchUser(keyword);
        setUsers(res.users || (Array.isArray(res) ? res : []));
      } else {
        const res = await groupApi.searchGroupPrecise(keyword);
        // 兼容单个群组对象或列表返回
        const list = Array.isArray(res) ? res : (res ? [res] : []);
        setGroups(list);
      }
    } catch (e) {
      console.error(e);
      if (activeTab === 'user') setUsers([]);
      else setGroups([]);
      message.error('未找到匹配项');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (userId) => {
    try {
      await friendApi.addFriendRequest(userId, '你好，我是...');
      message.success('好友申请已发送');
    } catch (e) {
      message.error('发送申请失败');
    }
  };

  const handleJoinGroup = async (groupId) => {
    try {
      // 这里预留加群申请接口（当前仅提示）
      // 如果后端提供 apply/join 接口，可在此接入
      message.info('申请加入功能开发中');
    } catch (e) {
      message.error('操作失败');
    }
  };

  const renderUserList = () => (
    <List
      loading={loading}
      dataSource={users}
      locale={{ emptyText: <Empty description="暂无搜索结果 (需精确匹配)" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      renderItem={item => (
        <List.Item
          actions={[
            <Button type="primary" ghost icon={<UserAddOutlined />} onClick={() => handleAddFriend(item.id)}>
              添加好友
            </Button>
          ]}
        >
          <List.Item.Meta
            avatar={<Avatar src={item.avatar} icon={<UserOutlined />} size="large" />}
            title={
              <Space>
                 <Text strong>{item.nickname || item.username}</Text>
                 <Tag color="blue">@{item.username}</Tag>
              </Space>
            }
            description={item.phone || '暂无手机号'}
          />
        </List.Item>
      )}
    />
  );

  const renderGroupList = () => (
    <List
      loading={loading}
      dataSource={groups}
      locale={{ emptyText: <Empty description="暂无搜索结果 (需精确匹配ID或名称)" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      renderItem={item => (
        <List.Item
          actions={[
            <Button type="primary" ghost icon={<PlusOutlined />} onClick={() => handleJoinGroup(item.groupId)}>
              申请加入
            </Button>
          ]}
        >
          <List.Item.Meta
            avatar={<Avatar shape="square" src={item.avatar} icon={<TeamOutlined />} size="large" />}
            title={item.name}
            description={
              <Space direction="vertical" size={0}>
                <Text type="secondary" style={{ fontSize: 12 }}>ID: {item.groupId}</Text>
                <Text type="secondary">{item.description || '暂无简介'}</Text>
              </Space>
            }
          />
        </List.Item>
      )}
    />
  );

  return (
    <Modal
      title="发现 - 精确搜索"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Tabs 
        activeKey={activeTab} 
        onChange={(key) => { setActiveTab(key); setKeyword(''); setSearched(false); setUsers([]); setGroups([]); }}
        items={[
          { key: 'user', label: '搜索用户', icon: <UserOutlined /> },
          { key: 'group', label: '搜索群组', icon: <TeamOutlined /> }
        ]}
      />
      
      <div style={{ marginBlock: 20, display: 'flex', gap: 10 }}>
        <Input 
          prefix={<SearchOutlined />} 
          placeholder={activeTab === 'user' ? "精确匹配用户名/手机号/邮箱" : "精确匹配群ID/群名称"}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
          allowClear
        />
        <Button type="primary" onClick={handleSearch} loading={loading}>搜索</Button>
      </div>

      {activeTab === 'user' ? renderUserList() : renderGroupList()}
    </Modal>
  );
};

export default SearchAddModal;
