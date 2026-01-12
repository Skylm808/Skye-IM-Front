import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Col, Descriptions, Form, Input, Modal, Row, Space, Spin, Tag, Typography, Upload, Select, message } from 'antd';
import { EditOutlined, LinkOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import MainLayout from '../components/MainLayout';
import { getProfile, updateAvatar, updateProfile } from '../api/user';
import { uploadApi } from '../api/upload';

const { Title, Text } = Typography;
const { Option } = Select;

const GENDER_MAP = {
  0: '未知',
  1: '男',
  2: '女',
};

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
  const [avatarFile, setAvatarFile] = useState(null);

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
        signature: u?.signature || '',
        gender: u?.gender !== undefined ? u.gender : 0,
        region: u?.region || '',
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
        signature: values.signature?.trim() || '',
        gender: values.gender,
        region: values.region?.trim() || '',
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
    setAvatarFile(null);
    setAvatarOpen(true);
  };

  const onConfirmAvatar = async () => {
    if (!avatarDraft && !avatarFile) {
      message.warning('请先选择图片或粘贴链接');
      return;
    }
    setSaving(true);
    try {
      let finalUrl = avatarDraft;
      
      // Check if we have a pending file to upload
      if (avatarFile) {
        const res = await uploadApi.uploadAvatar(avatarFile);
        finalUrl = res.url || res.data?.url; 
      }

      const data = await updateAvatar(finalUrl);
      const u = normalizeUser(data);
      setUser(u);
      message.success('头像已更新');
      setAvatarOpen(false);
    } catch (e) {
      console.error(e);
      message.error('头像上传失败');
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
    // Preview
    const base64 = await fileToBase64(file);
    setAvatarDraft(String(base64));
    setAvatarFile(file); // Store file for upload
    return false; // Prevent auto upload
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
        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} lg={8} xl={7}>
            <Card style={{ borderRadius: 16, height: '100%' }}>
              <Space direction="vertical" size={24} style={{ width: '100%', textAlign: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <Avatar size={100} src={user?.avatar} icon={<UserOutlined />} style={{ border: '4px solid #f0f5ff' }} />
                    <Button 
                      shape="circle" 
                      icon={<EditOutlined />} 
                      size="small" 
                      style={{ position: 'absolute', bottom: 0, right: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                      onClick={onOpenAvatar}
                    />
                </div>
                
                <div>
                   <Title level={3} style={{ margin: 0 }}>{user?.nickname || user?.username}</Title>
                   <Text type="secondary">@{user?.username}</Text>
                   <div style={{ marginTop: 8 }}>{statusTag}</div>
                </div>

                <Descriptions size="small" column={1} bordered style={{ textAlign: 'left', marginTop: 12 }}>
                  <Descriptions.Item label="用户 ID">{user?.id}</Descriptions.Item>
                  <Descriptions.Item label="个性签名">{user?.signature || '-'}</Descriptions.Item>
                  <Descriptions.Item label="性别">{GENDER_MAP[user?.gender] || '未知'}</Descriptions.Item>
                  <Descriptions.Item label="地区">{user?.region || '-'}</Descriptions.Item>
                  <Descriptions.Item label="邮箱">{user?.email || '-'}</Descriptions.Item>
                  <Descriptions.Item label="注册时间">{formatCreatedAt(user?.createdAt)}</Descriptions.Item>
                </Descriptions>
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={16} xl={17}>
            <Card style={{ borderRadius: 16, height: '100%' }} title="编辑资料" extra={<Text type="secondary">仅可修改昵称/电话/签名等</Text>}>
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
                  <Col xs={24} md={12}>
                    <Form.Item label="性别" name="gender">
                      <Select size="large">
                        <Option value={0}>未知</Option>
                        <Option value={1}>男</Option>
                        <Option value={2}>女</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="地区" name="region" rules={[{ max: 50, message: '地区最多 50 个字符' }]}>
                      <Input placeholder="输入地区" size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item label="个性签名" name="signature" rules={[{ max: 100, message: '签名最多 100 个字符' }]}>
                      <Input.TextArea placeholder="输入个性签名" autoSize={{ minRows: 2, maxRows: 4 }} size="large" />
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
                <Button icon={<UploadOutlined />}>选择图片</Button>
              </Upload>
              <Text type="secondary" style={{ fontSize: 12 }}>
                支持 JPG, PNG, GIF, WEBP。最大 5MB。
              </Text>
            </Space>
          </Card>

          <Card size="small" style={{ borderRadius: 12 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>或粘贴图片链接</Text>
              <Input
                size="large"
                prefix={<LinkOutlined />}
                placeholder="https://example.com/avatar.png"
                value={avatarDraft}
                onChange={(e) => {
                   setAvatarDraft(e.target.value);
                   setAvatarFile(null); // Clear file if user types url
                }}
              />
            </Space>
          </Card>
        </Space>
      </Modal>
    </MainLayout>
  );
};

export default Profile;