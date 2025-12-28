import { useCallback, useRef, useState } from 'react';
import { getUserById } from '../api/user';

const normalizeUser = (data) => (data && data.user ? data.user : data);

/**
 * 轻量用户信息缓存（基于 userId -> user）
 * - 避免同一页面反复调用 /api/v1/user/:id
 * - 对外暴露 getUser / ensureUsers
 */
const useUserCache = () => {
  const cacheRef = useRef(new Map());
  const inflightRef = useRef(new Map());
  const [, forceUpdate] = useState(0);

  const getUser = useCallback((userId) => {
    if (!userId && userId !== 0) return null;
    return cacheRef.current.get(Number(userId)) || null;
  }, []);

  const ensureUsers = useCallback(async (ids) => {
    const list = Array.isArray(ids) ? ids : [];
    const unique = Array.from(
      new Set(
        list
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v) && v > 0)
      )
    );

    const missing = unique.filter((id) => !cacheRef.current.has(id));
    if (missing.length === 0) return;

    await Promise.all(
      missing.map(async (id) => {
        if (inflightRef.current.has(id)) {
          await inflightRef.current.get(id);
          return;
        }
        const p = (async () => {
          try {
            const data = await getUserById(id);
            cacheRef.current.set(id, normalizeUser(data));
          } catch {
            // 忽略单个用户加载失败（不影响列表渲染）
          } finally {
            inflightRef.current.delete(id);
          }
        })();
        inflightRef.current.set(id, p);
        await p;
      })
    );

    forceUpdate((v) => v + 1);
  }, []);

  return { getUser, ensureUsers };
};

export default useUserCache;

