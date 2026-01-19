import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Empty, Input, List, Modal, Space, Tabs, Tag, Typography, message } from 'antd';
import { MessageOutlined, PlusOutlined, SearchOutlined, TeamOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { searchUser } from '../api/user';
import { groupApi } from '../api/group';
import { friendApi } from '../api/friend';
import JoinGroupModal from './group/JoinGroupModal';

const { Text } = Typography;

const normalizeGroupList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.data?.list)) return res.data.list;
  if (res && res.groupId) return [res];
  return [];
};

const normalizeListResult = (res) => {
  if (Array.isArray(res)) return { list: res, total: res.length };
  if (Array.isArray(res?.list)) {
    return { list: res.list, total: Number(res.total || res.totalCount || res.list.length) };
  }
  if (Array.isArray(res?.data?.list)) {
    return { list: res.data.list, total: Number(res.data.total || res.data.totalCount || res.data.list.length) };
  }
  return { list: [], total: 0 };
};

const resolveJoinError = (raw) => {
  const msg = String(raw || '申请失败');
  if (msg.includes('duplicate') || msg.includes('pending')) return '您已有该群的待审核申请，请勿重复提交';
  if (msg.includes('member')) return '您已经是群成员';
  if (msg.includes('exist')) return '群组不存在';
  if (msg.includes('dismiss')) return '群组已解散';
  return msg;
};

