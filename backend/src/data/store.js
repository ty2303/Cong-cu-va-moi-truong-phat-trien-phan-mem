import crypto from "node:crypto";

const now = () => new Date().toISOString();

export const db = {
  users: [
    {
      id: "user-1",
      username: "demo",
      email: "demo@example.com",
      password: "123456",
      role: "USER",
      hasPassword: true,
      authProvider: "LOCAL",
      createdAt: now()
    },
    {
      id: "admin-1",
      username: "admin",
      email: "admin@example.com",
      password: "admin123",
      role: "ADMIN",
      hasPassword: true,
      authProvider: "LOCAL",
      createdAt: now()
    }
  ],
  categories: [
    {
      id: "cat-iphone",
      name: "iPhone",
      slug: "iphone",
      description: "Apple iPhone",
      icon: "Smartphone",
      createdAt: now()
    },
    {
      id: "cat-samsung",
      name: "Samsung",
      slug: "samsung",
      description: "Samsung Galaxy",
      icon: "Smartphone",
      createdAt: now()
    }
  ],
  products: [
    {
      id: "prod-iphone-15",
      name: "iPhone 15 Pro",
      brand: "Apple",
      categoryId: "cat-iphone",
      price: 27990000,
      originalPrice: 30990000,
      image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80",
      rating: 4.9,
      badge: "Ban chay",
      specs: "A17 Pro, 256GB, Titanium",
      stock: 12,
      createdAt: now(),
      updatedAt: now()
    },
    {
      id: "prod-galaxy-s25",
      name: "Galaxy S25 Ultra",
      brand: "Samsung",
      categoryId: "cat-samsung",
      price: 26990000,
      originalPrice: 29990000,
      image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80",
      rating: 4.8,
      badge: "Moi",
      specs: "Snapdragon, 512GB, AI Camera",
      stock: 8,
      createdAt: now(),
      updatedAt: now()
    }
  ],
  orders: [],
  reviews: [
    {
      id: "review-1",
      productId: "prod-iphone-15",
      userId: "user-1",
      username: "demo",
      rating: 5,
      comment: "San pham dep, giao hang nhanh.",
      images: [],
      createdAt: now()
    }
  ],
  wishlists: {
    "user-1": ["prod-iphone-15"]
  },
  tokens: new Map([
    ["demo-token", "user-1"],
    ["admin-token", "admin-1"]
  ])
};

export function withCategory(product) {
  const category = db.categories.find((item) => item.id === product.categoryId);
  return {
    ...product,
    categoryName: category?.name ?? ""
  };
}

export function paginate(items, page = 0, size = 10) {
  const safePage = Number.isFinite(page) ? page : 0;
  const safeSize = Number.isFinite(size) ? size : 10;
  const start = safePage * safeSize;

  return {
    content: items.slice(start, start + safeSize),
    number: safePage,
    size: safeSize,
    totalPages: Math.max(1, Math.ceil(items.length / safeSize)),
    totalElements: items.length
  };
}

export function issueToken(userId) {
  const token = `${userId}-${crypto.randomUUID()}`;
  db.tokens.set(token, userId);
  return token;
}

export function getUserByToken(token) {
  const userId = db.tokens.get(token);
  return db.users.find((user) => user.id === userId) ?? null;
}

export function sanitizeUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

export function createOrder(payload, user) {
  const subtotal = payload.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const shippingFee = subtotal > 10000000 ? 0 : 30000;
  const order = {
    id: crypto.randomUUID(),
    userId: user?.id ?? "guest",
    email: payload.email,
    customerName: payload.customerName,
    phone: payload.phone,
    address: payload.address,
    city: payload.city,
    district: payload.district,
    ward: payload.ward,
    note: payload.note ?? "",
    paymentMethod: payload.paymentMethod,
    status: "PENDING",
    items: payload.items,
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    createdAt: now(),
    paymentStatus: payload.paymentMethod === "MOMO" ? "PENDING" : "UNPAID"
  };

  db.orders.unshift(order);
  return order;
}
