import request from './request';

const GROUP_API_BASE = '/api/v1/group';
const GROUP_MEMBER_API_BASE = '/api/v1/group/member';

export const groupApi = {
  // Create a group
  create: (data) => request.post(`${GROUP_API_BASE}/create`, data),

  // Update group profile (owner/admin)
  update: (data) => request.post(`${GROUP_API_BASE}/update`, data),

  // Get list of joined groups
  getList: (page = 1, pageSize = 20) => 
    request.get(`${GROUP_API_BASE}/list`, { params: { page, pageSize } }),

  // Get group details
  getDetails: (groupId) => request.get(`${GROUP_API_BASE}/${groupId}`),

  // Invite members
  invite: (groupId, memberIds) => 
    request.post(`${GROUP_MEMBER_API_BASE}/invite`, { groupId, memberIds }),

  // Kick member
  kick: (groupId, memberId) => 
    request.post(`${GROUP_MEMBER_API_BASE}/kick`, { groupId, memberId }),

  // Set mute (1 mute, 0 unmute)
  mute: (groupId, memberId, mute) =>
    request.post(`${GROUP_MEMBER_API_BASE}/mute`, { groupId, memberId, mute }),

  // Set role (2 admin, 3 member)
  role: (groupId, memberId, role) =>
    request.post(`${GROUP_MEMBER_API_BASE}/role`, { groupId, memberId, role }),

  // Quit group
  quit: (groupId) => request.post(`${GROUP_API_BASE}/quit`, { groupId }),

  // Dismiss group
  dismiss: (groupId) => request.post(`${GROUP_API_BASE}/dismiss`, { groupId }),

  // Update group read progress
  read: (groupId, readSeq) => request.post(`${GROUP_API_BASE}/read`, { groupId, readSeq }),

  // Get group members
  getMembers: (groupId, page = 1, pageSize = 20) => 
    request.get(`${GROUP_MEMBER_API_BASE}/list`, { params: { groupId, page, pageSize } }),

  // Precise search group
  searchGroupPrecise: (groupId) =>
    request.get(`${GROUP_API_BASE}/search/precise`, { params: { groupId } }),

  // Fuzzy search group by keyword
  searchGroup: (keyword) =>
    request.get(`${GROUP_API_BASE}/search`, { params: { keyword } }),

  // --- Invitation APIs ---
  // Send invitation
  sendInvitation: (data) => request.post(`${GROUP_API_BASE}/invitation/send`, data),

  // Handle invitation
  handleInvitation: (data) => request.post(`${GROUP_API_BASE}/invitation/handle`, data),

  // Get received invitations
  getReceivedInvitations: (page = 1, pageSize = 20) =>
    request.get(`${GROUP_API_BASE}/invitation/received`, { params: { page, pageSize } }),

  // Get sent invitations
  getSentInvitations: (page = 1, pageSize = 20) =>
    request.get(`${GROUP_API_BASE}/invitation/sent`, { params: { page, pageSize } }),

  // --- Join Request APIs ---
  // Send join request
  joinRequest: (data) => request.post(`${GROUP_API_BASE}/join/request`, data),

  // Handle join request (owner/admin)
  handleJoinRequest: (data) => request.post(`${GROUP_API_BASE}/join/handle`, data),

  // Get join requests (owner/admin)
  getJoinRequests: (groupId, page = 1, pageSize = 20) =>
    request.get(`${GROUP_API_BASE}/join/requests`, { params: { groupId, page, pageSize } }),

  // Get sent join requests (user)
  getSentJoinRequests: (page = 1, pageSize = 20) =>
    request.get(`${GROUP_API_BASE}/join/sent`, { params: { page, pageSize } }),
};
