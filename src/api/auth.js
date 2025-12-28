import request from './request';

/**
 * Send email captcha
 * @param {string} email
 * @param {string} type - 'register' or 'reset'
 */
export const sendCaptcha = (email, type = 'register') => {
    return request.post('/api/v1/auth/captcha/send', { email, type });
};

/**
 * Register user
 * @param {Object} data - { username, password, email, captcha, phone, nickname }
 */
export const register = (data) => {
    return request.post('/api/v1/auth/register', data);
};

/**
 * Login user
 * @param {string} username
 * @param {string} password
 */
export const login = (username, password) => {
    return request.post('/api/v1/auth/login', { username, password });
};

/**
 * Refresh token
 * @param {string} refreshToken
 */
export const refreshToken = (refreshToken) => {
    return request.post('/api/v1/auth/refresh', { refreshToken });
};

/**
 * Logout user
 */
export const logout = () => {
    return request.post('/api/v1/auth/logout', {});
};

/**
 * Get user info
 */
export const getUserInfo = () => {
    return request.get('/api/v1/auth/userinfo');
};

/**
 * Forgot password (Reset)
 * @param {Object} data - { email, captcha, newPassword }
 */
export const forgotPassword = (data) => {
    return request.post('/api/v1/auth/password/forgot', data);
};

/**
 * Change password (Logged in)
 * @param {Object} data - { oldPassword, newPassword }
 */
export const changePassword = (data) => {
    return request.post('/api/v1/auth/password/change', data);
};
