# SkyeIM Frontend (Skye-IM-Front)

SkyeIM 即时通讯项目的前端代码仓库，基于 **React + Vite**，UI 主要使用 **Ant Design**，通过 `vite` 开发代理对接本地后端服务。

## 功能概览

- 登录 / 注册 / 邮箱验证码 / 忘记密码 / 修改密码
- 个人资料页
- 用户搜索
- 好友列表 / 添加好友 / 好友请求 / 黑名单

> 备注：登录态 Token 目前保存在 `localStorage`（`accessToken` / `refreshToken`）。

## 技术栈

- React + Vite
- React Router
- Ant Design + @ant-design/icons
- Axios
- ESLint

## 快速开始

建议 Node.js 版本：**18+**

```bash
npm install
npm run dev
```

构建生产包：

```bash
npm run build
```

本地预览构建产物：

```bash
npm run preview
```

## 后端对接（开发代理）

开发环境通过 `vite` 代理转发接口（见 `vite.config.js`），或者直接通过 `src/api/request.js` 配置 BaseURL。

所有模块统一通过网关访问：

- `/api` → `http://localhost:8080` (Gateway)

如你的后端网关端口不同，请修改 `src/api/request.js` 中的 `baseURL` 或 `vite.config.js` 的代理配置。

## 目录结构（简要）

- `src/api`：Axios 封装与接口模块（auth/user/friend）
- `src/pages`：页面（登录、注册、好友、个人资料等）
- `src/components`：可复用组件（好友卡片、弹窗等）
- `src/hooks`：自定义 hooks

## License

MIT License. See `LICENSE`.
