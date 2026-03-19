import crypto from "node:crypto";
import express from "express";
import { isDatabaseReady } from "../data/mongodb.js";
import { db } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { serializeReview } from "../lib/catalogSerializers.js";
import { Product } from "../models/Product.js";
import { Review } from "../models/Review.js";
import { requireAuth } from "../middleware/auth.js";

export const reviewsRouter = express.Router();

reviewsRouter.get("/", async (req, res) => {
  const productId = String(req.query.productId ?? "").trim();

  if (!isDatabaseReady()) {
    const items = (productId
      ? db.reviews.filter((review) => review.productId === productId)
      : db.reviews
    )
      .slice()
      .sort((first, second) => {
        return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      })
      .map((review) => serializeReview({ _id: review.id, ...review }));

    return res.json(ok(items));
  }

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

  if (!isDatabaseReady()) {
    const product = db.products.find((item) => item.id === productId);
    if (!product) {
      return res.status(404).json(fail("Khong tim thay san pham", 404));
    }

    const existed = db.reviews.find(
      (review) => review.productId === productId && review.userId === req.user.id
    );
    if (existed) {
      return res.status(409).json(fail("Ban da danh gia san pham nay", 409));
    }

    const review = {
      id: crypto.randomUUID(),
      productId,
      userId: req.user.id,
      username: req.user.username,
      rating,
      comment,
      images: Array.isArray(req.body.images) ? req.body.images.filter(Boolean) : [],
      createdAt: new Date().toISOString()
    };
    db.reviews.unshift(review);
    syncMemoryProductRating(productId);
    return res
      .status(201)
      .json(ok(serializeReview({ _id: review.id, ...review }), "Them danh gia thanh cong", 201));
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
  if (!isDatabaseReady()) {
    const index = db.reviews.findIndex((review) => review.id === req.params.id);
    if (index === -1) {
      return res.status(404).json(fail("Khong tim thay danh gia", 404));
    }

    const review = db.reviews[index];
    if (review.userId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json(fail("Forbidden", 403));
    }

    db.reviews.splice(index, 1);
    syncMemoryProductRating(review.productId);
    return res.json(ok(null, "Xoa danh gia thanh cong"));
  }

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

function syncMemoryProductRating(productId) {
  const product = db.products.find((item) => item.id === productId);
  if (!product) {
    return;
  }

  const relatedReviews = db.reviews.filter((review) => review.productId === productId);
  const nextRating =
    relatedReviews.length > 0
      ? Number(
          (
            relatedReviews.reduce((sum, review) => sum + review.rating, 0) / relatedReviews.length
          ).toFixed(1)
        )
      : 0;

  product.rating = nextRating;
  product.updatedAt = new Date().toISOString();
}
