import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Input, List, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import UserProfileModal from '../components/UserProfileModal';
import FriendCard from '../components/friend/FriendCard';
import RemarkEditModal from '../components/friend/RemarkEditModal';
import { friendApi } from '../api/friend';
import useUserCache from '../hooks/useUserCache';

const { Title, Text } = Typography;

const FriendsBlacklist = () => {
  const navigate = useNavigate();
  const { getUser, ensureUsers } = useUserCache();

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');

  const [workingFriendId, setWorkingFriendId] = useState(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [remarkOpen, setRemarkOpen] = useState(false);
  const [remarkSubmitting, setRemarkSubmitting] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const data = await friendApi.getBlacklist(p, pageSize);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const cancelBlack = async (friendId) => {
    setWorkingFriendId(friendId);
    try {
      await friendApi.setBlacklist(friendId, false);
      message.success('已取消拉黑');
      const nextPage = page > 1 && list.length === 1 ? page - 1 : page;
      setPage(nextPage);
      await load(nextPage);
    } finally {
      setWorkingFriendId(null);
    }
  };

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

  const normalizedList = useMemo(() => {
    return list
      .map((it) => ({
        ...it,
        friendId: it.friendId,
        status: 2,
      }))
      .filter((it) => it.friendId);
  }, [list]);

  const filteredList = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return normalizedList;
    return normalizedList.filter((it) => {
      const user = getUser(it.friendId);
      const hay = [it.remark || '', user?.nickname || '', user?.username || '']
        .join(' ')
        .toLowerCase();
      return hay.includes(kw);
    });
  }, [keyword, normalizedList, getUser]);

  return (
    <MainLayout pageTitle="黑名单">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            黑名单
          </Title>
          <Text type="secondary">已拉黑的好友不会再收到你的消息/申请（以服务端逻辑为准）。</Text>
        </div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/friends')}>
          返回好友
        </Button>
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
        <List
          loading={loading}
          dataSource={filteredList}
          locale={{ emptyText: <Empty description="暂无黑名单" /> }}
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
                  onToggleBlacklist={() => cancelBlack(relation.friendId)}
                />
              </List.Item>
            );
          }}
        />
        <Space style={{ height: 4 }} />
      </Card>

      <UserProfileModal
        open={profileOpen}
        userId={selectedUserId}
        onClose={() => {
          setProfileOpen(false);
          setSelectedUserId(null);
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

export default FriendsBlacklist;
