import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
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

// Simple Private Route wrapper
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('accessToken');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#0061ff',
          borderRadius: 12,
        },
        components: {
          Button: {
            controlHeightLG: 48,
            fontWeight: 600,
          },
          Input: {
            controlHeightLG: 48,
          },
        }
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
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
