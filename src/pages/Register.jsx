import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Space, Row, Col } from 'antd';
import { RocketOutlined, UserOutlined, LockOutlined, MailOutlined, SafetyOutlined, IdcardOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { sendCaptcha, register } from '../api/auth';

const { Title, Text } = Typography;

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleSendCaptcha = async () => {
    try {
      const email = await form.validateFields(['email']);
      setSending(true);
      await sendCaptcha(email.email);
      message.success('验证码已发送到邮箱，请注意查收');

      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      if (error.errorFields) {
        message.warning('请输入有效的邮箱地址');
      }
    } finally {
      setSending(false);
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const data = await register(values);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      message.success('注册成功，欢迎加入');
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
              <RocketOutlined style={{ fontSize: 32, color: '#fff' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0', letterSpacing: 1 }}>
              SkyeIM
            </div>
          </div>
          <div className="auth-title">翱翔即时通讯系统</div>
          <div className="auth-subtitle">欢迎加入翱翔即时通讯系统</div>
          <div className="auth-highlight">
            <Space size={16}>
              <Text style={{ color: '#e2e8f0' }}>轻量注册</Text>
              <Text style={{ color: '#e2e8f0' }}>多端同步</Text>
              <Text style={{ color: '#e2e8f0' }}>消息可追溯</Text>
            </Space>
          </div>
        </div>

        <Card className="auth-card" style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ textAlign: 'left', marginBottom: 24 }}>
            <Title level={3} className="auth-card-title">
              创建账号
            </Title>
            <Text className="auth-card-subtitle">填写信息后即可完成注册</Text>
          </div>

          <Form
            form={form}
            name="register"
            layout="vertical"
            size="large"
            onFinish={onFinish}
            autoComplete="off"
          >
            <Form.Item
              name="email"
              label="电子邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱格式' },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: '#cbd5e1' }} />}
                placeholder="your-email@example.com"
                style={{ borderRadius: 14 }}
              />
            </Form.Item>

            <Form.Item label="验证码" required>
              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item
                    name="captcha"
                    noStyle
                    rules={[{ required: true, message: '请输入验证码' }]}
                  >
                    <Input
                      prefix={<SafetyOutlined style={{ color: '#cbd5e1' }} />}
                      placeholder="6位验证码"
                      maxLength={6}
                      style={{ borderRadius: 14 }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Button
                    disabled={countdown > 0}
                    loading={sending}
                    onClick={handleSendCaptcha}
                    block
                    style={{ 
                      borderRadius: 14, 
                      fontSize: 14,
                      color: countdown > 0 ? 'rgba(0, 0, 0, 0.45)' : undefined,
                      backgroundColor: countdown > 0 ? '#f5f5f5' : undefined,
                      borderColor: countdown > 0 ? '#d9d9d9' : undefined
                    }}
                  >
                    {countdown > 0 ? `${countdown}s` : '发送验证码'}
                  </Button>
                </Col>
              </Row>
            </Form.Item>

            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少需要 3 个字符' },
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#cbd5e1' }} />}
                placeholder="设置你的用户名"
                style={{ borderRadius: 14 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="登录密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少需要 6 个字符' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#cbd5e1' }} />}
                placeholder="设置登录密码"
                style={{ borderRadius: 14 }}
              />
            </Form.Item>

            <Form.Item name="nickname" label="昵称（可选）">
              <Input
                prefix={<IdcardOutlined style={{ color: '#cbd5e1' }} />}
                placeholder="我们该如何称呼你"
                style={{ borderRadius: 14 }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12, marginTop: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{ borderRadius: 14, height: 50, fontSize: 16 }}
              >
                立即创建账号
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Text type="secondary" style={{ color: 'rgba(255,255,255,0.65)' }}>已有账号？</Text>{' '}
              <Link to="/login" style={{ fontWeight: 600, color: '#38bdf8' }}>
                去登录
              </Link>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default Register;
