// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const navigateMock = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>(
    'react-router',
  );

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function createStorageMock(): StorageMock {
  const store = new Map<string, string>();

  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', createStorageMock());
  window.history.replaceState({}, '', '/oauth2/callback');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('OAuth2Callback', () => {
  test('logs in with canonical user data from /users/me and redirects by role', async () => {
    window.history.replaceState({}, '', '/oauth2/callback?token=google-token');

    const [
      { Component: OAuth2Callback },
      { default: apiClient },
      { useAuthStore },
      { useWishlistStore },
      { useCartStore },
    ] = await Promise.all([
      import('@/pages/OAuth2Callback'),
      import('@/api/client'),
      import('@/store/useAuthStore'),
      import('@/store/useWishlistStore'),
      import('@/store/useCartStore'),
    ]);

    const wishlistFetch = vi.fn().mockResolvedValue(undefined);
    const cartFetch = vi.fn().mockResolvedValue(undefined);

    useAuthStore.setState({
      token: null,
      user: null,
      isLoggedIn: false,
      isAdmin: false,
    });
    useWishlistStore.setState({ fetch: wishlistFetch });
    useCartStore.setState({ fetch: cartFetch });

    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          id: 'admin-1',
          username: 'admin',
          email: 'admin@example.com',
          role: 'ADMIN',
        },
      },
    });

    render(<OAuth2Callback />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/users/me', {
        headers: {
          Authorization: 'Bearer google-token',
        },
      });
    });

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe('google-token');
      expect(useAuthStore.getState().user).toEqual({
        id: 'admin-1',
        username: 'admin',
        email: 'admin@example.com',
        role: 'ADMIN',
      });
      expect(useAuthStore.getState().isAdmin).toBe(true);
      expect(wishlistFetch).toHaveBeenCalledTimes(1);
      expect(cartFetch).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith('/admin', { replace: true });
    });
  });

  test('redirects to login when token is missing from callback URL', async () => {
    const [{ Component: OAuth2Callback }] = await Promise.all([
      import('@/pages/OAuth2Callback'),
    ]);

    render(<OAuth2Callback />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?error=google_failed', {
        replace: true,
      });
    });
  });

  test('redirects to login when canonical user fetch fails', async () => {
    window.history.replaceState({}, '', '/oauth2/callback?token=bad-token');

    const [
      { Component: OAuth2Callback },
      { default: apiClient },
      { useAuthStore },
    ] = await Promise.all([
      import('@/pages/OAuth2Callback'),
      import('@/api/client'),
      import('@/store/useAuthStore'),
    ]);

    useAuthStore.setState({
      token: null,
      user: null,
      isLoggedIn: false,
      isAdmin: false,
    });

    vi.mocked(apiClient.get).mockRejectedValue(new Error('Unauthorized'));

    render(<OAuth2Callback />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?error=google_failed', {
        replace: true,
      });
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  test('redirects to login when /users/me returns an incomplete user payload', async () => {
    window.history.replaceState(
      {},
      '',
      '/oauth2/callback?token=incomplete-user-token',
    );

    const [
      { Component: OAuth2Callback },
      { default: apiClient },
      { useAuthStore },
    ] = await Promise.all([
      import('@/pages/OAuth2Callback'),
      import('@/api/client'),
      import('@/store/useAuthStore'),
    ]);

    useAuthStore.setState({
      token: null,
      user: null,
      isLoggedIn: false,
      isAdmin: false,
    });

    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          id: 'user-1',
          username: 'demo',
          email: 'demo@example.com',
          role: '',
        },
      },
    });

    render(<OAuth2Callback />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login?error=google_failed', {
        replace: true,
      });
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });
});
