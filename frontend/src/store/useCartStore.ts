import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Product } from '@/types/product';

export const MAX_QUANTITY = 99;

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        const existing = get().items.find((i) => i.product.id === product.id);
        if (existing) {
          if (existing.quantity >= MAX_QUANTITY) return;
          set({
            items: get().items.map((i) =>
              i.product.id === product.id
                ? { ...i, quantity: Math.min(i.quantity + 1, MAX_QUANTITY) }
                : i,
            ),
          });
        } else {
          set({ items: [...get().items, { product, quantity: 1 }] });
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.product.id !== productId) });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        const clamped = Math.min(quantity, MAX_QUANTITY);
        set({
          items: get().items.map((i) =>
            i.product.id === productId ? { ...i, quantity: clamped } : i,
          ),
        });
      },

      clear: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    }),
    { name: 'nebula-cart', version: 1 },
  ),
);
