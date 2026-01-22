import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Drawer, Empty, Input, List, Space, Tag, Tabs, Typography, message } from 'antd';
import { HistoryOutlined, MessageOutlined, PlusOutlined, SearchOutlined, TeamOutlined, UserOutlined, UserAddOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import UserProfileModal from '../components/UserProfileModal';
import JoinGroupModal from '../components/group/JoinGroupModal';
import GroupJoinRequestCard from '../components/group/GroupJoinRequestCard';
import AddFriendModal from '../components/friend/AddFriendModal';
import { searchUser } from '../api/user';
import { groupApi } from '../api/group';
import { friendApi } from '../api/friend';

const { Title, Text } = Typography;

const normalizeListResult = (res) => {
  if (Array.isArray(res)) return { list: res, total: res.length };
  if (Array.isArray(res?.list)) {
    return { list: res.list, total: Number(res.total || res.totalCount || res.list.length) };
  }
  if (Array.isArray(res?.data?.list)) {
    return { list: res.data.list, total: Number(res.data.total || res.data.totalCount || res.data.list.length) };
  }
  if (res && res.groupId) return { list: [res], total: 1 };
  return { list: [], total: 0 };
};

const normalizeGroupList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.data?.list)) return res.data.list;
  return [];
};

const extractGroupId = (group) =>
  group?.groupId ?? group?.groupID ?? group?.group_id ?? group?.id ?? group?.groupIdStr;

const resolveJoinError = (raw) => {
  const msg = String(raw || '申请发送失败');
  if (msg.includes('已经是群成员') || msg.includes('已是群成员')) return '你已是群成员，可直接进入群聊';
  if (msg.includes('待处理') || msg.includes('pending')) return '你已提交申请，请耐心等待审核';
  if (msg.includes('不存在')) return '群组不存在或已解散';
  if (msg.includes('已解散')) return '该群已解散，无法加入';
  if (msg.includes('已满')) return '群人数已满，暂时无法加入';
  return msg;
};

