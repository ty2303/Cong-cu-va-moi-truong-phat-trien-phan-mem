import crypto from "node:crypto";
import { MongoClient } from "mongodb";

const now = () => new Date().toISOString();

const DEFAULT_USERS = [
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
];

const DEFAULT_CATEGORIES = [
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
  },
  {
    id: "cat-xiaomi",
    name: "Xiaomi",
    slug: "xiaomi",
    description: "Xiaomi va Redmi",
    icon: "Smartphone",
    createdAt: now()
  },
  {
    id: "cat-oppo",
    name: "OPPO",
    slug: "oppo",
    description: "OPPO Reno va Find",
    icon: "Smartphone",
    createdAt: now()
  }
];

const DEFAULT_PRODUCTS = [
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
  },
  {
    id: "prod-xiaomi-14",
    name: "Xiaomi 14",
    brand: "Xiaomi",
    categoryId: "cat-xiaomi",
    price: 18990000,
    originalPrice: 20990000,
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80",
    rating: 4.7,
    badge: "Gia tot",
    specs: "Snapdragon 8 Gen 3, 256GB, Leica Camera",
    stock: 15,
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "prod-oppo-find-x8",
    name: "OPPO Find X8",
    brand: "OPPO",
    categoryId: "cat-oppo",
    price: 21990000,
    originalPrice: 23990000,
    image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80",
    rating: 4.6,
    badge: "Noi bat",
    specs: "Dimensity flagship, 512GB, Hasselblad Camera",
    stock: 10,
    createdAt: now(),
    updatedAt: now()
  }
];

const DEFAULT_ORDERS = [
  {
    id: "order-1",
    userId: "user-1",
    email: "demo@example.com",
    customerName: "Demo User",
    phone: "0900000001",
    address: "123 Duong Nguyen Hue",
    city: "TP.HCM",
    district: "Quan 1",
    ward: "Ben Nghe",
    note: "Giao gio hanh chinh",
    paymentMethod: "COD",
    status: "DELIVERED",
    items: [
      {
        productId: "prod-iphone-15",
        productName: "iPhone 15 Pro",
        price: 27990000,
        quantity: 1
      }
    ],
    subtotal: 27990000,
    shippingFee: 0,
    total: 27990000,
    createdAt: now(),
    paymentStatus: "PAID"
  }
];

const DEFAULT_REVIEWS = [
  {
    id: "review-1",
    productId: "prod-iphone-15",
    userId: "user-1",
    username: "demo",
    rating: 5,
    comment: "San pham dep, giao hang nhanh.",
    images: [],
    createdAt: now()
  },
  {
    id: "review-2",
    productId: "prod-galaxy-s25",
    userId: "user-1",
    username: "demo",
    rating: 4,
    comment: "May manh, man hinh dep, camera on.",
    images: [],
    createdAt: now()
  }
];

const DEFAULT_WISHLISTS = [{ userId: "user-1", productIds: ["prod-iphone-15"] }];

const DEFAULT_TOKENS = [
  { token: "demo-token", userId: "user-1", createdAt: now() },
  { token: "admin-token", userId: "admin-1", createdAt: now() }
];

let clientPromise = null;
let dbPromise = null;
let seedPromise = null;

function getMongoUri() {
  return process.env.MONGODB_URI ?? process.env.MONGO_URI;
}

function getDatabaseName() {
  return process.env.MONGODB_DB_NAME ?? "phone_store";
}

function removeMongoId(document) {
  if (!document) {
    return null;
  }

  const { _id, ...cleanDocument } = document;
  return cleanDocument;
}

async function ensureSeedData() {
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    const database = await getDatabase();
    const users = database.collection("users");
    if ((await users.countDocuments({}, { limit: 1 })) === 0) {
      await users.insertMany(DEFAULT_USERS);
    }

    const categories = database.collection("categories");
    if ((await categories.countDocuments({}, { limit: 1 })) === 0) {
      await categories.insertMany(DEFAULT_CATEGORIES);
    }

    const products = database.collection("products");
    if ((await products.countDocuments({}, { limit: 1 })) === 0) {
      await products.insertMany(DEFAULT_PRODUCTS);
    }

    const orders = database.collection("orders");
    if ((await orders.countDocuments({}, { limit: 1 })) === 0) {
      await orders.insertMany(DEFAULT_ORDERS);
    }

    const reviews = database.collection("reviews");
    if ((await reviews.countDocuments({}, { limit: 1 })) === 0) {
      await reviews.insertMany(DEFAULT_REVIEWS);
    }

    const wishlists = database.collection("wishlists");
    if ((await wishlists.countDocuments({}, { limit: 1 })) === 0) {
      await wishlists.insertMany(DEFAULT_WISHLISTS);
    }

    const tokens = database.collection("tokens");
    if ((await tokens.countDocuments({}, { limit: 1 })) === 0) {
      await tokens.insertMany(DEFAULT_TOKENS);
    }
  })().catch((error) => {
    seedPromise = null;
    throw error;
  });

  return seedPromise;
}

async function getDatabase() {
  if (dbPromise) {
    return dbPromise;
  }

  const mongoUri = getMongoUri();
  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(mongoUri).connect().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }

  dbPromise = clientPromise
    .then(async (client) => {
      const database = client.db(getDatabaseName());
      await database.command({ ping: 1 });
      return database;
    })
    .catch((error) => {
      dbPromise = null;
      throw error;
    });

  return dbPromise;
}

export async function connectToDatabase() {
  await getDatabase();
  await ensureSeedData();
}

export async function getCollection(name) {
  await connectToDatabase();
  const database = await getDatabase();
  return database.collection(name);
}

export function buildCategoryMap(categories) {
  return new Map(categories.map((category) => [category.id, category]));
}

export function withCategory(product, categoryMap = new Map()) {
  const cleanProduct = removeMongoId(product);
  return {
    ...cleanProduct,
    categoryName: categoryMap.get(cleanProduct.categoryId)?.name ?? ""
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

export async function issueToken(userId) {
  const token = `${userId}-${crypto.randomUUID()}`;
  const tokens = await getCollection("tokens");
  await tokens.insertOne({
    token,
    userId,
    createdAt: now()
  });
  return token;
}

export async function getUserByToken(token) {
  const tokens = await getCollection("tokens");
  const tokenEntry = await tokens.findOne({ token });
  if (!tokenEntry) {
    return null;
  }

  const users = await getCollection("users");
  return removeMongoId(await users.findOne({ id: tokenEntry.userId }));
}

export function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const cleanUser = removeMongoId(user);
  const { password, ...safeUser } = cleanUser;
  return safeUser;
}

export function createOrderDocument(payload, user) {
  const subtotal = payload.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const shippingFee = subtotal > 10000000 ? 0 : 30000;

  return {
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
}

export function cleanDocument(document) {
  return removeMongoId(document);
}
