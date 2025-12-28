import React, { useEffect, useMemo, useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Spin, Result, Button } from 'antd';
import {
  HomeOutlined,
  LockOutlined,
  LogoutOutlined,
  RocketOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUserInfo, logout } from '../api/auth';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const pickSelectedKey = (pathname) => {
  if (pathname.startsWith('/profile')) return '/profile';
  if (pathname.startsWith('/user-search')) return '/user-search';
  if (pathname.startsWith('/friends/requests')) return '/friends/requests';
  if (pathname.startsWith('/friends/add')) return '/friends/add';
  if (pathname.startsWith('/friends/blacklist')) return '/friends/blacklist';
  if (pathname.startsWith('/friends')) return '/friends';
  return '/';
};

const normalizeUser = (data) => (data && data.user ? data.user : data);

const MainLayout = ({ pageTitle, children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = useMemo(() => pickSelectedKey(location.pathname), [location.pathname]);
  const [openKeys, setOpenKeys] = useState(() => (selectedKey.startsWith('/friends') ? ['friends'] : []));

  useEffect(() => {
    if (!selectedKey.startsWith('/friends')) return;
    setOpenKeys((prev) => (prev.includes('friends') ? prev : [...prev, 'friends']));
  }, [selectedKey]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    }
    (async () => {
      try {
        const data = await getUserInfo();
        setUser(normalizeUser(data));
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      navigate('/login');
    }
  };

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '概览' },
    { key: '/profile', icon: <UserOutlined />, label: '个人资料' },
    { key: '/user-search', icon: <SearchOutlined />, label: '搜索用户' },
    {
      key: 'friends',
      icon: <TeamOutlined />,
      label: '好友',
      children: [
        { key: '/friends', label: '好友列表' },
        { key: '/friends/requests', label: '好友申请' },
        { key: '/friends/add', label: '添加好友' },
        { key: '/friends/blacklist', label: '黑名单' },
      ],
    },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      label: '个人资料',
      icon: <UserOutlined />,
      onClick: () => navigate('/profile'),
    },
    {
      key: 'change-password',
      label: '修改密码',
      icon: <LockOutlined />,
      onClick: () => navigate('/change-password'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#f0f2f5',
        }}
      >
        <Spin size="large" tip="正在加载..." />
      </div>
    );
  }

  if (!user) {
    return (
      <Result
        status="403"
        title="访问受限"
        subTitle="请先登录后再继续操作。"
        extra={
          <Button type="primary" size="large" onClick={() => navigate('/login')}>
            前往登录
          </Button>
        }
      />
    );
  }

  const content = typeof children === 'function' ? children({ user }) : children;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        theme="light"
        style={{
          boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ padding: '24px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, #0061ff 0%, #60efff 100%)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 8px rgba(0, 97, 255, 0.2)',
            }}
          >
            <RocketOutlined style={{ fontSize: 18, color: '#fff' }} />
          </div>
          <Title level={4} style={{ margin: 0, color: '#0061ff', fontWeight: 700 }}>
            翱翔IM
          </Title>
        </div>

        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={(keys) => setOpenKeys(keys)}
          items={menuItems}
          onClick={({ key }) => {
            if (typeof key === 'string' && key.startsWith('/')) navigate(key);
          }}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            zIndex: 1,
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            {pageTitle}
          </Title>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} src={user.avatar} />
              <Text strong>{user.nickname || user.username}</Text>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: '24px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>{content}</div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