const UserSearch = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('user');
  const [groups, setGroups] = useState([]);
  const [searched, setSearched] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Join group flow
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [appliedGroups, setAppliedGroups] = useState({});
  const [joinedGroupIds, setJoinedGroupIds] = useState(new Set());

  // Add friend flow
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [friendTarget, setFriendTarget] = useState(null);
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [sentFriendRequests, setSentFriendRequests] = useState(new Set());
  const [friendIds, setFriendIds] = useState(new Set());

  // Sent join requests drawer
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [requestsList, setRequestsList] = useState([]);
  const [groupInfoMap, setGroupInfoMap] = useState({});
  const requestsPageSize = 10;

  // Current user for modal
  const [currentUser, setCurrentUser] = useState(null);
  
  useEffect(() => {
    import('../api/auth').then(({ getUserInfo }) => {
      getUserInfo().then(res => setCurrentUser(res.user || res)).catch(() => {});
    });
    
    // Load existing friends to update UI status
    friendApi.getFriendList(1, 1000).then(res => {
      const list = Array.isArray(res?.list) ? res.list : [];
      const ids = new Set(list.map(f => f.friendId));
      setFriendIds(ids);
    }).catch(console.error);
  }, []);

  const isGroupId = useMemo(() => {
    return (value) => String(value || '').trim().startsWith('g_');
  }, []);

  const handleTabChange = (key) => {
    setActiveTab(key);
    setKeyword('');
    setUsers([]);
    setGroups([]);
    setTotal(0);
    setSearched(false);
  };

  const handleJoinGroup = (group) => {
    setCurrentGroup(group);
    setJoinModalOpen(true);
  };

  const handleAddFriendClick = (user) => {
    setFriendTarget(user);
    setAddFriendOpen(true);
  };

  const submitAddFriend = async ({ message: msg }) => {
    if (!friendTarget?.id) return;
    setAddFriendLoading(true);
    try {
      await friendApi.addFriendRequest(friendTarget.id, msg);
      message.success('好友申请已发送');
      setSentFriendRequests(prev => new Set(prev).add(friendTarget.id));
      setAddFriendOpen(false);
    } catch (e) {
      console.error(e);
      message.error(e.response?.data?.message || '发送好友申请失败');
    } finally {
      setAddFriendLoading(false);
    }
  };

  const submitJoinRequest = async (messageText) => {
    if (!currentGroup?.groupId) return;
    setJoinLoading(true);
    try {
      await groupApi.joinRequest({
        groupId: String(currentGroup.groupId),
        message: messageText || '你好，我想加入群组'
      });
      message.success('入群申请已发送，请等待审核');
      setAppliedGroups((prev) => ({ ...prev, [String(currentGroup.groupId)]: 0 }));
      setJoinModalOpen(false);
    } catch (error) {
      console.error(error);
      const errorMsg = resolveJoinError(error.response?.data?.message || error.message);
      if (errorMsg.includes('等待审核')) {
        loadJoinRequests(1);
      }
      message.error(errorMsg);
    } finally {
      setJoinLoading(false);
    }
  };

  const loadJoinedGroupIds = async () => {
    try {
      const res = await groupApi.getList(1, 200);
      const list = normalizeGroupList(res);
      const ids = new Set();
      list.forEach((item) => {
        const id = extractGroupId(item);
        if (id != null) ids.add(String(id));
      });
      setJoinedGroupIds(ids);
      return ids;
    } catch (e) {
      console.error('Load joined groups failed', e);
      return null;
    }
  };

  const loadJoinRequests = async (page = 1) => {
    setRequestsLoading(true);
    setRequestsPage(page);
    try {
      const res = await groupApi.getSentJoinRequests(page, requestsPageSize);
      const { list, total: t } = normalizeListResult(res);
      setRequestsList(list);
      setRequestsTotal(t);

      // Reset appliedGroups map completely based on current list
      const newAppliedMap = {};
      list.forEach((item) => {
        if (item?.groupId) {
          newAppliedMap[String(item.groupId)] = item.status;
        }
      });
      setAppliedGroups(newAppliedMap);

      await loadJoinedGroupIds();

      const groupIds = Array.from(new Set(list.map((item) => String(item.groupId)).filter(Boolean)));
      const missing = groupIds.filter((id) => !groupInfoMap[id]);
      if (missing.length) {
        const results = await Promise.all(
          missing.map(async (id) => {
            try {
              const detailRes = await groupApi.getDetails(id);
              return detailRes?.group || detailRes?.data || detailRes;
            } catch {
              return null;
            }
          })
        );
        setGroupInfoMap((prev) => {
          const next = { ...prev };
          results.forEach((info) => {
            if (info?.groupId) next[String(info.groupId)] = info;
          });
          return next;
        });
      }
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (requestsOpen) {
      loadJoinRequests(1);
    }
  }, [requestsOpen]);

  // Initial sync of application status
  useEffect(() => {
    loadJoinRequests(1);
  }, []);

  const activeMeta =
    activeTab === 'group'
      ? {
          title: '搜索群组',
          description: '支持群ID精确查找，也支持关键词模糊搜索',
          placeholder: '输入群ID或关键词',
        }
      : {
          title: '搜索用户',
          description: '支持用户名/手机号/邮箱精确搜索',
          placeholder: '输入用户名/手机号/邮箱',
        };

  const resultCount = activeTab === 'group' ? groups.length : (total || users.length);

  const renderUserList = () => (
    <List
      loading={loading}
      dataSource={users}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searched
                ? '暂无结果（需精确匹配）'
                : '请输入用户名/手机号/邮箱进行搜索'
            }
          />
        ),
      }}
      renderItem={(item) => {
        const isFriend = friendIds.has(item.id);
        const isSent = sentFriendRequests.has(item.id);
        const isSelf = currentUser && String(currentUser.id) === String(item.id);

        let actionNode;
        if (isSelf) {
          actionNode = <Tag>我自己</Tag>;
        } else if (isFriend) {
          actionNode = <Tag color="green">已添加</Tag>;
        } else if (isSent) {
          actionNode = <Tag color="gold">已申请</Tag>;
        } else {
          actionNode = (
            <Button
              key="add"
              type="primary"
              ghost
              icon={<UserAddOutlined />}
              onClick={() => handleAddFriendClick(item)}
            >
              加好友
            </Button>
          );
        }

        return (
          <List.Item
            actions={[
              <Button
                key="view"
                type="link"
                onClick={() => {
                  setSelectedUserId(item.id);
                  setProfileOpen(true);
                }}
              >
                查看
              </Button>,
              actionNode,
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar src={item.avatar} icon={<UserOutlined />} size="large" />}
              title={
                <Space>
                  <Text strong>{item.nickname || item.username}</Text>
                  <Tag color={item.status === 1 ? 'green' : 'red'}>
                    {item.status === 1 ? '正常' : '禁用'}
                  </Tag>
                </Space>
              }
              description={
                <Space direction="vertical" size={0}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    @{item.username}
                  </Text>
                  {item.signature ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.signature}
                    </Text>
                  ) : null}
                </Space>
              }
            />
          </List.Item>
        );
      }}
    />
  );

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
                ? '暂无结果（请检查关键词）'
                : '请输入群ID或关键词进行搜索'
            }
          />
        ),
      }}
      renderItem={(item) => {
        const status = appliedGroups[String(item.groupId)];
        const isJoined = joinedGroupIds.has(String(item.groupId));
        const isPending = status === 0 && !isJoined;
        const isApproved = status === 1 && isJoined;
        const isRejected = status === 2 && !isJoined;
        const isDismissed = item.status === 2;
        const isFull =
          Number.isFinite(item?.memberCount) &&
          Number.isFinite(item?.maxMembers) &&
          Number(item.maxMembers) > 0 &&
          Number(item.memberCount) >= Number(item.maxMembers);

        const statusTags = [];
        if (isDismissed) statusTags.push(<Tag key="dismissed" color="red">已解散</Tag>);
        if (isFull) statusTags.push(<Tag key="full" color="red">已满员</Tag>);
        if (isApproved) statusTags.push(<Tag key="approved" color="green">已通过</Tag>);
        if (isPending) statusTags.push(<Tag key="pending" color="gold">待审核</Tag>);
        if (isRejected) statusTags.push(<Tag key="rejected" color="red">已拒绝</Tag>);

        let actionNode = null;
        if (isJoined) {
          actionNode = (
            <Button
              type="primary"
              icon={<MessageOutlined />}
              onClick={() => navigate(`/chat?type=group&id=${item.groupId}`)}
            >
              进入群聊
            </Button>
          );
        } else if (isPending) {
          actionNode = <Tag color="gold">已申请</Tag>;
        } else if (isDismissed) {
          actionNode = <Tag color="red">已解散</Tag>;
        } else if (isFull) {
          actionNode = <Tag color="red">已满员</Tag>;
        } else if (isRejected) {
          actionNode = (
            <Button
              key="join"
              type="primary"
              ghost
              icon={<PlusOutlined />}
              onClick={() => handleJoinGroup(item)}
            >
              重新申请
            </Button>
          );
        } else {
          actionNode = (
            <Button
              key="join"
              type="primary"
              ghost
              icon={<PlusOutlined />}
              onClick={() => handleJoinGroup(item)}
            >
              申请加入
            </Button>
          );
        }
        return (
          <List.Item
            actions={[
              actionNode,
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar shape="square" src={item.avatar} icon={<TeamOutlined />} />}
              title={
                <Space size={8} wrap>
                  <Text strong>{item.name}</Text>
                  {statusTags}
                </Space>
              }
              description={
                <Space direction="vertical" size={0}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    ID: {item.groupId}
                  </Text>
                  <Space size={8} wrap>
                    {Number.isFinite(item.memberCount) ? <Tag color="blue">{item.memberCount} 人</Tag> : null}
                    {Number.isFinite(item.maxMembers) ? <Tag>上限 {item.maxMembers}</Tag> : null}
                  </Space>
                  <Text type="secondary">{item.description || '-'}</Text>
                </Space>
              }
            />
          </List.Item>
        );
      }}
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
        const res = isGroupId(kw)
          ? await groupApi.searchGroupPrecise(kw)
          : await groupApi.searchGroup(kw);
        const { list } = normalizeListResult(res);
        setGroups(list.filter((g) => g.status !== 2));
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
            {activeTab === 'group' ? (
              <Button size="large" icon={<HistoryOutlined />} onClick={() => setRequestsOpen(true)}>
                我的入群申请
              </Button>
            ) : null}
            <Text type="secondary">共 {resultCount} 条</Text>
          </Space>
        </Space>
      </Card>

      <Card style={{ borderRadius: 16 }}>
        {activeTab === 'user' ? renderUserList() : renderGroupList()}
      </Card>

      <JoinGroupModal
        open={joinModalOpen}
        group={currentGroup}
        applied={appliedGroups[String(currentGroup?.groupId)] === 0}
        onCancel={() => setJoinModalOpen(false)}
        onSubmit={submitJoinRequest}
        loading={joinLoading}
      />

      <AddFriendModal
        open={addFriendOpen}
        targetUser={friendTarget}
        onCancel={() => setAddFriendOpen(false)}
        onSubmit={submitAddFriend}
        submitting={addFriendLoading}
      />

      <Drawer
        title="我的入群申请"
        open={requestsOpen}
        onClose={() => setRequestsOpen(false)}
        width={520}
      >
        <List
          loading={requestsLoading}
          dataSource={requestsList}
          locale={{ emptyText: <Empty description="暂无申请记录" /> }}
          pagination={{
            current: requestsPage,
            pageSize: requestsPageSize,
            total: requestsTotal,
            showSizeChanger: false,
            onChange: (page) => loadJoinRequests(page),
          }}
          renderItem={(item) => {
            const groupInfo = groupInfoMap[String(item.groupId)] || {};
            return (
              <List.Item style={{ paddingInline: 0 }}>
                <GroupJoinRequestCard
                  request={item}
                  group={groupInfo}
                  mode="sent"
                  onEnterGroup={() => navigate(`/chat?type=group&id=${item.groupId}`)}
                />
              </List.Item>
            );
          }}
        />
      </Drawer>

      <UserProfileModal
        open={profileOpen}
        userId={selectedUserId}
        currentUserId={currentUser?.id}
        onClose={() => {
          setProfileOpen(false);
          setSelectedUserId(null);
        }}
        onSendMessage={(targetUser) => {
          navigate(`/chat?type=friend&id=${targetUser.id}`);
          setProfileOpen(false);
        }}
      />
    </MainLayout>
  );
};

export default UserSearch;

