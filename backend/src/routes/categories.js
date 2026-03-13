import express from "express";
import { db } from "../data/store.js";
import { ok } from "../lib/apiResponse.js";
import { requireAdmin } from "../middleware/auth.js";

export const categoriesRouter = express.Router();

function enrich(category) {
  return {
    ...category,
    productCount: db.products.filter((item) => item.categoryId === category.id).length
  };
}

categoriesRouter.get("/", (_req, res) => {
  res.json(ok(db.categories.map(enrich)));
});

categoriesRouter.post("/", requireAdmin, (req, res) => {
  const category = {
    id: `cat-${Date.now()}`,
    name: req.body.name,
    slug: String(req.body.name || "").toLowerCase().replace(/\s+/g, "-"),
    description: req.body.description ?? "",
    icon: req.body.icon ?? "Smartphone",
    createdAt: new Date().toISOString()
  };
  db.categories.push(category);
  res.status(201).json(ok(enrich(category), "Tao danh muc thanh cong", 201));
});

categoriesRouter.put("/:id", requireAdmin, (req, res) => {
  const category = db.categories.find((item) => item.id === req.params.id);
  Object.assign(category, req.body);
  res.json(ok(enrich(category)));
});

categoriesRouter.delete("/:id", requireAdmin, (req, res) => {
  const index = db.categories.findIndex((item) => item.id === req.params.id);
  if (index >= 0) {
    db.categories.splice(index, 1);
  }
  res.json(ok(null, "Xoa danh muc thanh cong"));
});
