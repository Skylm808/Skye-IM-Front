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
            message.success('验证码已发送至您的邮箱，请注意查收！');

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
            message.success('注册成功！欢迎加入翱翔IM系统');
            navigate('/');
        } catch {
            // Error handled by interceptor
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-background" style={{ padding: '40px 20px' }}>
            <Card
                style={{
                    width: '100%',
                    maxWidth: 480,
                    borderRadius: 24,
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 56,
                        height: 56,
                        background: 'linear-gradient(135deg, #0061ff 0%, #60efff 100%)',
                        borderRadius: 14,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                        boxShadow: '0 8px 16px rgba(0, 97, 255, 0.3)'
                    }}>
                        <RocketOutlined style={{ fontSize: 28, color: '#fff' }} />
                    </div>
                    <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>
                        翱翔系统注册
                    </Title>
                    <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 16 }}>开启您的即时通讯新体验</Text>
                    </div>
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
                            { required: true, message: '请输入邮箱!' },
                            { type: 'email', message: '请输入有效的邮箱格式!' }
                        ]}
                    >
                        <Input prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} placeholder="your-email@example.com" style={{ borderRadius: 12 }} />
                    </Form.Item>

                    <Form.Item label="验证码" required>
                        <Row gutter={12}>
                            <Col span={16}>
                                <Form.Item
                                    name="captcha"
                                    noStyle
                                    rules={[{ required: true, message: '请输入验证码!' }]}
                                >
                                    <Input prefix={<SafetyOutlined style={{ color: '#bfbfbf' }} />} placeholder="6位验证码" maxLength={6} style={{ borderRadius: 12 }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Button
                                    disabled={countdown > 0}
                                    loading={sending}
                                    onClick={handleSendCaptcha}
                                    block
                                    style={{ borderRadius: 12, fontSize: 14 }}
                                >
                                    {countdown > 0 ? `${countdown}s` : '跳转发送'}
                                </Button>
                            </Col>
                        </Row>
                    </Form.Item>

                    <Form.Item
                        name="username"
                        label="用户名"
                        rules={[
                            { required: true, message: '请输入用户名!' },
                            { min: 3, message: '用户名至少需要3个字符!' }
                        ]}
                    >
                        <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="设置您的用户名" style={{ borderRadius: 12 }} />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label="登录密码"
                        rules={[
                            { required: true, message: '请输入密码!' },
                            { min: 6, message: '密码至少需要6个字符!' }
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} placeholder="设置您的登录密码" style={{ borderRadius: 12 }} />
                    </Form.Item>

                    <Form.Item
                        name="nickname"
                        label="个性昵称 (可选)"
                    >
                        <Input prefix={<IdcardOutlined style={{ color: '#bfbfbf' }} />} placeholder="我们该如何称呼您？" style={{ borderRadius: 12 }} />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 12, marginTop: 12 }}>
                        <Button type="primary" htmlType="submit" loading={loading} block style={{ borderRadius: 12, height: 50, fontSize: 16 }}>
                            立即创建账号
                        </Button>
                    </Form.Item>

                    <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <Text type="secondary">已有账号？</Text> <Link to="/login" style={{ fontWeight: 600 }}>去登录</Link>
                    </div>
                </Form>
            </Card>
        </div>
    );
};

export default Register;
