import React, { useEffect } from 'react';
import { Form, Input, Modal } from 'antd';

const RemarkEditModal = ({ open, initialRemark, onCancel, onSubmit, submitting }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    const v = initialRemark || '';
    form.setFieldsValue({ remark: v });
  }, [open, initialRemark, form]);

  return (
    <Modal
      title="修改备注"
      open={open}
      onCancel={onCancel}
      onOk={() => onSubmit?.({ remark: String(form.getFieldValue('remark') || '').trim() })}
      okText="保存"
      confirmLoading={submitting}
      okButtonProps={{ size: 'large' }}
      cancelButtonProps={{ size: 'large' }}
      styles={{ content: { borderRadius: 16 } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="备注名"
          name="remark"
          rules={[{ max: 30, message: '备注最多 30 个字符' }]}
        >
          <Input
            size="large"
            placeholder="例如：小明 / 同事-张三"
            maxLength={30}
            allowClear
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RemarkEditModal;
