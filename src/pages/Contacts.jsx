import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Layout, List, Avatar, Typography, Button, Space, Tabs, Empty, Card, Tag, Modal, Form, Input, InputNumber, Row, Col, message, Dropdown, Descriptions, Popover } from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  MessageOutlined, 
  PlusOutlined, 
  DeleteOutlined, 
  ExclamationCircleOutlined,
  UserAddOutlined,
  ManOutlined,
  WomanOutlined,
  QuestionOutlined,
  IdcardOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  HighlightOutlined,
  CheckCircleOutlined,
  StopOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import SearchAddModal from '../components/SearchAddModal';
import GlobalSearchBox from '../components/GlobalSearchBox';
import { friendApi } from '../api/friend';
import { groupApi } from '../api/group';
import { getUserInfo } from '../api/auth';
import useUserCache from '../hooks/useUserCache';
import GroupJoinRequestCard from '../components/group/GroupJoinRequestCard';

const { Sider, Content } = Layout;
const { Text, Title } = Typography;
const { confirm } = Modal;

// Reusable User Card Component
const UserDetailCard = ({ user, friend, navigate, onClose }) => {
  if (!user) return <Empty description="无法加载用户信息" />;
  
  let genderText = '未知';
  let genderColor = 'default';
  let genderIcon = <QuestionOutlined />;

  if (user.gender == 1) {
    genderText = '男';
    genderColor = 'blue';
    genderIcon = <ManOutlined />;
  } else if (user.gender == 2) {
    genderText = '女';
    genderColor = 'magenta';
    genderIcon = <WomanOutlined />;
  }

  const handleSendMessage = () => {
    if (navigate) {
      navigate(`/chat?type=friend&id=${friend ? friend.friendId : user.id}`);
    }
    if (onClose) onClose();
  };

  const signature = user.signature || '-';
  const formatTime = (ts) => {
     if (!ts) return '-';
     return new Date(Number(ts) * 1000).toLocaleString();
  };

  return (
    <Card 
      style={{ width: '100%', maxWidth: 480, borderRadius: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.08)', border: 'none', overflow: 'hidden' }}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ height: 120, background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)' }}></div>
      <div style={{ padding: '0 32px 32px', textAlign: 'center', marginTop: -60 }}>
        <Avatar 
           size={120} 
           src={user.avatar} 
           icon={<UserOutlined />} 
           style={{ border: '4px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        />
        <Title level={3} style={{ marginTop: 16, marginBottom: 4 }}>
          {friend?.remark || user.nickname || user.username}
        </Title>
        <Text type="secondary">@{user.username}</Text>
        
        <div style={{ marginTop: 8 }}>
           <Tag icon={user.status === 1 ? <CheckCircleOutlined /> : <StopOutlined />} color={user.status === 1 ? 'success' : 'error'}>
              {user.status === 1 ? '状态正常' : '已禁用'}
           </Tag>
        </div>
        
        {/* Signature below name */}
        {signature !== '-' && (
          <div style={{ marginTop: 16 }}>
            <Text type="secondary" italic>“{signature}”</Text>
          </div>
        )}
        
        <div style={{ marginTop: 24, textAlign: 'left' }}>
           <Descriptions column={1} bordered size="small" labelStyle={{ whiteSpace: 'nowrap', width: 'auto' }}>
             <Descriptions.Item label={<Space><IdcardOutlined /> ID</Space>}>{user.id}</Descriptions.Item>
             <Descriptions.Item label={<Space>{genderIcon} 性别</Space>}>
                <Tag color={genderColor} style={{ marginRight: 0 }}>{genderText}</Tag>
             </Descriptions.Item>
             <Descriptions.Item label={<Space><HighlightOutlined /> 个性签名</Space>}>{signature}</Descriptions.Item>
             <Descriptions.Item label={<Space><EnvironmentOutlined /> 地区</Space>}>{user.region || '-'}</Descriptions.Item>
             <Descriptions.Item label={<Space><PhoneOutlined /> 电话</Space>}>{user.phone || '-'}</Descriptions.Item>
             <Descriptions.Item label={<Space><MailOutlined /> 邮箱</Space>}>{user.email || '-'}</Descriptions.Item>
             <Descriptions.Item label={<Space><CalendarOutlined /> 注册时间</Space>}>{formatTime(user.createdAt)}</Descriptions.Item>
           </Descriptions>
        </div>
        
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
           <Button type="primary" size="large" block icon={<MessageOutlined />} onClick={handleSendMessage}>
             发消息
           </Button>
           {friend && !friend.isSelf && (
             <Button size="large" block danger type="text">删除好友</Button>
           )}
        </div>
      </div>
    </Card>
  );
};

// Helper for Group Member Item with Popover State
const GroupMemberItem = ({ member, user, isOwner, isMe, onKick, navigate }) => {
  const [open, setOpen] = useState(false);
  const isMuted = member?.mute === 1 || member?.muted === 1;

  // Styling for the member card
  const itemStyle = {
    textAlign: 'center', 
    position: 'relative', 
    padding: '16px 8px', 
    background: '#f8fafc', 
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    transition: 'all 0.2s',
    cursor: 'pointer',
    height: 148,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
  };

  const content = (
    <div onMouseLeave={() => setOpen(false)} style={{ width: 420 }}>
      <UserDetailCard user={user} navigate={navigate} onClose={() => setOpen(false)} />
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      content={content}
      overlayStyle={{ padding: 0 }}
      overlayInnerStyle={{ backgroundColor: 'transparent', boxShadow: 'none', padding: 0 }}
      arrow={false}
      styles={{ body: { padding: 0 } }} // Antd v5 Popover body padding removal
      getPopupContainer={(node) => node.parentNode} // Fix page shake
    >
      <div style={itemStyle}>
        <Avatar src={user?.avatar} icon={<UserOutlined />} size={48} />
        <div style={{ marginTop: 12, fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
          {member.nickname || user?.nickname || user?.username}
        </div>
        <div style={{ marginTop: 6, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           {member.role === 1 && (
             <Tag color="gold" style={{ margin: 0, marginInlineEnd: 0, marginBottom: 0, height: 22, lineHeight: '22px' }}>
               群主
             </Tag>
           )}
           {member.role === 2 && (
             <Tag color="blue" style={{ margin: 0, marginInlineEnd: 0, marginBottom: 0, height: 22, lineHeight: '22px' }}>
               管理员
             </Tag>
           )}
           {isMuted && (
             <Tag color="red" style={{ margin: 0, marginInlineStart: 6, marginBottom: 0, height: 22, lineHeight: '22px' }}>
               禁言
             </Tag>
           )}
        </div>
        {isOwner && !isMe && (
          <div 
            style={{ position: 'absolute', top: 4, right: 4 }}
            onClick={(e) => { 
              e.stopPropagation(); 
              onKick(member.userId); 
            }}
          >
             <DeleteOutlined style={{ color: '#ef4444', fontSize: 12, padding: 4, cursor: 'pointer' }} />
          </div>
        )}
      </div>
    </Popover>
  );
};

const sortGroupMembers = (list) => {
  const members = Array.isArray(list) ? [...list] : [];
  const roleOrder = (role) => (role === 1 ? 0 : role === 2 ? 1 : 2);
  const getJoinAt = (m) => {
    const raw =
      m?.joinedAt ??
      m?.joinAt ??
      m?.joinTime ??
      m?.join_time ??
      m?.createdAt ??
      m?.created_at;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return n > 1e12 ? Math.floor(n / 1000) : n;
  };
  return members
    .map((m, idx) => ({ m, idx }))
    .sort((a, b) => {
      const ra = roleOrder(a.m?.role);
      const rb = roleOrder(b.m?.role);
      if (ra !== rb) return ra - rb;

      const ja = getJoinAt(a.m);
      const jb = getJoinAt(b.m);
      if (ja != null && jb != null && ja !== jb) return ja - jb;

      return a.idx - b.idx;
    })
    .map(({ m }) => m);
};

const Contacts = () => {
  const navigate = useNavigate();
  const location = useLocation(); 
  const { getUser, ensureUsers } = useUserCache();
  
  const [activeTab, setActiveTab] = useState('friends');
  const [selectedItem, setSelectedItem] = useState(null); 
  
  // Data
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // 搜索过滤
  const [searchText, setSearchText] = useState('');

  // Group Details
  const [groupMembers, setGroupMembers] = useState([]);
  const [myRoleData, setMyRoleData] = useState(null); // Changed from myRole number to object { groupId, role }
  const [joinRequests, setJoinRequests] = useState([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [joinRequestsPage, setJoinRequestsPage] = useState(1);
  const [joinRequestsTotal, setJoinRequestsTotal] = useState(0);
  const [workingJoinRequestId, setWorkingJoinRequestId] = useState(null);
  const joinRequestsPageSize = 6;

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState('user');
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteFriendId, setInviteFriendId] = useState(null);
  const [inviteMessage, setInviteMessage] = useState('');
  
  const [createGroupForm] = Form.useForm();

  // Initial Fetch
  const fetchData = useCallback(async () => {
    try {
      const userRes = await getUserInfo();
      setCurrentUser(userRes.user || userRes);

      const fRes = await friendApi.getFriendList(1, 100);
      setFriends(fRes.list || []);
      await ensureUsers(fRes.list?.map(f => f.friendId) || []);

      const gRes = await groupApi.getList(1, 100);
      // Filter out dismissed groups (status === 2)
      setGroups((gRes.list || []).filter(g => g.status !== 2));
      
    } catch (e) {
      console.error(e);
    }
  }, [ensureUsers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
     if (location.state?.view) {
       setSelectedItem({ type: location.state.view });
     }
  }, [location.state]);

  // Fetch Group Members and Determine Role
  useEffect(() => {
    if (selectedItem?.type === 'group') {
      const currentGroupId = selectedItem.data.groupId;
      setGroupMembers([]); // Reset members immediately
      
      // Optimistic role set if owner
      const isOwner = String(selectedItem.data.ownerId) === String(currentUser?.id);
      setMyRoleData({ groupId: currentGroupId, role: isOwner ? 1 : null });

      const fetchMembers = async () => {
        try {
          const res = await groupApi.getMembers(currentGroupId, 1, 50);
          const list = sortGroupMembers(res.list || []);
          
          // Only update if still on same group
          if (selectedItem.data.groupId === currentGroupId) {
             setGroupMembers(list);
             await ensureUsers(list.map(m => m.userId) || []);

             // Accurate role check
             const me = list.find(m => String(m.userId) === String(currentUser?.id));
             if (me) {
               setMyRoleData({ groupId: currentGroupId, role: me.role });
             }
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchMembers();
    } else {
      setMyRoleData(null);
    }
  }, [selectedItem, ensureUsers, currentUser]);

  const currentGroupRole = useMemo(() => {
      if (selectedItem?.type !== 'group') return null;
      if (myRoleData && String(myRoleData.groupId) === String(selectedItem.data.groupId)) {
          return myRoleData.role;
      }
      return null;
  }, [myRoleData, selectedItem]);

  const canManageJoinRequests = currentGroupRole === 1 || currentGroupRole === 2;

  const loadJoinRequests = useCallback(async (page = 1) => {
    if (selectedItem?.type !== 'group') return;
    
    // Strict Permission Check
    // If role is not loaded yet or mismatch, currentGroupRole will be null/mismatch
    // and canManageJoinRequests will be false. 
    // But we double check here just in case caller bypassed it.
    if (!myRoleData || String(myRoleData.groupId) !== String(selectedItem.data.groupId)) {
        return;
    }
    const role = myRoleData.role;
    if (role !== 1 && role !== 2) return;

    setJoinRequestsLoading(true);
    setJoinRequestsPage(page);
    try {
      const res = await groupApi.getJoinRequests(selectedItem.data.groupId, page, joinRequestsPageSize);
      const list = Array.isArray(res) ? res : (res?.list || res?.data?.list || []);
      const total = Number(res?.total || res?.totalCount || res?.data?.total || list.length);
      const normalized = list.map((req) => ({
        ...req,
        groupName: req.groupName || selectedItem.data.name,
        groupAvatar: req.groupAvatar || selectedItem.data.avatar,
      }));
      setJoinRequests(normalized);
      setJoinRequestsTotal(total);
      await ensureUsers(list.map((req) => req.userId) || []);
    } catch (e) {
      // Suppress permission error and 404 (Not Found)
      if (e?.response?.status === 404) {
         console.warn('Join requests API not found (404), feature might be disabled on backend.');
         setJoinRequests([]);
         setJoinRequestsTotal(0);
      } else if (e?.response?.status !== 403 && !e?.message?.includes('只有群主')) {
         console.error(e);
      }
    } finally {
      setJoinRequestsLoading(false);
    }
  }, [selectedItem, joinRequestsPageSize, ensureUsers, myRoleData]);

  useEffect(() => {
    if (selectedItem?.type === 'group' && canManageJoinRequests) {
      setJoinRequestsPage(1);
      loadJoinRequests(1);
    } else {
      setJoinRequests([]);
      setJoinRequestsTotal(0);
    }
  }, [selectedItem?.type, selectedItem?.data?.groupId, canManageJoinRequests, loadJoinRequests]);

  const handleGlobalSearch = (value) => {
    setSearchText(value);
  };

  const onGlobalSelect = (value, option) => {
     if (option.type === 'user') {
       const existing = friends.find(f => f.friendId === option.data.id);
       if (existing) {
         setActiveTab('friends');
         setSelectedItem({ type: 'friend', data: existing });
       } else {
         message.info('该用户不是好友，请先添加');
         setSearchTab('user');
         setIsSearchOpen(true);
       }
     } else {
       const existing = groups.find(g => g.groupId === option.data.groupId);
       if (existing) {
         setActiveTab('groups');
         setSelectedItem({ type: 'group', data: existing });
       } else {
         message.info('未加入该群，请先申请');
         setSearchTab('group');
         setIsSearchOpen(true);
       }
     }
     setSearchText('');
  };

  // Filtered Lists
  const filteredFriends = useMemo(() => {
    const list = friends.filter(item => {
      const u = getUser(item.friendId);
      const name = item.remark || u?.nickname || u?.username || '';
      return name.toLowerCase().includes(searchText.toLowerCase());
    });

    if (currentUser) {
       const name = currentUser.nickname || currentUser.username || '';
       const selfName = `${name} (我)`;
       if (!searchText || selfName.toLowerCase().includes(searchText.toLowerCase())) {
           const selfItem = {
               friendId: currentUser.id,
               remark: selfName,
               isSelf: true
           };
           return [selfItem, ...list];
       }
    }
    return list;
  }, [friends, currentUser, searchText, getUser]);

  const filteredGroups = groups.filter(item => 
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleCreateGroup = async (values) => {
    try {
      const payload = {
        name: values.name,
        description: values.description,
        avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=' + values.name
      };
      if (values.maxMembers) payload.maxMembers = Number(values.maxMembers);
      await groupApi.create(payload);
      message.success('群组创建成功');
      setIsCreateGroupOpen(false);
      createGroupForm.resetFields();
      fetchData(); 
    } catch {
      message.error('创建失败');
    }
  };

  const handleInvite = async () => {
    if (!inviteFriendId || selectedItem?.type !== 'group') return;
    try {
      await groupApi.sendInvitation({
        groupId: String(selectedItem.data.groupId),
        inviteeId: inviteFriendId,
        message: inviteMessage || undefined
      });
      message.success('邀请已发送');
      setIsInviteOpen(false);
      setInviteFriendId(null);
      setInviteMessage('');
    } catch {
      message.error('邀请失败');
    }
  };

  const handleKick = (memberId) => {
    confirm({
      title: '确认踢出',
      icon: <ExclamationCircleOutlined />,
      content: '确定要将该成员踢出群组吗？',
      onOk: async () => {
        try {
          await groupApi.kick(selectedItem.data.groupId, memberId);
          message.success('已踢出');
          
          // Optimistic update
          setGroupMembers(prev => prev.filter(m => String(m.userId) !== String(memberId)));
          
          // Re-fetch to be sure, with a slight delay for DB consistency
          setTimeout(async () => {
             try {
               const res = await groupApi.getMembers(selectedItem.data.groupId, 1, 50);
               // Only update if we are still viewing the same group
               if (selectedItem?.data?.groupId) {
                  const list = sortGroupMembers(res.list || []);
                  setGroupMembers(list);
               }
             } catch(e) { console.error(e); }
          }, 500);
        } catch {
          message.error('操作失败');
        }
      }
    });
  };

  const handleQuitGroup = () => {
    confirm({
      title: '确认退出',
      icon: <ExclamationCircleOutlined />,
      content: '确定要退出该群组吗？',
      danger: true,
      onOk: async () => {
        try {
          await groupApi.quit(selectedItem.data.groupId);
          message.success('已退出');
          setSelectedItem(null);
          fetchData();
        } catch {
          message.error('操作失败');
        }
      }
    });
  };

  const handleDismissGroup = () => {
    confirm({
      title: '解散群组',
      icon: <ExclamationCircleOutlined />,
      content: '此操作不可恢复，确定要解散该群组吗？',
      danger: true,
      onOk: async () => {
        try {
          await groupApi.dismiss(selectedItem.data.groupId);
          message.success('群组已解散');
          setSelectedItem(null);
          fetchData();
        } catch {
          message.error('操作失败');
        }
      }
    });
  };

  const handleJoinRequestAction = async (requestId, action) => {
    if (!selectedItem?.data?.groupId) return;
    setWorkingJoinRequestId(requestId);
    try {
      await groupApi.handleJoinRequest({ requestId, action });
      message.success(action === 1 ? '已同意' : '已拒绝');
      await loadJoinRequests(joinRequestsPage);
    } catch {
      message.error('操作失败');
    } finally {
      setWorkingJoinRequestId(null);
    }
  };

  // Renderers
  const renderFriendDetail = (friend) => {
    if (!friend || !friend.friendId) return <Empty description="无法加载好友信息" />;
    let u = getUser(friend.friendId);
    if (friend.isSelf && currentUser) u = currentUser;
    
    if (!u) {
       return (
         <div style={{ padding: 40, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Card loading style={{ width: '100%', maxWidth: 480, borderRadius: 24 }} />
         </div>
       );
    }
    
    return (
      <div style={{ padding: 40, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <UserDetailCard user={u} friend={friend} navigate={navigate} />
      </div>
    );
  };

  const renderGroupDetail = (group) => {
    const role = currentGroupRole || (String(group.ownerId) === String(currentUser?.id) ? 1 : null);
    const isOwner = role === 1;
    const canManageGroup = role === 1 || role === 2;
    const sortedMembers = sortGroupMembers(groupMembers);
    const pendingJoinCount = joinRequests.filter((req) => req.status === 0).length;
    
    // Stats
    const memberCount = groupMembers.length || group.memberCount || 0;
    const maxMembers = group.maxMembers || 200;

    return (
      <div style={{ height: '100%', overflowY: 'auto' }}>
        {/* Hero Header */}
        <div style={{ 
           background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)', 
           padding: '40px 32px 32px',
           borderBottom: '1px solid #f1f5f9'
        }}>
           <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Avatar 
                shape="square" 
                size={100} 
                src={group.avatar} 
                icon={<TeamOutlined />} 
                style={{ borderRadius: 24, boxShadow: '0 8px 24px rgba(14, 165, 233, 0.15)', border: '4px solid #fff' }} 
              />
              
              <Title level={2} style={{ marginTop: 20, marginBottom: 8 }}>{group.name}</Title>
              <Space style={{ marginBottom: 16 }}>
                 <Tag bordered={false} style={{ fontSize: 13, padding: '4px 8px' }}>ID: {group.groupId}</Tag>
                 {isOwner && <Tag color="gold" bordered={false} style={{ fontSize: 13, padding: '4px 8px' }}>我是群主</Tag>}
                 {!isOwner && role === 2 && <Tag color="blue" bordered={false} style={{ fontSize: 13, padding: '4px 8px' }}>管理员</Tag>}
              </Space>
              
              <Text type="secondary" style={{ maxWidth: 500, lineHeight: 1.6 }}>
                {group.description || '暂无群简介'}
              </Text>

              {/* Action Bar */}
              <div style={{ display: 'flex', gap: 16, marginTop: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
                 <Button 
                   type="primary" 
                   size="large" 
                   shape="round"
                   icon={<MessageOutlined />} 
                   onClick={() => navigate(`/chat?type=group&id=${group.groupId}`)}
                   style={{ height: 48, paddingLeft: 24, paddingRight: 24, fontSize: 16 }}
                 >
                   进入群聊
                 </Button>
                 
                 <Button 
                   size="large" 
                   shape="round" 
                   icon={<UserAddOutlined />} 
                   onClick={() => {
                      setInviteFriendId(null);
                      setInviteMessage('');
                      setIsInviteOpen(true);
                   }}
                   style={{ height: 48, paddingLeft: 24, paddingRight: 24, fontSize: 16 }}
                 >
                   邀请成员
                 </Button>
                 
                 <Button 
                   size="large" 
                   shape="round" 
                   danger
                   icon={isOwner ? <DeleteOutlined /> : <StopOutlined />} 
                   onClick={isOwner ? handleDismissGroup : handleQuitGroup}
                   style={{ height: 48, paddingLeft: 24, paddingRight: 24, fontSize: 16 }}
                 >
                   {isOwner ? '解散群组' : '退出群组'}
                 </Button>
              </div>
           </div>
        </div>

        {/* Content Section */}
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px' }}>
          
          {/* Join Requests (Admin Only) */}
          {canManageJoinRequests && (
            <Card
              bordered={false}
              style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: 32 }}
              title={
                <Space>
                  <span style={{ fontSize: 18, fontWeight: 600 }}>入群申请</span>
                  {pendingJoinCount > 0 && <Badge count={pendingJoinCount} />}
                </Space>
              }
              extra={
                <Button type="link" onClick={() => loadJoinRequests(joinRequestsPage)} loading={joinRequestsLoading}>
                  刷新列表
                </Button>
              }
            >
               {joinRequests.length > 0 ? (
                 <List
                    loading={joinRequestsLoading}
                    dataSource={joinRequests}
                    rowKey="id"
                    split={false}
                    pagination={{
                      current: joinRequestsPage,
                      pageSize: joinRequestsPageSize,
                      total: joinRequestsTotal,
                      showSizeChanger: false,
                      onChange: (page) => loadJoinRequests(page),
                      align: 'center'
                    }}
                    renderItem={(item) => {
                      const u = getUser(item.userId);
                      return (
                        <div style={{ marginBottom: 12 }}>
                          <GroupJoinRequestCard
                            request={item}
                            user={u}
                            group={group}
                            mode="received"
                            working={workingJoinRequestId === item.id}
                            onAccept={() => handleJoinRequestAction(item.id, 1)}
                            onReject={() => handleJoinRequestAction(item.id, 2)}
                          />
                        </div>
                      );
                    }}
                 />
               ) : (
                 <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无申请记录" />
               )}
            </Card>
          )}

          {/* Members Grid */}
          <div>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={4} style={{ margin: 0 }}>群成员</Title>
                <Tag style={{ fontSize: 14, padding: '4px 10px', borderRadius: 12 }}>{memberCount} / {maxMembers}</Tag>
             </div>
             
             <Row gutter={[16, 16]}>
               {sortedMembers.map(m => {
                 const u = getUser(m.userId);
                 const isMe = m.userId === currentUser?.id;
                 return (
                   <Col xs={12} sm={8} md={6} lg={4} xl={4} xxl={3} key={m.userId}>
                     <GroupMemberItem 
                       member={m}
                       user={u}
                       isOwner={canManageGroup}
                       isMe={isMe}
                       onKick={handleKick}
                       navigate={navigate}
                     />
                   </Col>
                 );
               })}
             </Row>
          </div>
        </div>
      </div>
    );
  };

  // Add Menu
  const addMenu = (
    <List
      style={{ width: 140 }}
      dataSource={[
        { label: '发起群聊', icon: <TeamOutlined />, key: 'create_group', onClick: () => setIsCreateGroupOpen(true) },
        { label: '搜索用户', icon: <UserAddOutlined />, key: 'search_user', onClick: () => { setSearchTab('user'); setIsSearchOpen(true); } },
        { label: '搜索群组', icon: <TeamOutlined />, key: 'search_group', onClick: () => { setSearchTab('group'); setIsSearchOpen(true); } },
      ]}
      renderItem={item => (
        <List.Item 
          onClick={item.onClick}
          style={{ cursor: 'pointer', padding: '8px 12px', borderBottom: 'none', transition: 'background 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Space>
             {item.icon}
             <Text>{item.label}</Text>
          </Space>
        </List.Item>
      )}
    />
  );

  return (
    <MainLayout pageTitle="联系人">
      <Layout style={{ height: 'calc(100vh - 32px)', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Sider width={280} theme="light" style={{ borderRight: '1px solid rgba(0,0,0,0.03)' }}>
           <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <GlobalSearchBox
                popupMatchSelectWidth={250}
                style={{ flex: 1 }}
                value={searchText}
                onChange={handleGlobalSearch}
                onSelect={onGlobalSelect}
                placeholder="搜索联系人/全局"
              />
              <Dropdown dropdownRender={() => <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>{addMenu}</div>} trigger={['click']}>
                <Button icon={<PlusOutlined />} shape="circle" style={{ flexShrink: 0 }} />
              </Dropdown>
           </div>
           
           <Tabs 
             activeKey={activeTab} 
             onChange={setActiveTab} 
             centered
             tabBarStyle={{ marginBottom: 0, padding: '0 16px' }}
             items={[
               {
                 key: 'friends',
                 label: '好友',
                 children: (
                   <div style={{ height: 'calc(100vh - 160px)', overflowY: 'auto', padding: '12px 0' }}>
                     <List
                       dataSource={filteredFriends}
                       locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无结果" /> }}
                       renderItem={item => {
                         let u = getUser(item.friendId);
                         if (item.isSelf && currentUser) {
                           u = currentUser;
                         }
                         const isSelected = selectedItem?.type === 'friend' && selectedItem?.data.friendId === item.friendId;
                         return (
                           <div style={{ padding: '4px 12px' }}>
                             <div 
                               onClick={() => setSelectedItem({ type: 'friend', data: item })}
                               style={{ 
                                 padding: '10px 12px', 
                                 cursor: 'pointer',
                                 background: isSelected ? '#e0f2fe' : 'transparent',
                                 borderRadius: 12,
                                 display: 'flex',
                                 alignItems: 'center',
                                 gap: 12,
                                 transition: 'all 0.2s'
                               }}
                             >
                                <Avatar src={u?.avatar} icon={<UserOutlined />} style={{ border: '1px solid #f1f5f9' }} />
                                <Text strong style={{ color: isSelected ? '#0284c7' : '#334155' }}>
                                  {item.remark || u?.nickname || u?.username}
                                </Text>
                             </div>
                           </div>
                         );
                       }}
                     />
                   </div>
                 )
               },
               {
                 key: 'groups',
                 label: '群组',
                 children: (
                   <div style={{ height: 'calc(100vh - 160px)', overflowY: 'auto', padding: '12px 0' }}>
                      <List
                       dataSource={filteredGroups}
                       locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无结果" /> }}
                       renderItem={item => {
                         const isSelected = selectedItem?.type === 'group' && selectedItem?.data.groupId === item.groupId;
                         return (
                           <div style={{ padding: '4px 12px' }}>
                             <div 
                               onClick={() => setSelectedItem({ type: 'group', data: item })}
                               style={{ 
                                 padding: '10px 12px', 
                                 cursor: 'pointer',
                                 background: isSelected ? '#e0f2fe' : 'transparent',
                                 borderRadius: 12,
                                 display: 'flex',
                                 alignItems: 'center',
                                 gap: 12,
                                 transition: 'all 0.2s'
                               }}
                             >
                                <Avatar shape="square" src={item.avatar} icon={<TeamOutlined />} style={{ borderRadius: 6 }} />
                                <Text strong style={{ color: isSelected ? '#0284c7' : '#334155' }}>
                                  {item.name}
                                </Text>
                             </div>
                           </div>
                         );
                       }}
                     />
                   </div>
                 )
               }
             ]}
           />
        </Sider>
        
        <Content style={{ overflowY: 'auto', background: '#f8fafc' }}>
           {selectedItem ? (
             selectedItem.type === 'friend' ? renderFriendDetail(selectedItem.data) :
             selectedItem.type === 'group' ? renderGroupDetail(selectedItem.data) :
             <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未知类型" style={{ marginTop: 100 }} />
           ) : (
             <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
                description="选择联系人或群组查看详情" 
                style={{ marginTop: 100, color: '#94a3b8' }} 
             />
           )}
        </Content>
      </Layout>

      {/* Modals */}
      <SearchAddModal open={isSearchOpen} onCancel={() => setIsSearchOpen(false)} initialTab={searchTab} />

      <Modal
        title="创建群组"
        open={isCreateGroupOpen}
        onCancel={() => setIsCreateGroupOpen(false)}
        onOk={() => createGroupForm.submit()}
      >
        <Form form={createGroupForm} onFinish={handleCreateGroup} layout="vertical">
          <Form.Item name="name" label="群名称" rules={[{ required: true, message: '请输入群名称' }]}>
            <Input placeholder="例如：技术交流群" />
          </Form.Item>
          <Form.Item name="description" label="群描述">
            <Input.TextArea placeholder="介绍一下这个群..." />
          </Form.Item>
          <Form.Item name="maxMembers" label="最大人数">
            <InputNumber min={2} max={2000} placeholder="默认 200" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="邀请好友入群"
        open={isInviteOpen}
        onCancel={() => {
          setIsInviteOpen(false);
          setInviteFriendId(null);
          setInviteMessage('');
        }}
        onOk={handleInvite}
        okButtonProps={{ disabled: !inviteFriendId }}
      >
        <List
          dataSource={friends.filter(f => !groupMembers.some(m => m.userId === f.friendId))}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可邀请的好友" /> }}
          pagination={{ pageSize: 5, size: 'small' }}
          renderItem={item => {
            const u = getUser(item.friendId);
            const isSelected = inviteFriendId === item.friendId;
            return (
              <List.Item 
                onClick={() => setInviteFriendId(item.friendId)}
                style={{ 
                  cursor: 'pointer', 
                  background: isSelected ? '#e0f2fe' : 'transparent',
                  padding: '8px 12px',
                  borderRadius: 8,
                  marginBottom: 4
                }}
              >
                <List.Item.Meta
                  avatar={<Avatar src={u?.avatar} icon={<UserOutlined />} />}
                  title={item.remark || u?.nickname || u?.username}
                />
                {isSelected && <Tag color="blue">已选</Tag>}
              </List.Item>
            );
          }}
        />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>邀请留言（可选）</Text>
          <Input.TextArea
            placeholder="例如：一起来聊聊吧..."
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            maxLength={50}
            showCount
            autoSize={{ minRows: 2, maxRows: 3 }}
          />
        </div>
      </Modal>
    </MainLayout>
  );
};

export default Contacts;