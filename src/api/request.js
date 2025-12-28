import axios from 'axios';
import { message } from 'antd';

const request = axios.create({
    baseURL: '',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor
request.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
request.interceptors.response.use(
    (response) => {
        const payload = response.data;

        // If backend doesn't use { code, message, data } envelope, treat as success.
        if (!payload || typeof payload !== 'object' || !Object.prototype.hasOwnProperty.call(payload, 'code')) {
            return payload;
        }

        const rawCode = payload.code;
        const code = typeof rawCode === 'string' ? Number(rawCode) : rawCode;
        const msg = payload.message ?? payload.msg;

        // Common success codes: 0 (custom), 200 (HTTP-style)
        if (code === 0 || code === 200) {
            return payload.data !== undefined ? payload.data : payload;
        }

        // Token expired or invalid
        if (code === 10002 || code === 10107 || code === 10108) {
            // Clear tokens and redirect to login if refresh fails
            // For simplicity in this demo, we'll just redirect
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
                window.location.href = '/login';
            }
        }

        message.error(msg || 'Request failed');
        const err = new Error(msg || 'Request failed');
        err.code = code;
        err.payload = payload;
        return Promise.reject(err);
    },
    (error) => {
        const serverMsg = error?.response?.data?.message ?? error?.response?.data?.msg;
        message.error(serverMsg || error.message || 'Network error');
        return Promise.reject(error);
    }
);

export default request;
