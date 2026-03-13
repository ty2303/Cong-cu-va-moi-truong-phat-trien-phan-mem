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
  toggle: (product: Product) => Promise<void>;
  has: (id: string) => boolean;
  fetch: () => Promise<void>;
  clear: () => Promise<void>;
  clearLocal: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      toggle: async (product) => {
        const { isLoggedIn } = useAuthStore.getState();
        const prevItems = get().items;
        const exists = prevItems.some((p) => p.id === product.id);

        // Optimistic update
        set({
          items: exists
            ? prevItems.filter((p) => p.id !== product.id)
            : [...prevItems, product],
        });

        if (!isLoggedIn) return;

        try {
          const res = await apiClient.post<ApiResponse<Product[]>>(
            ENDPOINTS.WISHLIST.TOGGLE(product.id),
          );
          set({ items: res.data.data });
        } catch {
          // Revert on error
          set({ items: prevItems });
        }
      },

      has: (id) => get().items.some((p) => p.id === id),

      fetch: async () => {
        if (!useAuthStore.getState().isLoggedIn) return;
        set({ isLoading: true });
        try {
          const res = await apiClient.get<ApiResponse<Product[]>>(
            ENDPOINTS.WISHLIST.BASE,
          );
          set({ items: res.data.data });
        } catch {
          // ignore fetch errors silently
        } finally {
          set({ isLoading: false });
        }
      },

      clear: async () => {
        const { isLoggedIn } = useAuthStore.getState();
        set({ items: [] });
        if (!isLoggedIn) return;
        try {
          await apiClient.delete(ENDPOINTS.WISHLIST.BASE);
        } catch {
          // local already cleared, no revert needed
        }
      },

      clearLocal: () => set({ items: [] }),
    }),
    {
      name: 'nebula-wishlist',
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
