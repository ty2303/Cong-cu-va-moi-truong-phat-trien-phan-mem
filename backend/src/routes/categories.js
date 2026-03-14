import express from "express";
import { cleanDocument, getCollection } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { requireAdmin } from "../middleware/auth.js";

export const categoriesRouter = express.Router();

function enrich(category, products) {
  return {
    ...category,
    productCount: products.filter((item) => item.categoryId === category.id).length
  };
}

categoriesRouter.get("/", async (_req, res) => {
  const categories = await getCollection("categories");
  const products = await getCollection("products");
  const categoryItems = (await categories.find({}).toArray()).map(cleanDocument);
  const productItems = (await products.find({}).toArray()).map(cleanDocument);
  res.json(ok(categoryItems.map((category) => enrich(category, productItems))));
});

categoriesRouter.post("/", requireAdmin, async (req, res) => {
  const category = {
    id: `cat-${Date.now()}`,
    name: req.body.name,
    slug: String(req.body.name || "").toLowerCase().replace(/\s+/g, "-"),
    description: req.body.description ?? "",
    icon: req.body.icon ?? "Smartphone",
    createdAt: new Date().toISOString()
  };
  const categories = await getCollection("categories");
  await categories.insertOne(category);
  res.status(201).json(ok(enrich(category, []), "Tao danh muc thanh cong", 201));
});

categoriesRouter.put("/:id", requireAdmin, async (req, res) => {
  const categories = await getCollection("categories");
  const products = await getCollection("products");
  const current = cleanDocument(await categories.findOne({ id: req.params.id }));
  if (!current) {
    return res.status(404).json(fail("Khong tim thay danh muc", 404));
  }
  const category = { ...current, ...req.body };
  await categories.updateOne({ id: req.params.id }, { $set: req.body });
  const productItems = (await products.find({}).toArray()).map(cleanDocument);
  res.json(ok(enrich(category, productItems)));
});

categoriesRouter.delete("/:id", requireAdmin, async (req, res) => {
  const categories = await getCollection("categories");
  await categories.deleteOne({ id: req.params.id });
  res.json(ok(null, "Xoa danh muc thanh cong"));
});
