import { useEffect } from 'react';
import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/api/types';
import { useAuthStore, type AuthUser } from '@/store/useAuthStore';

export default function AuthBootstrap() {
  const token = useAuthStore((s) => s.token);
  const syncUser = useAuthStore((s) => s.syncUser);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    void apiClient
      .get<ApiResponse<AuthUser>>(ENDPOINTS.USERS.ME)
      .then((res) => {
        if (cancelled || !res.data?.data) return;
        syncUser(res.data.data);
      })
      .catch(() => {
        // Global interceptor handles invalid sessions.
      });

    return () => {
      cancelled = true;
    };
  }, [syncUser, token]);

  return null;
}
