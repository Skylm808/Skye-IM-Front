import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AutoComplete, Avatar, Empty, Input, Spin, Typography, theme } from 'antd';
import { SearchOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { searchGlobal } from '../api/user';

const { Text } = Typography;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const GlobalSearchBox = ({
  value,
  onChange,
  onSelect,
  placeholder = '搜索',
  style,
  inputStyle,
  popupMatchSelectWidth = 260,
}) => {
  const { token } = theme.useToken();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);
  const debounceRef = useRef(null);
  const cacheRef = useRef(new Map());

  const renderHighlight = useCallback(
    (text, keyword) => {
      const raw = String(text || '');
      const trimmed = String(keyword || '').trim();
      if (!trimmed) return raw;
      const parts = raw.split(new RegExp(`(${escapeRegExp(trimmed)})`, 'ig'));
      return parts.map((part, idx) => {
        if (part.toLowerCase() !== trimmed.toLowerCase()) return part;
        return (
          <span key={`${part}-${idx}`} style={{ color: token.colorPrimary, fontWeight: 600 }}>
            {part}
          </span>
        );
      });
    },
    [token.colorPrimary]
  );

  const buildOptions = useCallback(
    (data, keyword) => {
      const next = [];
      if (data?.users?.length) {
        next.push({
          label: <Text type="secondary">用户</Text>,
          options: data.users.map((u) => ({
            value: `user_${u.id}`,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar src={u.avatar} size="small" icon={<UserOutlined />} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Text strong>{renderHighlight(u.nickname || u.username, keyword)}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    @{renderHighlight(u.username, keyword)}
                  </Text>
                  {u.signature ? (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {renderHighlight(u.signature, keyword)}
                    </Text>
                  ) : null}
                </div>
              </div>
            ),
            data: u,
            type: 'user',
          })),
        });
      }
      if (data?.groups?.length) {
        next.push({
          label: <Text type="secondary">群组</Text>,
          options: data.groups.map((g) => ({
            value: `group_${g.groupId}`,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar shape="square" src={g.avatar} size="small" icon={<TeamOutlined />} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Text strong>{renderHighlight(g.name, keyword)}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    ID: {renderHighlight(g.groupId, keyword)}
                  </Text>
                  {g.description ? (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {renderHighlight(g.description, keyword)}
                    </Text>
                  ) : null}
                </div>
              </div>
            ),
            data: g,
            type: 'group',
          })),
        });
      }
      return next;
    },
    [renderHighlight]
  );

  const runSearch = useCallback(
    async (keyword) => {
      const trimmed = keyword.trim();
      if (!trimmed) {
        setOptions([]);
        setLoading(false);
        return;
      }
      if (cacheRef.current.has(trimmed)) {
        setOptions(cacheRef.current.get(trimmed));
        setLoading(false);
        return;
      }
      const requestId = ++requestRef.current;
      setLoading(true);
      try {
        const res = await searchGlobal(trimmed);
        if (requestRef.current !== requestId) return;
        const next = buildOptions(res, trimmed);
        cacheRef.current.set(trimmed, next);
        setOptions(next);
      } catch (e) {
        if (requestRef.current === requestId) setOptions([]);
        // 需要时由父组件处理错误提示
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    },
    [buildOptions]
  );

  const handleSearch = useCallback(
    (nextValue) => {
      onChange?.(nextValue);
      const trimmed = String(nextValue || '').trim();
      window.clearTimeout(debounceRef.current);
      if (!trimmed) {
        setOptions([]);
        setLoading(false);
        return;
      }
      debounceRef.current = window.setTimeout(() => {
        runSearch(trimmed);
      }, 250);
    },
    [onChange, runSearch]
  );

  useEffect(() => {
    if (!String(value || '').trim()) {
      setOptions([]);
      setLoading(false);
    }
  }, [value]);

  useEffect(() => () => window.clearTimeout(debounceRef.current), []);

  const notFoundContent = String(value || '').trim()
    ? loading
      ? (
        <div style={{ padding: 12, textAlign: 'center' }}>
          <Spin size="small" />
        </div>
      )
      : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无匹配结果"
        />
      )
    : null;

  return (
    <AutoComplete
      popupMatchSelectWidth={popupMatchSelectWidth}
      style={style}
      options={options}
      onSelect={onSelect}
      onSearch={handleSearch}
      value={value}
      filterOption={false}
      notFoundContent={notFoundContent}
    >
      <Input
        placeholder={placeholder}
        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
        style={{ borderRadius: 20, background: '#f8fafc', border: 'none', ...inputStyle }}
        allowClear
      />
    </AutoComplete>
  );
};

export default GlobalSearchBox;
