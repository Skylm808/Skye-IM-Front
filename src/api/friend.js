import request from './request';

export const friendApi = {
  // 好友申请：发送申请
  addFriendRequest: (toUserId, message) => request.post('/api/v1/friend/request', { toUserId, message }),

  // 好友申请：兼容旧调用（等同于 getReceivedRequests）
  getFriendRequests: (page = 1, pageSize = 20) =>
    request.get('/api/v1/friend/request/received', { params: { page, pageSize } }),

  // 好友申请：收到的申请
  getReceivedRequests: (page = 1, pageSize = 20) =>
    request.get('/api/v1/friend/request/received', { params: { page, pageSize } }),

  // 好友申请：发出的申请
  getSentRequests: (page = 1, pageSize = 20) => request.get('/api/v1/friend/request/sent', { params: { page, pageSize } }),

  // 好友申请：处理申请（1=同意, 2=拒绝）
  handleRequest: (requestId, action) => request.put(`/api/v1/friend/request/${requestId}`, { action }),

  // 好友关系：好友列表
  getFriendList: (page = 1, pageSize = 20) => request.get('/api/v1/friend/list', { params: { page, pageSize } }),

  // 好友关系：删除好友
  deleteFriend: (friendId) => request.delete(`/api/v1/friend/${friendId}`),

  // 好友关系：更新备注
  updateRemark: (friendId, remark) => request.put(`/api/v1/friend/${friendId}/remark`, { remark }),

  // 好友关系：检查是否为好友
  checkFriend: (friendId) => request.get(`/api/v1/friend/${friendId}/check`),

  // 黑名单：设置/取消拉黑
  setBlacklist: (friendId, isBlack) => request.post('/api/v1/friend/blacklist', { friendId, isBlack }),

  // 黑名单：列表
  getBlacklist: (page = 1, pageSize = 20) => request.get('/api/v1/friend/blacklist', { params: { page, pageSize } }),
};
