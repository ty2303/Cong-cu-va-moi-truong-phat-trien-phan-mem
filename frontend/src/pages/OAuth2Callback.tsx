import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { useAuthStore, type AuthUser } from '@/store/useAuthStore';
import { useWishlistStore } from '@/store/useWishlistStore';

export const Component = OAuth2Callback;

function OAuth2Callback() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const id = params.get('id');
    const username = params.get('username');
    const email = params.get('email');
    const role = params.get('role') as 'USER' | 'ADMIN' | null;

    if (token && id && username && email && role) {
      const user: AuthUser = { id, username, email, role };
      login(token, user);
      useWishlistStore.getState().fetch();
      navigate(role === 'ADMIN' ? '/admin' : '/', { replace: true });
    } else {
      navigate('/login?error=google_failed', { replace: true });
    }
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
