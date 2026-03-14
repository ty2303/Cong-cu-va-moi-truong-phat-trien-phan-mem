import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["USER", "ADMIN"],
    default: "USER"
  },
  hasPassword: {
    type: Boolean,
    default: true
  },
  authProvider: {
    type: String,
    enum: ["LOCAL", "GOOGLE"],
    default: "LOCAL"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const User = mongoose.model("User", userSchema);
