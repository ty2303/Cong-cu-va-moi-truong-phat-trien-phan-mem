import express from "express";
import { ok } from "../lib/apiResponse.js";
import { serializeProduct } from "../lib/catalogSerializers.js";
import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { Wishlist } from "../models/Wishlist.js";
import { requireAuth } from "../middleware/auth.js";

export const wishlistRouter = express.Router();

wishlistRouter.use(requireAuth);

wishlistRouter.get("/", async (req, res) => {
  const wishlist = await Wishlist.findOne({ userId: req.user.id }).lean();
  const items = await getWishlistProducts(wishlist?.productIds ?? []);
  res.json(ok(items));
});

wishlistRouter.post("/:productId", async (req, res) => {
  const wishlist = await Wishlist.findOne({ userId: req.user.id });
  const nextIds = new Set(wishlist?.productIds ?? []);

  if (nextIds.has(req.params.productId)) {
    nextIds.delete(req.params.productId);
  } else {
    nextIds.add(req.params.productId);
  }

  await Wishlist.findOneAndUpdate(
    { userId: req.user.id },
    {
      userId: req.user.id,
      productIds: [...nextIds],
      updatedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const items = await getWishlistProducts([...nextIds]);
  res.json(ok(items));
});

wishlistRouter.delete("/", async (req, res) => {
  await Wishlist.findOneAndUpdate(
    { userId: req.user.id },
    {
      userId: req.user.id,
      productIds: [],
      updatedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json(ok(null, "Da xoa wishlist"));
});

async function getWishlistProducts(productIds) {
  if (productIds.length === 0) {
    return [];
  }

  const [products, categories] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).lean(),
    Category.find().lean()
  ]);
  const categoryMap = new Map(categories.map((category) => [category._id, category.name]));
  const productMap = new Map(
    products.map((product) => [
      product._id,
      serializeProduct(product, categoryMap.get(product.categoryId) ?? "")
    ])
  );

  return productIds.map((id) => productMap.get(id)).filter(Boolean);
}
