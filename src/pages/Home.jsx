import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, Descriptions, Space, Typography, Row, Col, Statistic, Avatar } from 'antd';
import { LockOutlined, SearchOutlined, UserOutlined, EditOutlined, SafetyCertificateOutlined, TeamOutlined, IdcardOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import { loadSessionsMeta, onSessionsUpdated } from '../utils/sessionStore';

const { Title, Text } = Typography;

const Home = () => {
  const navigate = useNavigate();
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    const calc = (meta) => {
      if (!meta) return 0;
      return Object.values(meta).reduce((acc, curr) => acc + (curr.unread || 0), 0);
    };
    
    setTotalUnread(calc(loadSessionsMeta()));
    
    const unsubscribe = onSessionsUpdated((meta) => {
      setTotalUnread(calc(meta));
    });
    return unsubscribe;
  }, []);

  return (
    <MainLayout pageTitle="概览">
      {({ user }) => (
        <div style={{ padding: 24 }}>
          {/* Welcome Banner */}
          <div
            style={{
              background: 'linear-gradient(120deg, #1890ff, #722ed1)',
              borderRadius: 16,
              padding: '40px 32px',
              color: '#fff',
              marginBottom: 32,
              boxShadow: '0 10px 20px rgba(24, 144, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 24,
            }}
          >
            <Avatar size={80} src={user.avatar} icon={<UserOutlined />} style={{ border: '2px solid rgba(255,255,255,0.8)' }} />
            <div>
              <Title level={2} style={{ margin: 0, color: '#fff' }}>
                欢迎回来，{user.nickname || user.username}
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, marginTop: 8, display: 'block' }}>
                {user.signature || '编辑个人资料添加个性签名...'}
              </Text>
            </div>
          </div>

          <Row gutter={[24, 24]}>
            {/* Account Overview */}
            <Col xs={24} lg={16}>
              <Card
                title={<Space><IdcardOutlined /><span>账号概览</span></Space>}
                style={{ borderRadius: 16, height: '100%' }}
                extra={<Button type="link" onClick={() => navigate('/profile')}>编辑</Button>}
              >
                <Descriptions bordered column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
                  <Descriptions.Item label="系统账号">{user.username}</Descriptions.Item>
                  <Descriptions.Item label="显示昵称">{user.nickname || '-'}</Descriptions.Item>
                  <Descriptions.Item label="联系电话">{user.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="绑定邮箱">{user.email || '-'}</Descriptions.Item>
                  <Descriptions.Item label="用户 ID">{user.id}</Descriptions.Item>
                  <Descriptions.Item label="注册时间">
                    {user.createdAt ? new Date(user.createdAt * 1000).toLocaleDateString() : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Badge status={user.status === 1 ? 'success' : 'error'} text={user.status === 1 ? '正常' : '异常'} />
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* Quick Actions / Stats */}
            <Col xs={24} lg={8}>
              <Row gutter={[0, 24]}>
                <Col span={24}>
                   <Card style={{ borderRadius: 16, background: '#f0f5ff', border: 'none' }}>
                      <Row align="middle" justify="space-between">
                         <Col>
                           <Statistic title="消息通知" value={totalUnread} prefix={<TeamOutlined />} />
                         </Col>
                         <Col>
                           <Button type="primary" shape="round" onClick={() => navigate('/chat')}>去处理</Button>
                         </Col>
                      </Row>
                   </Card>
                </Col>
                <Col span={24}>
                  <Card title="快速操作" style={{ borderRadius: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <Button
                        block
                        size="large"
                        icon={<EditOutlined />}
                        style={{ height: 50, borderRadius: 8, textAlign: 'left' }}
                        onClick={() => navigate('/profile')}
                      >
                        完善个人资料
                      </Button>
                      <Button
                        block
                        size="large"
                        icon={<SearchOutlined />}
                        style={{ height: 50, borderRadius: 8, textAlign: 'left' }}
                        onClick={() => navigate('/user-search')}
                      >
                        搜索新朋友
                      </Button>
                      <Button
                        block
                        size="large"
                        icon={<SafetyCertificateOutlined />}
                        style={{ height: 50, borderRadius: 8, textAlign: 'left' }}
                        onClick={() => navigate('/change-password')}
                      >
                        修改登录密码
                      </Button>
                    </div>
                  </Card>
                </Col>
              </Row>
            </Col>
          </Row>
        </div>
      )}
    </MainLayout>
  );
};

export default Home;

