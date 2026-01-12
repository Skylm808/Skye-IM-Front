import request from './request';

/**
 * @typedef {Object} UserInfo
 * @property {number} id
 * @property {string} username
 * @property {string} nickname
 * @property {string} avatar
 * @property {string} phone
 * @property {string} email
 * @property {number} status - 1-正常 0-禁用
 * @property {number} createdAt - Unix 时间戳（秒）
 * @property {string} signature - 个性签名
 * @property {number} gender - 性别：0-未知, 1-男, 2-女
 * @property {string} region - 地区
 */

/**
 * @typedef {Object} ProfileResponse
 * @property {UserInfo} user
 */

/**
 * @typedef {Object} UpdateProfileRequest
 * @property {string=} nickname
 * @property {string=} avatar
 * @property {string=} phone
 * @property {string=} signature
 * @property {number=} gender
 * @property {string=} region
 */

/**
 * 获取当前用户资料
 * @returns {Promise<ProfileResponse|UserInfo>}
 */
export const getProfile = () => {
  return request.get('/api/v1/user/profile');
};

/**
 * 更新用户资料
 * @param {UpdateProfileRequest} data
 * @returns {Promise<ProfileResponse|UserInfo>}
 */
export const updateProfile = (data) => {
  return request.put('/api/v1/user/profile', data);
};

/**
 * 更新头像
 * @param {string} avatar
 * @returns {Promise<ProfileResponse|UserInfo>}
 */
export const updateAvatar = (avatar) => {
  return request.put('/api/v1/user/avatar', { avatar });
};

/**
 * 搜索用户
 * @param {string} keyword
 * @returns {Promise<{users: UserInfo[], total: number}>}
 */
export const searchUser = (keyword) => {
  return request.get('/api/v1/user/search', { params: { keyword } });
};

/**
 * 全局模糊搜索 (用户和群组)
 * @param {string} keyword
 * @returns {Promise<{users: UserInfo[], groups: Object[]}>}
 */
export const searchGlobal = (keyword) => {
  return request.get('/api/v1/user/search/global', { params: { keyword } });
};

/**
 * 获取指定用户信息
 * @param {number|string} id
 * @returns {Promise<ProfileResponse|UserInfo>}
 */
export const getUserById = (id) => {
  return request.get(`/api/v1/user/${id}`);
};
