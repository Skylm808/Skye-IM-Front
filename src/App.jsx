import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, theme } from 'antd';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';
import Home from './pages/Home';
import Profile from './pages/Profile';
import UserSearch from './pages/UserSearch';
import Friends from './pages/Friends';
import FriendRequests from './pages/FriendRequests';
import FriendsAdd from './pages/FriendsAdd';
import FriendsBlacklist from './pages/FriendsBlacklist';
import Chat from './pages/Chat';
import Contacts from './pages/Contacts';

// Simple Private Route wrapper
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('accessToken');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#0ea5e9', // Skye Blue
          borderRadius: 8,
          fontFamily: "'HarmonyOS Sans SC', 'Alibaba PuHuiTi 2.0', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f3f4f6', // Light gray layout bg
        },
        components: {
          Button: {
            controlHeight: 40,
            controlHeightLG: 48,
            fontWeight: 500,
            borderRadius: 8,
            defaultShadow: '0 2px 0 rgba(0, 0, 0, 0.02)',
          },
          Input: {
            controlHeight: 40,
            controlHeightLG: 48,
            borderRadius: 8,
          },
          Card: {
            borderRadiusLG: 16,
            boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
          },
          Layout: {
            bodyBg: '#f3f4f6',
            siderBg: '#ffffff',
          },
          Menu: {
            itemBorderRadius: 8,
            itemMarginInline: 8,
          }
        },
        cssVar: true,
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Home />
                </PrivateRoute>
              }
            />
            <Route
              path="/change-password"
              element={
                <PrivateRoute>
                  <ChangePassword />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              }
            />
            <Route
              path="/contacts"
              element={
                <PrivateRoute>
                  <Contacts />
                </PrivateRoute>
              }
            />
            <Route
              path="/user-search"
              element={
                <PrivateRoute>
                  <UserSearch />
                </PrivateRoute>
              }
            />
            <Route
              path="/friends"
              element={
                <PrivateRoute>
                  <Friends />
                </PrivateRoute>
              }
            />
            <Route
              path="/friends/requests"
              element={
                <PrivateRoute>
                  <FriendRequests />
                </PrivateRoute>
              }
            />
            <Route
              path="/friends/add"
              element={
                <PrivateRoute>
                  <FriendsAdd />
                </PrivateRoute>
              }
            />
            <Route
              path="/friends/blacklist"
              element={
                <PrivateRoute>
                  <FriendsBlacklist />
                </PrivateRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <PrivateRoute>
                  <Chat />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
