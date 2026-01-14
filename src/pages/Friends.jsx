import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Input, List, Space, Typography, message, Avatar } from 'antd';
import { BellOutlined, PlusOutlined, SafetyOutlined, FileTextOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import UserProfileModal from '../components/UserProfileModal';
import FriendCard from '../components/friend/FriendCard';
import RemarkEditModal from '../components/friend/RemarkEditModal';
import { friendApi } from '../api/friend';
import { getUserInfo } from '../api/auth';
import useUserCache from '../hooks/useUserCache';

const { Title, Text } = Typography;

const Friends = () => {
  const navigate = useNavigate();
  const { getUser, ensureUsers } = useUserCache();

  const [currentUser, setCurrentUser] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);

  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [remarkOpen, setRemarkOpen] = useState(false);
  const [remarkSubmitting, setRemarkSubmitting] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);

  const [workingFriendId, setWorkingFriendId] = useState(null);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const data = await friendApi.getFriendList(p, pageSize);
      const items = Array.isArray(data?.list) ? data.list : [];
      setList(items);
      setTotal(Number(data?.total || 0));
      await ensureUsers(items.map((it) => it.friendId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
    getUserInfo().then(res => setCurrentUser(res.user || res)).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return list;
    return list.filter((it) => {
      const user = getUser(it.friendId);
      const hay = [
        it.remark || '',
        user?.nickname || '',
        user?.username || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(kw);
    });
  }, [keyword, list, getUser]);

  const showSelf = useMemo(() => {
    if (!currentUser) return false;
    const kw = keyword.trim().toLowerCase();
    if (!kw) return true;
    return ['我', '文件', '助手', 'myself', 'file'].some(k => k.includes(kw)) || 
           currentUser.nickname?.toLowerCase().includes(kw) || 
           currentUser.username?.toLowerCase().includes(kw);
  }, [currentUser, keyword]);

  const openRemark = (relation) => {
    setSelectedFriend(relation);
    setRemarkOpen(true);
  };

  const submitRemark = async ({ remark }) => {
    if (!selectedFriend?.friendId) return;
    setRemarkSubmitting(true);
    try {
      await friendApi.updateRemark(selectedFriend.friendId, remark);
      message.success('备注已更新');
      setRemarkOpen(false);
      setSelectedFriend(null);
      await load(page);
    } finally {
      setRemarkSubmitting(false);
    }
  };

  const doDelete = async (friendId) => {
    setWorkingFriendId(friendId);
    try {
      await friendApi.deleteFriend(friendId);
      message.success('已删除好友');
      const nextPage = page > 1 && list.length === 1 ? page - 1 : page;
      setPage(nextPage);
      await load(nextPage);
    } finally {
      setWorkingFriendId(null);
    }
  };

  const toggleBlacklist = async (relation) => {
    const friendId = relation?.friendId;
    if (!friendId) return;
    const isBlack = relation?.status !== 2;
    setWorkingFriendId(friendId);
    try {
      await friendApi.setBlacklist(friendId, isBlack);
      message.success(isBlack ? '已拉黑' : '已取消拉黑');
      await load(page);
    } finally {
      setWorkingFriendId(null);
    }
  };

  return (
    <MainLayout pageTitle="好友">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            好友
          </Title>
          <Text type="secondary">管理好友：搜索、备注、删除、拉黑。</Text>
        </div>
        <Space>
          <Button icon={<BellOutlined />} onClick={() => navigate('/friends/requests')}>
            好友申请
          </Button>
          <Button icon={<SafetyOutlined />} onClick={() => navigate('/friends/blacklist')}>
            黑名单
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/friends/add')}>
            添加好友
          </Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 16, marginBottom: 16 }}>
        <Input
          size="large"
          placeholder="搜索备注 / 昵称 / 用户名"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
        />
      </Card>

      <Card style={{ borderRadius: 16 }}>
        {showSelf && currentUser && (
           <div style={{ marginBottom: 12 }}>
             <FriendCard
               relation={{ 
                 friendId: currentUser.id, 
                 remark: `${currentUser.nickname || currentUser.username} (我)`,
                 isSelf: true 
               }}
               user={currentUser}
               working={false}
               onViewProfile={() => {
                 navigate(`/chat?type=friend&id=${currentUser.id}`);
               }}
             />
           </div>
        )}

        <List
          loading={loading}
          dataSource={filtered}
          locale={{ emptyText: <Empty description="暂无好友" /> }}
          split={false}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
            style: { marginTop: 16 },
          }}
          renderItem={(relation) => {
            const user = getUser(relation.friendId);
            return (
              <List.Item style={{ padding: 0, marginBottom: 12 }}>
                <FriendCard
                  relation={relation}
                  user={user}
                  working={workingFriendId === relation.friendId}
                  onViewProfile={() => {
                    setSelectedUserId(relation.friendId);
                    setProfileOpen(true);
                  }}
                  onEditRemark={() => openRemark(relation)}
                  onToggleBlacklist={() => toggleBlacklist(relation)}
                  onDelete={() => doDelete(relation.friendId)}
                />
              </List.Item>
            );
          }}
        />
      </Card>

      <UserProfileModal
        open={profileOpen}
        userId={selectedUserId}
        currentUserId={currentUser?.id}
        onClose={() => {
          setProfileOpen(false);
          setSelectedUserId(null);
        }}
        onSendMessage={(user) => {
            navigate(`/chat?type=friend&id=${user.id}`);
            setProfileOpen(false);
        }}
      />

      <RemarkEditModal
        open={remarkOpen}
        initialRemark={selectedFriend?.remark || ''}
        submitting={remarkSubmitting}
        onCancel={() => {
          setRemarkOpen(false);
          setSelectedFriend(null);
        }}
        onSubmit={submitRemark}
      />
    </MainLayout>
  );
};

export default Friends;

