import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/api/types';
import { type AuthUser, useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';

export const Component = OAuth2Callback;

function OAuth2Callback() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      navigate('/login?error=google_failed', { replace: true });
      return undefined;
    }

    void apiClient
      .get<ApiResponse<AuthUser>>(ENDPOINTS.USERS.ME, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(async (res) => {
        const user = res.data?.data;
        if (cancelled) {
          return;
        }

        if (!user?.id || !user.username || !user.email || !user.role) {
          navigate('/login?error=google_failed', { replace: true });
          return;
        }

        login(token, user);
        await Promise.allSettled([
          useWishlistStore.getState().fetch(),
          useCartStore.getState().fetch(),
        ]);
        navigate(user.role === 'ADMIN' ? '/admin' : '/', { replace: true });
      })
      .catch(() => {
        if (!cancelled) {
          navigate('/login?error=google_failed', { replace: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [login, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-text-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm">Đang hoàn tất đăng nhập...</p>
      </div>
    </div>
  );
}
