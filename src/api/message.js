import request from './request';

// Message API configuration
// Using global request configuration which points to the Gateway.

const MESSAGE_API_BASE = '';

export const messageApi = {
  // 获取历史消息
  getHistory: (peerId, limit = 20, lastMsgId = null) => 
    request.get(`${MESSAGE_API_BASE}/api/v1/message/history`, { 
      params: { peerId, limit, lastMsgId } 
    }),

  // 获取未读消息数
  getUnreadCount: (peerId) => 
    request.get(`${MESSAGE_API_BASE}/api/v1/message/unread/count`, { 
      params: { peerId } 
    }),

  // 标记已读
  markRead: (peerId, msgIds = []) => 
    request.post(`${MESSAGE_API_BASE}/api/v1/message/read`, { peerId, msgIds }),

  // [Group] Get group chat history
  getGroupHistory: (groupId, limit = 20, lastMsgId = null) =>
    request.get(`${MESSAGE_API_BASE}/api/v1/message/group/history`, {
      params: { groupId, limit, lastMsgId }
    }),

  // 最近会话（好友 + 群组）
  getConversations: () =>
    request.get(`${MESSAGE_API_BASE}/api/v1/message/conversations`),

  // 获取离线消息 (分页)
  getOfflineMessages: (skip = 0, limit = 100) =>
    request.get(`${MESSAGE_API_BASE}/api/v1/message/offline`, {
      params: { skip, limit }
    }),

  // 群聊离线同步
  syncGroupMessages: (groupId, seq = 0, limit = 200) =>
    request.get(`${MESSAGE_API_BASE}/api/v1/message/group/sync`, {
      params: { groupId, seq, limit }
    }),

  // 搜索消息记录
  searchMessages: (keyword) =>
    request.get(`${MESSAGE_API_BASE}/api/v1/message/search`, {
      params: { keyword }
    }),

  // @我的消息
  getAtMeMessages: ({ groupId, lastMsgId, limit = 20 } = {}) =>
    request.get(`${MESSAGE_API_BASE}/api/v1/message/at-me`, {
      params: { groupId, lastMsgId, limit }
    }),
};
