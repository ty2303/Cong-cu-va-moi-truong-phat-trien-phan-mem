import crypto from "node:crypto";
import express from "express";
import { db, paginate, withCategory } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { requireAdmin } from "../middleware/auth.js";

export const productsRouter = express.Router();

productsRouter.get("/", (req, res) => {
  const page = Number(req.query.page ?? 0);
  const size = Number(req.query.size ?? 12);
  const search = String(req.query.search ?? "").toLowerCase();
  const categoryId = String(req.query.categoryId ?? "");

  const items = db.products
    .map(withCategory)
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

productsRouter.get("/:id", (req, res) => {
  const product = db.products.find((item) => item.id === req.params.id);
  if (!product) {
    return res.status(404).json(fail("Khong tim thay san pham", 404));
  }
  return res.json(ok(withCategory(product)));
});

productsRouter.post("/", requireAdmin, (req, res) => {
  const product = {
    id: `prod-${Date.now()}`,
    rating: 5,
    stock: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...req.body
  };
  db.products.unshift(product);
  res.status(201).json(ok(withCategory(product), "Tao san pham thanh cong", 201));
});

productsRouter.post("/batch", requireAdmin, (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  const created = items.map((item) => ({
    id: `prod-${crypto.randomUUID()}`,
    rating: 5,
    stock: item.stock ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...item
  }));
  db.products.push(...created);
  res.status(201).json(ok(created.map(withCategory), "Import san pham thanh cong", 201));
});

productsRouter.put("/:id", requireAdmin, (req, res) => {
  const product = db.products.find((item) => item.id === req.params.id);
  if (!product) {
    return res.status(404).json(fail("Khong tim thay san pham", 404));
  }
  Object.assign(product, req.body, { updatedAt: new Date().toISOString() });
  res.json(ok(withCategory(product), "Cap nhat san pham thanh cong"));
});

productsRouter.delete("/:id", requireAdmin, (req, res) => {
  const index = db.products.findIndex((item) => item.id === req.params.id);
  if (index >= 0) {
    db.products.splice(index, 1);
  }
  res.json(ok(null, "Xoa san pham thanh cong"));
});
