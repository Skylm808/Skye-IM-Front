import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Input, Modal, Space, Tag, Typography } from 'antd';
import { TeamOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;

const JoinGroupModal = ({ open, group, onCancel, onSubmit, loading, applied }) => {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open) setMessage('');
  }, [open, group?.groupId]);

  const groupId = group?.groupId ? String(group.groupId) : '';
  const groupName = group?.name || (groupId ? `群组 ${groupId}` : '群组');
  const description = group?.description || '暂无群简介';
  const isDismissed = group?.status === 2;
  const isFull =
    Number.isFinite(group?.memberCount) &&
    Number.isFinite(group?.maxMembers) &&
    Number(group.maxMembers) > 0 &&
    Number(group.memberCount) >= Number(group.maxMembers);

  const subtitle = useMemo(() => {
    const meta = [];
    if (groupId) meta.push(`ID: ${groupId}`);
    if (Number.isFinite(group?.memberCount)) meta.push(`${group.memberCount} 成员`);
    if (Number.isFinite(group?.maxMembers)) meta.push(`上限 ${group.maxMembers}`);
    return meta.join(' · ');
  }, [groupId, group?.memberCount, group?.maxMembers]);

  const statusTags = useMemo(() => {
    const tags = [];
    if (applied) tags.push(<Tag key="applied" color="gold">已提交申请</Tag>);
    if (isDismissed) tags.push(<Tag key="dismissed" color="red">已解散</Tag>);
    if (isFull) tags.push(<Tag key="full" color="red">已满员</Tag>);
    return tags;
  }, [applied, isDismissed, isFull]);

  const disabled = !groupId || applied || isDismissed || isFull;

  const handleOk = () => {
    if (!groupId) return;
    onSubmit?.(message);
  };

  return (
    <Modal
      title="申请加入群组"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="发送申请"
      cancelText="取消"
      confirmLoading={loading}
      okButtonProps={{ disabled }}
      destroyOnClose
    >
      <Space align="start" size={12} style={{ marginBottom: 16 }}>
        <Avatar
          shape="square"
          size={56}
          src={group?.avatar}
          icon={<TeamOutlined />}
          style={{ borderRadius: 12 }}
        />
        <div>
          <Space size={8} wrap>
            <Text strong style={{ fontSize: 16 }}>{groupName}</Text>
            {groupId ? <Tag color="blue">ID: {groupId}</Tag> : null}
            {statusTags}
          </Space>
          {subtitle ? (
            <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
              {subtitle}
            </Text>
          ) : null}
          <Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
            {description}
          </Text>
        </div>
      </Space>

      <Text strong>申请理由</Text>
      <TextArea
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="例如：大家好，我对这个群很感兴趣..."
        maxLength={200}
        showCount
        style={{ marginTop: 8 }}
        disabled={disabled}
      />

      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
        {isDismissed
          ? '该群已解散，暂时无法申请。'
          : isFull
          ? '该群已满员，暂时无法申请。'
          : applied
          ? '你已提交申请，请耐心等待审核。'
          : '提交后群主/管理员会审核，请耐心等待。'}
      </Text>
    </Modal>
  );
};

export default JoinGroupModal;
