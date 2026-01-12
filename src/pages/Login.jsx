import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Space } from 'antd';
import { RocketOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api/auth';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const data = await login(values.username, values.password);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      message.success('登录成功，欢迎回来');
      navigate('/');
    } catch {
      // Error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-background">
      <div className="auth-shell">
        <div className="auth-intro">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="auth-logo">
              <RocketOutlined style={{ fontSize: 34, color: '#fff' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0', letterSpacing: 1 }}>
              SkyeIM
            </div>
          </div>
          <div className="auth-title">翱翔即时通讯系统</div>
          <div className="auth-subtitle">欢迎来到翱翔即时通讯系统</div>
          <div className="auth-highlight">
            <Space size={16}>
              <Text style={{ color: '#e2e8f0' }}>多端同步</Text>
              <Text style={{ color: '#e2e8f0' }}>安全加密</Text>
              <Text style={{ color: '#e2e8f0' }}>高效协作</Text>
            </Space>
          </div>
        </div>

        <Card className="auth-card" style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'left', marginBottom: 24 }}>
            <Title level={3} className="auth-card-title">
              欢迎登录
            </Title>
            <Text className="auth-card-subtitle">使用账号开启新的对话</Text>
          </div>

          <Form name="login" size="large" onFinish={onFinish} autoComplete="off" layout="vertical">
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名/手机号/邮箱' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#cbd5e1' }} />}
                placeholder="用户名 / 手机号 / 邮箱"
                style={{ borderRadius: 14 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#cbd5e1' }} />}
                placeholder="请输入密码"
                style={{ borderRadius: 14 }}
              />
            </Form.Item>

            <Form.Item style={{ marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{ borderRadius: 14, height: 50, fontSize: 16 }}
              >
                立即登录
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Text type="secondary" style={{ color: 'rgba(255,255,255,0.65)' }}>还没有账号？</Text>{' '}
              <Link to="/register" style={{ fontWeight: 600, color: '#38bdf8' }}>
                立即注册
              </Link>
              <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>|</span>
              <Link to="/forgot-password" style={{ color: '#94a3b8' }}>
                忘记密码
              </Link>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default Login;
