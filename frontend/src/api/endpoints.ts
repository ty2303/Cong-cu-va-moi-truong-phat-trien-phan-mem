/**
 * API endpoint constants.
 * Organize by domain/feature for easy discovery.
 */
export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  PRODUCTS: {
    BASE: '/products',
    BY_ID: (id: string) => `/products/${id}`,
    BATCH: '/products/batch',
  },
  CATEGORIES: {
    BASE: '/categories',
    BY_ID: (id: string) => `/categories/${id}`,
  },
  ORDERS: {
    BASE: '/orders',
    MY: '/orders/my',
    BY_ID: (id: string) => `/orders/${id}`,
    STATUS: (id: string) => `/orders/${id}/status`,
    CANCEL: (id: string) => `/orders/${id}/cancel`,
  },
  MOMO: {
    CREATE: (orderId: string) => `/momo/create?orderId=${orderId}`,
  },
  WISHLIST: {
    BASE: '/wishlist',
    TOGGLE: (productId: string) => `/wishlist/${productId}`,
  },
  CART: {
    BASE: '/cart',
    ITEMS: '/cart/items',
    ITEM: (productId: string) => `/cart/items/${productId}`,
  },
  REVIEWS: {
    BASE: '/reviews',
    BY_ID: (id: string) => `/reviews/${id}`,
    UPLOAD_IMAGE: '/reviews/upload-image',
  },
  UPLOAD: {
    IMAGE: '/upload/image',
  },
  USERS: {
    ME: '/users/me',
    CHANGE_PASSWORD: '/users/me/password',
    SETUP_PASSWORD: '/users/me/setup-password',
    ROLE: (id: string) => `/users/${id}/role`,
  },
} as const;
