import request from './request';

export const uploadApi = {
  // 上传图片
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request.post('/api/v1/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // 上传文件
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request.post('/api/v1/upload/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // 上传头像
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request.post('/api/v1/upload/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};
