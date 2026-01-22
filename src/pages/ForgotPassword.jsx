import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Row, Col, Space } from 'antd';
import { MailOutlined, SafetyOutlined, LockOutlined, RocketOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { sendCaptcha, forgotPassword } from '../api/auth';

const { Title, Text } = Typography;

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleSendCaptcha = async () => {
    try {
      const email = await form.validateFields(['email']);
      setSending(true);
      await sendCaptcha(email.email, 'reset');
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
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword({
        email: values.email,
        captcha: values.captcha,
        newPassword: values.newPassword,
      });
      message.success('密码已重置，请使用新密码登录');
      navigate('/login');
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
          <div className="auth-subtitle">欢迎来到翱翔即时通讯系统</div>
          <div className="auth-highlight">
            <Space size={16}>
              <Text style={{ color: '#e2e8f0' }}>身份验证</Text>
              <Text style={{ color: '#e2e8f0' }}>安全找回</Text>
              <Text style={{ color: '#e2e8f0' }}>快速重置</Text>
            </Space>
          </div>
        </div>

        <Card className="auth-card" style={{ width: '100%', maxWidth: 450 }}>
          <div style={{ marginBottom: 20 }}>
            <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
              <ArrowLeftOutlined /> 返回登录
            </Link>
          </div>

          <div style={{ textAlign: 'left', marginBottom: 24 }}>
            <Title level={3} className="auth-card-title">
              找回密码
            </Title>
            <Text className="auth-card-subtitle">重置你的登录密码后即可继续使用</Text>
          </div>

          <Form
            form={form}
            name="forgot_password"
            layout="vertical"
            size="large"
            onFinish={onFinish}
            autoComplete="off"
          >
            <Form.Item
              name="email"
              label="验证邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱格式' },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: '#cbd5e1' }} />}
                placeholder="填写注册时使用的邮箱"
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
              name="newPassword"
              label="设置新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码至少需要 6 个字符' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#cbd5e1' }} />}
                placeholder="6-32位字符"
                style={{ borderRadius: 14 }}
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="确认新密码"
              rules={[{ required: true, message: '请再次输入新密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#cbd5e1' }} />}
                placeholder="请再次输入新密码"
                style={{ borderRadius: 14 }}
              />
            </Form.Item>

            <Form.Item style={{ marginTop: 20, marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{ borderRadius: 14, height: 50, fontSize: 16 }}
              >
                提交重置
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
