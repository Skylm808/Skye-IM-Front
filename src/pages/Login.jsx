import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
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
            message.success('登录成功！欢迎回来');
            navigate('/');
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
                    maxWidth: 420,
                    borderRadius: 24,
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        background: 'linear-gradient(135deg, #0061ff 0%, #60efff 100%)',
                        borderRadius: 16,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                        boxShadow: '0 8px 16px rgba(0, 97, 255, 0.3)'
                    }}>
                        <RocketOutlined style={{ fontSize: 32, color: '#fff' }} />
                    </div>
                    <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>
                        翱翔系统登录
                    </Title>
                    <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 16 }}>欢迎回到翱翔IM系统</Text>
                    </div>
                </div>

                <Form
                    name="login"
                    size="large"
                    onFinish={onFinish}
                    autoComplete="off"
                    layout="vertical"
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: '请输入用户名/手机号/邮箱!' }]}
                    >
                        <Input
                            prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                            placeholder="用户名 / 手机号 / 邮箱"
                            style={{ borderRadius: 12 }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: '请输入密码!' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                            placeholder="请输入密码"
                            style={{ borderRadius: 12 }}
                        />
                    </Form.Item>

                    <Form.Item style={{ marginTop: 8 }}>
                        <Button type="primary" htmlType="submit" loading={loading} block style={{ borderRadius: 12, height: 50, fontSize: 16 }}>
                            立即登录
                        </Button>
                    </Form.Item>

                    <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <Text type="secondary">还没账号？</Text> <Link to="/register" style={{ fontWeight: 600 }}>立即注册</Link>
                        <span style={{ margin: '0 8px', color: '#d9d9d9' }}>|</span>
                        <Link to="/forgot-password" style={{ color: '#666' }}>忘记密码？</Link>
                    </div>
                </Form>
            </Card>
        </div>
    );
};

export default Login;
