import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Space } from 'antd';
import { LockOutlined, SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../api/auth';

const { Title, Text } = Typography;

const ChangePassword = () => {
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const navigate = useNavigate();

    const onFinish = async (values) => {
        if (values.newPassword !== values.confirmPassword) {
            message.error('两次输入的密码不一致！');
            return;
        }

        setLoading(true);
        try {
            await changePassword({
                oldPassword: values.oldPassword,
                newPassword: values.newPassword
            });
            message.success('密码修改成功，请使用新密码重新登录');
            // Log out after changing password for security
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            navigate('/login');
        } catch {
            // Error handled by interceptor
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#f0f2f5',
            padding: '40px 24px'
        }}>
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
                <div style={{ marginBottom: 24 }}>
                    <Button
                        type="text"
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/')}
                        style={{ marginBottom: 16, padding: 0 }}
                    >
                        返回首页
                    </Button>
                    <Title level={2} style={{ margin: 0 }}>修改登录密码</Title>
                    <Text type="secondary">为了您的账号安全，请定期更换密码。</Text>
                </div>

                <Card
                    style={{
                        borderRadius: 16,
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }}
                >
                    <Form
                        form={form}
                        name="change_password"
                        layout="vertical"
                        size="large"
                        onFinish={onFinish}
                        autoComplete="off"
                    >
                        <Form.Item
                            name="oldPassword"
                            label="当前密码"
                            rules={[{ required: true, message: '请输入当前使用的密码!' }]}
                        >
                            <Input.Password
                                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                                placeholder="请输入当前密码"
                                style={{ borderRadius: 12 }}
                            />
                        </Form.Item>

                        <Form.Item
                            name="newPassword"
                            label="设置新密码"
                            rules={[
                                { required: true, message: '请输入新密码!' },
                                { min: 6, message: '密码至少需要6个字符!' }
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                                placeholder="6-32位字符"
                                style={{ borderRadius: 12 }}
                            />
                        </Form.Item>

                        <Form.Item
                            name="confirmPassword"
                            label="确认新密码"
                            dependencies={['newPassword']}
                            rules={[
                                { required: true, message: '请再次输入新密码!' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('newPassword') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('两次输入的密码不一致!'));
                                    },
                                }),
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                                placeholder="请再次输入新密码"
                                style={{ borderRadius: 12 }}
                            />
                        </Form.Item>

                        <Form.Item style={{ marginTop: 32, marginBottom: 8 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                icon={<SaveOutlined />}
                                block
                                style={{ height: 50, borderRadius: 12, fontSize: 16, fontWeight: 600 }}
                            >
                                保存并重新登录
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            </div>
        </div>
    );
};

export default ChangePassword;
