import crypto from "node:crypto";
import express from "express";
import { fail, ok } from "../lib/apiResponse.js";
import { serializeReview } from "../lib/catalogSerializers.js";
import { Product } from "../models/Product.js";
import { Review } from "../models/Review.js";
import { requireAuth } from "../middleware/auth.js";

export const reviewsRouter = express.Router();

reviewsRouter.get("/", async (req, res) => {
  const productId = String(req.query.productId ?? "").trim();
  const filter = productId ? { productId } : {};
  const items = await Review.find(filter).sort({ createdAt: -1 }).lean();
  res.json(ok(items.map(serializeReview)));
});

reviewsRouter.post("/", requireAuth, async (req, res) => {
  const productId = String(req.body.productId ?? "").trim();
  const comment = String(req.body.comment ?? "").trim();
  const rating = Number(req.body.rating);

  if (!productId || !comment || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return res.status(400).json(fail("Danh gia khong hop le", 400));
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json(fail("Khong tim thay san pham", 404));
  }

  const existed = await Review.findOne({ productId, userId: req.user.id }).lean();
  if (existed) {
    return res.status(409).json(fail("Ban da danh gia san pham nay", 409));
  }

  const review = await Review.create({
    _id: crypto.randomUUID(),
    productId,
    userId: req.user.id,
    username: req.user.username,
    rating,
    comment,
    images: Array.isArray(req.body.images) ? req.body.images.filter(Boolean) : [],
    createdAt: new Date()
  });

  await syncProductRating(productId);

  res.status(201).json(ok(serializeReview(review.toObject()), "Them danh gia thanh cong", 201));
});

reviewsRouter.delete("/:id", requireAuth, async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return res.status(404).json(fail("Khong tim thay danh gia", 404));
  }

  if (review.userId !== req.user.id && req.user.role !== "ADMIN") {
    return res.status(403).json(fail("Forbidden", 403));
  }

  const productId = review.productId;
  await review.deleteOne();
  await syncProductRating(productId);

  res.json(ok(null, "Xoa danh gia thanh cong"));
});

reviewsRouter.post("/upload-image", requireAuth, (_req, res) => {
  res.status(410).json(
    fail("Tinh nang upload anh gia lap da duoc loai bo. Frontend se gui anh truc tiep trong review.", 410)
  );
});

async function syncProductRating(productId) {
  const stats = await Review.aggregate([
    { $match: { productId } },
    {
      $group: {
        _id: "$productId",
        avgRating: { $avg: "$rating" }
      }
    }
  ]);

  const nextRating = stats[0]?.avgRating ? Number(stats[0].avgRating.toFixed(1)) : 0;

  await Product.findByIdAndUpdate(productId, {
    rating: nextRating,
    updatedAt: new Date()
  });
}
