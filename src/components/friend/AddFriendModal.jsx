import React, { useEffect } from 'react';
import { Form, Input, Modal, Space, Typography } from 'antd';

const { Text } = Typography;

const AddFriendModal = ({ open, targetUser, onCancel, onSubmit, submitting }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
  }, [open, form]);

  return (
    <Modal
      title="发送好友申请"
      open={open}
      onCancel={onCancel}
      onOk={() => onSubmit?.({ message: form.getFieldValue('message') || '' })}
      okText="发送"
      confirmLoading={submitting}
      okButtonProps={{ size: 'large' }}
      cancelButtonProps={{ size: 'large' }}
      styles={{ content: { borderRadius: 16 } }}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Text type="secondary">
          你将向 <Text strong>{targetUser?.nickname || targetUser?.username || '-'}</Text> 发送好友申请
        </Text>

        <Form form={form} layout="vertical">
          <Form.Item label="验证消息（可选）" name="message">
            <Input.TextArea
              placeholder="例如：你好，我是..."
              autoSize={{ minRows: 3, maxRows: 6 }}
              maxLength={120}
              showCount
            />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  );
};

export default AddFriendModal;
