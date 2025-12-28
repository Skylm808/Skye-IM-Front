import React from 'react';
import { Badge, Button, Card, Descriptions, Space, Typography } from 'antd';
import { LockOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';

const { Title, Text } = Typography;

const Home = () => {
  const navigate = useNavigate();

  return (
    <MainLayout pageTitle="概览">
      {({ user }) => (
        <div style={{ background: '#fff', padding: 32, borderRadius: 16 }}>
          <div style={{ marginBottom: 24 }}>
            <Title level={2} style={{ margin: 0 }}>
              欢迎回来，{user.nickname || user.username}
            </Title>
            <Text type="secondary" style={{ fontSize: 16 }}>
              快速入口：资料维护、头像更新、用户搜索。
            </Text>
          </div>

          <Card
            style={{
              borderRadius: 16,
              border: '1px solid #f0f0f0',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
            }}
          >
            <Descriptions
              title={
                <Space>
                  <UserOutlined style={{ color: '#0061ff' }} />
                  <span>账号概览</span>
                </Space>
              }
              bordered
              column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
            >
              <Descriptions.Item label="系统账号">{user.username}</Descriptions.Item>
              <Descriptions.Item label="显示昵称">{user.nickname || '-'}</Descriptions.Item>
              <Descriptions.Item label="绑定邮箱">{user.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{user.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="账号状态">
                <Badge status={user.status === 1 ? 'success' : 'error'} text={user.status === 1 ? '正常' : '已禁用'} />
              </Descriptions.Item>
              <Descriptions.Item label="系统 ID">{user.id}</Descriptions.Item>
            </Descriptions>
          </Card>

          <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button
              type="primary"
              size="large"
              style={{ borderRadius: 12, height: 48, padding: '0 22px' }}
              onClick={() => navigate('/profile')}
            >
              个人资料
            </Button>
            <Button
              size="large"
              style={{ borderRadius: 12, height: 48, padding: '0 22px' }}
              icon={<SearchOutlined />}
              onClick={() => navigate('/user-search')}
            >
              搜索用户
            </Button>
            <Button
              size="large"
              style={{ borderRadius: 12, height: 48, padding: '0 22px' }}
              icon={<LockOutlined />}
              onClick={() => navigate('/change-password')}
            >
              修改密码
            </Button>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Home;

