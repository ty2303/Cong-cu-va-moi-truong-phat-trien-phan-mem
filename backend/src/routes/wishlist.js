import express from "express";
import { db, withCategory } from "../data/store.js";
import { ok } from "../lib/apiResponse.js";
import { requireAuth } from "../middleware/auth.js";

export const wishlistRouter = express.Router();

wishlistRouter.use(requireAuth);

wishlistRouter.get("/", (req, res) => {
  const ids = db.wishlists[req.user.id] ?? [];
  const items = db.products.filter((product) => ids.includes(product.id)).map(withCategory);
  res.json(ok(items));
});

wishlistRouter.post("/:productId", (req, res) => {
  const ids = new Set(db.wishlists[req.user.id] ?? []);
  if (ids.has(req.params.productId)) {
    ids.delete(req.params.productId);
  } else {
    ids.add(req.params.productId);
  }
  db.wishlists[req.user.id] = [...ids];
  const items = db.products
    .filter((product) => db.wishlists[req.user.id].includes(product.id))
    .map(withCategory);
  res.json(ok(items));
});

wishlistRouter.delete("/", (req, res) => {
  db.wishlists[req.user.id] = [];
  res.json(ok(null, "Da xoa wishlist"));
});