const SearchAddModal = ({ open, onCancel, initialTab = 'user' }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [searched, setSearched] = useState(false);

  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [appliedGroups, setAppliedGroups] = useState({});

  const isGroupId = useMemo(() => {
    return (value) => String(value || '').trim().startsWith('g_');
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setKeyword('');
    setSearched(false);
    setUsers([]);
    setGroups([]);
  }, [open, initialTab]);

  const loadAppliedGroups = async () => {
    try {
      const res = await groupApi.getSentJoinRequests(1, 200);
      const { list } = normalizeListResult(res);
      const next = {};
      list.forEach((item) => {
        if (!item?.groupId) return;
        // Only mark status=0 as pending
        if (item.status === 0) {
           next[String(item.groupId)] = 0;
        }
        // Could also cache joined status if needed
      });
      setAppliedGroups(next);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (open && activeTab === 'group') {
      loadAppliedGroups();
    }
  }, [open, activeTab]);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      if (activeTab === 'user') {
        const res = await searchUser(keyword);
        setUsers(res.users || (Array.isArray(res) ? res : []));
      } else {
        const trimmed = keyword.trim();
        const res = isGroupId(trimmed)
          ? await groupApi.searchGroupPrecise(trimmed)
          : await groupApi.searchGroup(trimmed);
        setGroups(normalizeGroupList(res).filter((g) => g.status !== 2));
      }
    } catch (e) {
      console.error(e);
      if (activeTab === 'user') setUsers([]);
      else setGroups([]);
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (userId) => {
    try {
      await friendApi.addFriendRequest(userId, '你好，我是...');
      message.success('好友申请已发送');
    } catch (e) {
      message.error('发送失败');
    }
  };

  const handleJoinGroup = (group) => {
    setCurrentGroup(group);
    setJoinModalVisible(true);
  };

  const submitJoinRequest = async (messageText) => {
    if (!currentGroup?.groupId) return;
    setJoinLoading(true);
    try {
      await groupApi.joinRequest({
        groupId: String(currentGroup.groupId),
        message: messageText || '大家好，我想加入群组',
      });
      message.success('申请已发送，请等待审核');
      setAppliedGroups((prev) => ({ ...prev, [String(currentGroup.groupId)]: 0 }));
      setJoinModalVisible(false);
    } catch (error) {
      console.error(error);
      const errorMsg = resolveJoinError(error.response?.data?.message || error.message);
      message.error(errorMsg);
      // Refresh status if duplicate
      if (errorMsg.includes('重复提交')) {
         loadAppliedGroups();
      }
    } finally {
      setJoinLoading(false);
    }
  };

  const userEmptyText = searched ? '未搜索到用户' : '请输入搜索关键词';
  const groupEmptyText = searched ? '未搜索到群组' : '输入ID或名称搜索';

  const renderUserList = () => (
    <List
      loading={loading}
      dataSource={users}
      locale={{ emptyText: <Empty description={userEmptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      renderItem={(item) => (
        <List.Item
          actions={[
            <Button type="primary" ghost icon={<UserAddOutlined />} onClick={() => handleAddFriend(item.id)}>
              添加好友
            </Button>,
          ]}
        >
          <List.Item.Meta
            avatar={<Avatar src={item.avatar} icon={<UserOutlined />} size="large" />}
            title={(
              <Space>
                <Text strong>{item.nickname || item.username}</Text>
                <Tag color="blue">@{item.username}</Tag>
              </Space>
            )}
            description={item.phone || '暂无电话'}
          />
        </List.Item>
      )}
    />
  );

  const renderGroupList = () => (
    <List
      loading={loading}
      dataSource={groups}
      locale={{ emptyText: <Empty description={groupEmptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      renderItem={(item) => {
        const status = appliedGroups[String(item.groupId)];
        const isPending = status === 0;
        // Search API usually doesn't return membership status, so we can't easily know if 'Joined' unless we cross-check myGroups
        // For simplicity, we only show 'Pending' state from appliedGroups
        // Or if we encounter 'Already member' error, we could update UI
        
        const isDismissed = item.status === 2;
        const isFull =
          Number.isFinite(item?.memberCount) &&
          Number.isFinite(item?.maxMembers) &&
          Number(item.maxMembers) > 0 &&
          Number(item.memberCount) >= Number(item.maxMembers);

        const statusTags = [];
        if (isDismissed) statusTags.push(<Tag key="dismissed" color="red">已解散</Tag>);
        if (isFull) statusTags.push(<Tag key="full" color="red">已满员</Tag>);
        if (isPending) statusTags.push(<Tag key="pending" color="gold">已申请</Tag>);

        let actionNode = null;
        if (isPending) {
          actionNode = <Tag color="gold">待审核</Tag>;
        } else if (isDismissed) {
          actionNode = <Tag color="red">已解散</Tag>;
        } else if (isFull) {
          actionNode = <Tag color="red">已满员</Tag>;
        } else {
          actionNode = (
            <Button type="primary" ghost icon={<PlusOutlined />} onClick={() => handleJoinGroup(item)}>
              申请加入
            </Button>
          );
        }

        return (
          <List.Item actions={[actionNode]}>
            <List.Item.Meta
              avatar={<Avatar shape="square" src={item.avatar} icon={<TeamOutlined />} size="large" />}
              title={(
                <Space size={8} wrap>
                  <Text strong>{item.name}</Text>
                  {statusTags}
                </Space>
              )}
              description={(
                <Space direction="vertical" size={0}>
                  <Text type="secondary" style={{ fontSize: 12 }}>ID: {item.groupId}</Text>
                  <Space size={8} wrap>
                    {Number.isFinite(item.memberCount) ? <Tag color="blue">{item.memberCount} 人</Tag> : null}
                    {Number.isFinite(item.maxMembers) ? <Tag>上限 {item.maxMembers}</Tag> : null}
                  </Space>
                  <Text type="secondary">{item.description || '暂无简介'}</Text>
                </Space>
              )}
            />
          </List.Item>
        );
      }}
    />
  );

  return (
    <>
      <Modal
        title="搜索 - 添加"
        open={open}
        onCancel={onCancel}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setKeyword('');
            setSearched(false);
            setUsers([]);
            setGroups([]);
          }}
          items={[
            { key: 'user', label: '找人', icon: <UserOutlined /> },
            { key: 'group', label: '找群', icon: <TeamOutlined /> },
          ]}
        />

        <div style={{ marginBlock: 20, display: 'flex', gap: 10 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={activeTab === 'user' ? '输入用户名/手机号/邮箱' : '输入群ID或名称'}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
          <Button type="primary" onClick={handleSearch} loading={loading}>
            搜索
          </Button>
        </div>

        {activeTab === 'user' ? renderUserList() : renderGroupList()}
      </Modal>

      <JoinGroupModal
        open={joinModalVisible}
        group={currentGroup}
        applied={appliedGroups[String(currentGroup?.groupId)] === 0}
        onCancel={() => setJoinModalVisible(false)}
        onSubmit={submitJoinRequest}
        loading={joinLoading}
      />
    </>
  );
};

export default SearchAddModal;