import { create } from 'zustand';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/api/types';
import type { Order } from '@/types/order';

interface OrderState {
  orders: Order[];
  isLoading: boolean;
  fetchOrders: () => Promise<void>;
  addOrder: (order: Order) => void;
  cancelOrder: (orderId: string, reason: string) => Promise<void>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  isLoading: false,

  fetchOrders: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get<ApiResponse<Order[]>>(ENDPOINTS.ORDERS.MY);
      set({ orders: res.data.data });
    } catch {
      set({ orders: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  addOrder: (order) => {
    set({ orders: [order, ...get().orders] });
  },

  cancelOrder: async (orderId, reason) => {
    await apiClient.patch(ENDPOINTS.ORDERS.CANCEL(orderId), null, {
      params: { reason },
    });
    set({
      orders: get().orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'CANCELLED' as const,
              paymentStatus: 'FAILED',
              cancelReason: reason,
              cancelledBy: 'USER',
            }
          : o,
      ),
    });
  },
}));
