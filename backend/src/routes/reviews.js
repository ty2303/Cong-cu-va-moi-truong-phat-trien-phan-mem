import crypto from "node:crypto";
import express from "express";
import { cleanDocument, getCollection } from "../data/store.js";
import { ok } from "../lib/apiResponse.js";
import { requireAuth } from "../middleware/auth.js";

export const reviewsRouter = express.Router();

reviewsRouter.get("/", async (req, res) => {
  const productId = String(req.query.productId ?? "");
  const reviews = await getCollection("reviews");
  const query = productId ? { productId } : {};
  const items = (await reviews.find(query).sort({ createdAt: -1 }).toArray()).map(cleanDocument);
  res.json(ok(items));
});

reviewsRouter.post("/", requireAuth, async (req, res) => {
  const review = {
    id: crypto.randomUUID(),
    productId: req.body.productId,
    userId: req.user.id,
    username: req.user.username,
    rating: req.body.rating,
    comment: req.body.comment,
    images: req.body.images ?? [],
    createdAt: new Date().toISOString()
  };
  const reviews = await getCollection("reviews");
  await reviews.insertOne(review);
  res.status(201).json(ok(review, "Them danh gia thanh cong", 201));
});

reviewsRouter.delete("/:id", requireAuth, async (req, res) => {
  const reviews = await getCollection("reviews");
  await reviews.deleteOne({ id: req.params.id });
  res.json(ok(null, "Xoa danh gia thanh cong"));
});

reviewsRouter.post("/upload-image", requireAuth, (_req, res) => {
  const imageUrl = `https://picsum.photos/seed/${Date.now()}/600/600`;
  res.json(ok(imageUrl, "Upload anh thanh cong"));
});
