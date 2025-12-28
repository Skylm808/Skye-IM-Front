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

开发环境通过 `vite` 代理转发接口（见 `vite.config.js`）：

- `/api/v1/auth` → `http://localhost:10000`
- `/api/v1/user` → `http://localhost:10100`
- `/api/v1/friend` → `http://localhost:10200`
- `/api` → `http://localhost:8888`

如你的后端端口/网关不同，按需修改 `vite.config.js` 的 `server.proxy`。

## 目录结构（简要）

- `src/api`：Axios 封装与接口模块（auth/user/friend）
- `src/pages`：页面（登录、注册、好友、个人资料等）
- `src/components`：可复用组件（好友卡片、弹窗等）
- `src/hooks`：自定义 hooks

## License

Private / Internal use (如需开源可在此补充协议)。
