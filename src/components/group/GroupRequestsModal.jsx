import React, { useEffect, useState, useCallback } from 'react';
import { Button, Empty, List, Modal, Space, Tag, message } from 'antd';
import GroupJoinRequestCard from './GroupJoinRequestCard';
import { groupApi } from '../../api/group';
import useUserCache from '../../hooks/useUserCache';

const GroupRequestsModal = ({ open, onCancel, groupId, groupName }) => {
  const { getUser, ensureUsers } = useUserCache();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [workingId, setWorkingId] = useState(null);
  const pendingCount = list.filter((item) => item.status === 0).length;

  const loadRequests = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await groupApi.getJoinRequests(groupId, 1, 50);
      const items = res?.list || (Array.isArray(res) ? res : []) || [];
      
      items.sort((a, b) => {
        if (a.status === 0 && b.status !== 0) return -1;
        if (a.status !== 0 && b.status === 0) return 1;
        return b.createdAt - a.createdAt;
      });

      setList(items);

      if (items.length > 0) {
        const userIds = items.map(r => r.userId);
        await ensureUsers(userIds);
      }
    } catch (e) {
      console.error(e);
      message.error('加载申请列表失败');
    } finally {
      setLoading(false);
    }
  }, [groupId, ensureUsers]);

  useEffect(() => {
    if (open && groupId) {
      loadRequests();
    } else {
      setList([]);
    }
  }, [open, groupId, loadRequests]);

  const handleAction = async (requestId, action) => {
    setWorkingId(requestId);
    try {
      await groupApi.handleJoinRequest({ requestId, action });
      message.success(action === 1 ? '已同意' : '已拒绝');
      await loadRequests(); // Refresh list
    } catch (e) {
      console.error(e);
      message.error('操作失败');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <Modal
      title={(
        <Space size={8} wrap>
          <span>入群申请 - {groupName || groupId}</span>
          <Tag color={pendingCount ? 'gold' : 'green'}>
            {pendingCount ? `待处理 ${pendingCount}` : '暂无待办'}
          </Tag>
          <Button size="small" onClick={() => loadRequests()} disabled={loading}>
            刷新
          </Button>
        </Space>
      )}
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
      width={480}
    >
      <List
        loading={loading}
        dataSource={list}
        locale={{ emptyText: <Empty description="暂无申请" /> }}
        renderItem={(item) => {
          const user = getUser(item.userId);
          return (
            <div style={{ marginBottom: 12 }}>
              <GroupJoinRequestCard
                request={item}
                user={user}
                mode="received"
                working={workingId === item.id}
                onAccept={() => handleAction(item.id, 1)}
                onReject={() => handleAction(item.id, 2)}
              />
            </div>
          );
        }}
      />
    </Modal>
  );
};

export default GroupRequestsModal;
