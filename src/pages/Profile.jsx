import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Col, Descriptions, Form, Input, Modal, Row, Space, Spin, Tag, Typography, Upload, message } from 'antd';
import { EditOutlined, LinkOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import MainLayout from '../components/MainLayout';
import { getProfile, updateAvatar, updateProfile } from '../api/user';

const { Title, Text } = Typography;

const normalizeUser = (data) => (data && data.user ? data.user : data);

const formatCreatedAt = (createdAt) => {
  if (!createdAt || Number.isNaN(Number(createdAt))) return '-';
  return new Date(Number(createdAt) * 1000).toLocaleString();
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState('');

  const [form] = Form.useForm();

  const statusTag = useMemo(() => {
    if (!user) return null;
    return <Tag color={user.status === 1 ? 'green' : 'red'}>{user.status === 1 ? '正常' : '禁用'}</Tag>;
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await getProfile();
      const u = normalizeUser(data);
      setUser(u);
      form.setFieldsValue({
        nickname: u?.nickname || '',
        phone: u?.phone || '',
      });
      setAvatarDraft(u?.avatar || '');
    } catch (e) {
      setUser(null);
      message.error(e?.message || '获取个人资料失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSaveProfile = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const data = await updateProfile({
        nickname: values.nickname?.trim() || '',
        phone: values.phone?.trim() || '',
      });
      const u = normalizeUser(data);
      setUser(u);
      message.success('资料已更新');
    } finally {
      setSaving(false);
    }
  };

  const onOpenAvatar = () => {
    setAvatarDraft(user?.avatar || '');
    setAvatarOpen(true);
  };

  const onConfirmAvatar = async () => {
    if (!avatarDraft) {
      message.warning('请先选择图片或粘贴链接');
      return;
    }
    setSaving(true);
    try {
      const data = await updateAvatar(avatarDraft);
      const u = normalizeUser(data);
      setUser(u);
      message.success('头像已更新');
      setAvatarOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const beforeUpload = async (file) => {
    const isImage = file.type?.startsWith('image/');
    if (!isImage) {
      message.error('仅支持图片文件');
      return Upload.LIST_IGNORE;
    }
    const base64 = await fileToBase64(file);
    setAvatarDraft(String(base64));
    return false;
  };

  return (
    <MainLayout pageTitle="个人资料">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            个人资料
          </Title>
          <Text type="secondary">查看并维护你的基本信息。</Text>
        </div>
        <Button onClick={fetchProfile}>刷新</Button>
      </div>

      {loading ? (
        <Card style={{ borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spin size="large" />
          </div>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={9}>
            <Card style={{ borderRadius: 16 }}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Space>
                    <Avatar size={72} src={user?.avatar} icon={<UserOutlined />} />
                    <Space direction="vertical" size={2}>
                      <Text strong style={{ fontSize: 18 }}>
                        {user?.nickname || user?.username}
                      </Text>
                      <Text type="secondary">@{user?.username}</Text>
                    </Space>
                  </Space>
                  {statusTag}
                </Space>

                <Button icon={<EditOutlined />} onClick={onOpenAvatar}>
                  更换头像
                </Button>

                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="用户 ID">{user?.id}</Descriptions.Item>
                  <Descriptions.Item label="邮箱">{user?.email || '-'}</Descriptions.Item>
                  <Descriptions.Item label="注册时间">{formatCreatedAt(user?.createdAt)}</Descriptions.Item>
                </Descriptions>
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={15}>
            <Card style={{ borderRadius: 16 }} title="编辑资料" extra={<Text type="secondary">仅可修改昵称/电话</Text>}>
              <Form form={form} layout="vertical" requiredMark={false}>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="昵称" name="nickname" rules={[{ max: 30, message: '昵称最多 30 个字符' }]}>
                      <Input placeholder="输入昵称" size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="电话" name="phone" rules={[{ max: 30, message: '电话最多 30 个字符' }]}>
                      <Input placeholder="输入电话" size="large" />
                    </Form.Item>
                  </Col>
                </Row>
                <Space>
                  <Button type="primary" size="large" loading={saving} onClick={onSaveProfile}>
                    保存
                  </Button>
                  <Button size="large" onClick={() => form.resetFields()}>
                    重置
                  </Button>
                </Space>
              </Form>
            </Card>
          </Col>
        </Row>
      )}

      <Modal
        title="更换头像"
        open={avatarOpen}
        onCancel={() => setAvatarOpen(false)}
        onOk={onConfirmAvatar}
        okText="保存"
        confirmLoading={saving}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space>
            <Avatar size={56} src={avatarDraft} icon={<UserOutlined />} />
            <Text type="secondary">预览</Text>
          </Space>

          <Card size="small" style={{ borderRadius: 12, border: '1px dashed #d9d9d9' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>上传图片</Text>
              <Upload beforeUpload={beforeUpload} showUploadList={false} maxCount={1}>
                <Button icon={<UploadOutlined />}>选择图片（转 Base64）</Button>
              </Upload>
              <Text type="secondary" style={{ fontSize: 12 }}>
                适合本地快速调试；生产环境建议使用对象存储 URL。
              </Text>
            </Space>
          </Card>

          <Card size="small" style={{ borderRadius: 12 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>粘贴图片链接</Text>
              <Input
                size="large"
                prefix={<LinkOutlined />}
                placeholder="https://example.com/avatar.png"
                value={avatarDraft}
                onChange={(e) => setAvatarDraft(e.target.value)}
              />
            </Space>
          </Card>
        </Space>
      </Modal>
    </MainLayout>
  );
};

export default Profile;
