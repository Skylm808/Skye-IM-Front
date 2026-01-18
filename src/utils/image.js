import { GATEWAY_ORIGIN } from '../api/request';

/**
 * 获取头像的完整 URL
 * @param {string} avatar - 头像地址或文件名
 * @returns {string} - 完整 URL
 */
export const getAvatarUrl = (avatar) => {
    if (!avatar) return '';
    if (avatar.startsWith('http') || avatar.startsWith('data:')) {
        return avatar;
    }
    // 如果只是文件名 (例如 uuid.jpg)，拼接完整的后端地址
    // 假设后端静态资源路径约定为 /avatars/文件名
    // 根据 request.js 中的 normalizeMediaUrl 逻辑推断
    return `${GATEWAY_ORIGIN}/avatars/${avatar}`;
};
