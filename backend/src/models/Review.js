import mongoose from "mongoose";

const analysisResultSchema = new mongoose.Schema(
  {
    aspect: {
      type: String,
      required: true,
      trim: true
    },
    sentiment: {
      type: String,
      required: true,
      enum: ["positive", "negative", "neutral"]
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    }
  },
  {
    _id: false
  }
);

const reviewSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },
    productId: {
      type: String,
      ref: "Product",
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      trim: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length <= 5;
        },
        message: "Review chi duoc toi da 5 anh"
      }
    },
    analysisResults: {
      type: [analysisResultSchema],
      default: []
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

export const Review = mongoose.model("Review", reviewSchema);
