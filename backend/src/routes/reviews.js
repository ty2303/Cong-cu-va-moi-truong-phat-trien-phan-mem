import crypto from "node:crypto";
import express from "express";
import { db } from "../data/store.js";
import { ok } from "../lib/apiResponse.js";
import { requireAuth } from "../middleware/auth.js";

export const reviewsRouter = express.Router();

reviewsRouter.get("/", (req, res) => {
  const productId = String(req.query.productId ?? "");
  const items = productId
    ? db.reviews.filter((review) => review.productId === productId)
    : db.reviews;
  res.json(ok(items));
});

reviewsRouter.post("/", requireAuth, (req, res) => {
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
  db.reviews.unshift(review);
  res.status(201).json(ok(review, "Them danh gia thanh cong", 201));
});

reviewsRouter.delete("/:id", requireAuth, (req, res) => {
  const index = db.reviews.findIndex((review) => review.id === req.params.id);
  if (index >= 0) {
    db.reviews.splice(index, 1);
  }
  res.json(ok(null, "Xoa danh gia thanh cong"));
});

reviewsRouter.post("/upload-image", requireAuth, (_req, res) => {
  const imageUrl = `https://picsum.photos/seed/${Date.now()}/600/600`;
  res.json(ok(imageUrl, "Upload anh thanh cong"));
});
