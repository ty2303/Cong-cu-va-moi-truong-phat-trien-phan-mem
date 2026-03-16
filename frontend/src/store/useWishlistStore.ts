import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useAuthStore } from '@/store/useAuthStore';
import type { ApiResponse } from '@/api/types';
import type { Product } from '@/types/product';

interface WishlistState {
  items: Product[];
  isLoading: boolean;
  error: string | null;
  toggle: (product: Product) => Promise<void>;
  has: (id: string) => boolean;
  fetch: () => Promise<void>;
  clear: () => Promise<void>;
  clearLocal: () => void;
  reset: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      error: null,

      toggle: async (product) => {
        const { isLoggedIn } = useAuthStore.getState();
        const prevItems = get().items;
        const exists = prevItems.some((p) => p.id === product.id);

        // Optimistic update
        set({
          error: null,
          items: exists
            ? prevItems.filter((p) => p.id !== product.id)
            : [...prevItems, product],
        });

        if (!isLoggedIn) return;

        try {
          const res = await apiClient.post<ApiResponse<Product[]>>(
            ENDPOINTS.WISHLIST.TOGGLE(product.id),
          );
          set({ items: res.data.data, error: null });
        } catch {
          // Revert on error
          set({
            items: prevItems,
            error: 'Khong the cap nhat wishlist luc nay.',
          });
        }
      },

      has: (id) => get().items.some((p) => p.id === id),

      fetch: async () => {
        if (!useAuthStore.getState().isLoggedIn) {
          set({ isLoading: false, error: null });
          return;
        }
        set({ isLoading: true, error: null });
        try {
          const res = await apiClient.get<ApiResponse<Product[]>>(
            ENDPOINTS.WISHLIST.BASE,
          );
          set({ items: res.data.data, error: null });
        } catch {
          set({ error: 'Khong the tai wishlist tu he thong.' });
        } finally {
          set({ isLoading: false });
        }
      },

      clear: async () => {
        const { isLoggedIn } = useAuthStore.getState();
        const prevItems = get().items;
        set({ items: [], error: null });
        if (!isLoggedIn) return;
        try {
          await apiClient.delete(ENDPOINTS.WISHLIST.BASE);
        } catch {
          set({
            items: prevItems,
            error: 'Khong the xoa wishlist luc nay.',
          });
        }
      },

      clearLocal: () => set({ items: [], error: null }),
      reset: () => set({ items: [], isLoading: false, error: null }),
    }),
    {
      name: 'nebula-wishlist',
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
