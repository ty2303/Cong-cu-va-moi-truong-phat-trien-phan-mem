import express from "express";
import {
  buildCategoryMap,
  cleanDocument,
  getCollection,
  withCategory
} from "../data/store.js";
import { ok } from "../lib/apiResponse.js";
import { requireAuth } from "../middleware/auth.js";

export const wishlistRouter = express.Router();

wishlistRouter.use(requireAuth);

wishlistRouter.get("/", async (req, res) => {
  const wishlists = await getCollection("wishlists");
  const products = await getCollection("products");
  const categories = await getCollection("categories");
  const wishlist = cleanDocument(await wishlists.findOne({ userId: req.user.id }));
  const ids = wishlist?.productIds ?? [];
  const productItems = (await products.find({ id: { $in: ids } }).toArray()).map(cleanDocument);
  const categoryItems = (await categories.find({}).toArray()).map(cleanDocument);
  const items = productItems.map((product) => withCategory(product, buildCategoryMap(categoryItems)));
  res.json(ok(items));
});

wishlistRouter.post("/:productId", async (req, res) => {
  const wishlists = await getCollection("wishlists");
  const products = await getCollection("products");
  const categories = await getCollection("categories");
  const existing = cleanDocument(await wishlists.findOne({ userId: req.user.id }));
  const ids = new Set(existing?.productIds ?? []);
  if (ids.has(req.params.productId)) {
    ids.delete(req.params.productId);
  } else {
    ids.add(req.params.productId);
  }
  const nextIds = [...ids];
  await wishlists.updateOne(
    { userId: req.user.id },
    { $set: { userId: req.user.id, productIds: nextIds } },
    { upsert: true }
  );
  const productItems = (await products.find({ id: { $in: nextIds } }).toArray()).map(cleanDocument);
  const categoryItems = (await categories.find({}).toArray()).map(cleanDocument);
  const items = productItems.map((product) => withCategory(product, buildCategoryMap(categoryItems)));
  res.json(ok(items));
});

wishlistRouter.delete("/", async (req, res) => {
  const wishlists = await getCollection("wishlists");
  await wishlists.updateOne(
    { userId: req.user.id },
    { $set: { userId: req.user.id, productIds: [] } },
    { upsert: true }
  );
  res.json(ok(null, "Da xoa wishlist"));
});
