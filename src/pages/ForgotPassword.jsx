import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Row, Col, App as AntdApp } from 'antd';
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
            message.success('验证码已发送至您的邮箱，请查收！');

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
            message.error('两次输入的密码不一致！');
            return;
        }

        setLoading(true);
        try {
            await forgotPassword({
                email: values.email,
                captcha: values.captcha,
                newPassword: values.newPassword
            });
            message.success('密码重置成功，请使用新密码登录');
            navigate('/login');
        } catch {
            // Error handled by interceptor
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-background" style={{ padding: '20px' }}>
            <Card
                style={{
                    width: '100%',
                    maxWidth: 450,
                    borderRadius: 24,
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
            >
                <div style={{ marginBottom: 24 }}>
                    <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#666' }}>
                        <ArrowLeftOutlined /> 返回登录
                    </Link>
                </div>

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
                    <Title level={2} style={{ margin: 0, fontWeight: 800 }}>找回密码</Title>
                    <Text type="secondary" style={{ fontSize: 16 }}>重置您的翱翔系统访问密码</Text>
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
                            { required: true, message: '请输入邮箱!' },
                            { type: 'email', message: '请输入有效的邮箱格式!' }
                        ]}
                    >
                        <Input prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} placeholder="您的注册邮箱" style={{ borderRadius: 12 }} />
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
                        name="newPassword"
                        label="设置新密码"
                        rules={[
                            { required: true, message: '请输入新密码!' },
                            { min: 6, message: '密码至少需要6个字符!' }
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} placeholder="6-32位字符" style={{ borderRadius: 12 }} />
                    </Form.Item>

                    <Form.Item
                        name="confirmPassword"
                        label="确认新密码"
                        rules={[
                            { required: true, message: '请再次输入新密码!' }
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} placeholder="请再次输入新密码" style={{ borderRadius: 12 }} />
                    </Form.Item>

                    <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit" loading={loading} block style={{ borderRadius: 12, height: 50, fontSize: 16 }}>
                            提交重置
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default ForgotPassword;
