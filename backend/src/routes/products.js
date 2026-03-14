import crypto from "node:crypto";
import express from "express";
import {
  buildCategoryMap,
  cleanDocument,
  getCollection,
  paginate,
  withCategory
} from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { requireAdmin } from "../middleware/auth.js";

export const productsRouter = express.Router();

productsRouter.get("/", async (req, res) => {
  const page = Number(req.query.page ?? 0);
  const size = Number(req.query.size ?? 12);
  const search = String(req.query.search ?? "").toLowerCase();
  const categoryId = String(req.query.categoryId ?? "");
  const products = await getCollection("products");
  const categories = await getCollection("categories");
  const productItems = (await products.find({}).toArray()).map(cleanDocument);
  const categoryItems = (await categories.find({}).toArray()).map(cleanDocument);
  const categoryMap = buildCategoryMap(categoryItems);

  const items = productItems
    .map((product) => withCategory(product, categoryMap))
    .filter((product) => {
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search) ||
        product.brand.toLowerCase().includes(search);
      const matchesCategory = !categoryId || product.categoryId === categoryId;
      return matchesSearch && matchesCategory;
    });

  res.json(ok(paginate(items, page, size)));
});

productsRouter.get("/:id", async (req, res) => {
  const products = await getCollection("products");
  const categories = await getCollection("categories");
  const product = cleanDocument(await products.findOne({ id: req.params.id }));
  if (!product) {
    return res.status(404).json(fail("Khong tim thay san pham", 404));
  }
  const categoryItems = (await categories.find({}).toArray()).map(cleanDocument);
  return res.json(ok(withCategory(product, buildCategoryMap(categoryItems))));
});

productsRouter.post("/", requireAdmin, async (req, res) => {
  const product = {
    id: `prod-${Date.now()}`,
    rating: 5,
    stock: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...req.body
  };
  const products = await getCollection("products");
  const categories = await getCollection("categories");
  await products.insertOne(product);
  const categoryItems = (await categories.find({}).toArray()).map(cleanDocument);
  res.status(201).json(ok(withCategory(product, buildCategoryMap(categoryItems)), "Tao san pham thanh cong", 201));
});

productsRouter.post("/batch", requireAdmin, async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  const created = items.map((item) => ({
    id: `prod-${crypto.randomUUID()}`,
    rating: 5,
    stock: item.stock ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...item
  }));
  const products = await getCollection("products");
  const categories = await getCollection("categories");
  if (created.length > 0) {
    await products.insertMany(created);
  }
  const categoryItems = (await categories.find({}).toArray()).map(cleanDocument);
  const categoryMap = buildCategoryMap(categoryItems);
  res.status(201).json(ok(created.map((item) => withCategory(item, categoryMap)), "Import san pham thanh cong", 201));
});

productsRouter.put("/:id", requireAdmin, async (req, res) => {
  const products = await getCollection("products");
  const categories = await getCollection("categories");
  const existing = await products.findOne({ id: req.params.id });
  const product = cleanDocument(existing);
  if (!product) {
    return res.status(404).json(fail("Khong tim thay san pham", 404));
  }
  const updatedProduct = {
    ...product,
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  await products.updateOne(
    { id: req.params.id },
    { $set: { ...req.body, updatedAt: updatedProduct.updatedAt } }
  );
  const categoryItems = (await categories.find({}).toArray()).map(cleanDocument);
  res.json(ok(withCategory(updatedProduct, buildCategoryMap(categoryItems)), "Cap nhat san pham thanh cong"));
});

productsRouter.delete("/:id", requireAdmin, async (req, res) => {
  const products = await getCollection("products");
  await products.deleteOne({ id: req.params.id });
  res.json(ok(null, "Xoa san pham thanh cong"));
});
