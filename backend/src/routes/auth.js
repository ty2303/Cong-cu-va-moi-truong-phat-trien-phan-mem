import express from "express";
import { User } from "../models/User.js";
import { issueToken, sanitizeUser } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";

export const authRouter = express.Router();

/**
 * POST /api/auth/login
 * Đăng nhập bằng username + password.
 * - Tìm user theo username trong MongoDB
 * - So sánh password bằng bcrypt (comparePassword)
 * - Trả về JWT token + thông tin user
 */
authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;

  console.log(`[AUTH] Login attempt for user: ${username}`);

  // Validate input
  if (!username || !password) {
    return res.status(400).json(fail("Vui lòng nhập tên đăng nhập và mật khẩu", 400));
  }

  try {
    // Tìm user theo username (không lọc theo password nữa)
    const user = await User.findOne({ username, authProvider: "LOCAL" });

    if (!user) {
      return res.status(401).json(fail("Sai tên đăng nhập hoặc mật khẩu", 401));
    }

    // So sánh password bằng bcrypt
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json(fail("Sai tên đăng nhập hoặc mật khẩu", 401));
    }

    // Tạo JWT token
    const token = issueToken(user._id.toString());

    console.log(`[AUTH] Login successful for user: ${username}`);
    return res.json(ok({ token, ...sanitizeUser(user) }, "Đăng nhập thành công"));
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json(fail("Lỗi server", 500));
  }
});

/**
 * POST /api/auth/register
 * Đăng ký tài khoản mới.
 * - Validate input (username, email, password)
 * - Kiểm tra trùng username/email
 * - Hash password tự động qua pre-save hook
 * - Trả về JWT token + thông tin user
 */
authRouter.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  console.log(`[AUTH] Register attempt for user: ${username}, email: ${email}`);

  // Validate input
  if (!username || !email || !password) {
    return res.status(400).json(fail("Vui lòng nhập đầy đủ thông tin đăng ký", 400));
  }

  if (password.length < 6) {
    return res.status(400).json(fail("Mật khẩu phải có ít nhất 6 ký tự", 400));
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json(fail("Email không hợp lệ", 400));
  }

  try {
    // Kiểm tra username hoặc email đã tồn tại
    const exists = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (exists) {
      const field = exists.username === username ? "Tên đăng nhập" : "Email";
      return res.status(409).json(fail(`${field} đã được sử dụng`, 409));
    }

    // Tạo user mới (password sẽ tự hash qua pre-save hook)
    const user = await User.create({
      username,
      email,
      password,
      role: "USER",
      hasPassword: true,
      authProvider: "LOCAL"
    });

    // Tạo JWT token
    const token = issueToken(user._id.toString());

    console.log(`[AUTH] Register successful for user: ${username}`);
    return res.status(201).json(ok({ token, ...sanitizeUser(user) }, "Đăng ký thành công", 201));
  } catch (error) {
    console.error("Register error:", error);

    // Xử lý lỗi duplicate key từ MongoDB
    if (error.code === 11000) {
      return res.status(409).json(fail("Tài khoản đã tồn tại", 409));
    }

    return res.status(500).json(fail("Lỗi server", 500));
  }
});

/**
 * POST /api/auth/forgot-password
 * Gửi email đặt lại mật khẩu (placeholder).
 */
authRouter.post("/forgot-password", (_req, res) => {
  res.json(ok(null, "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi"));
});

/**
 * POST /api/auth/reset-password
 * Đặt lại mật khẩu (placeholder).
 */
authRouter.post("/reset-password", (_req, res) => {
  res.json(ok(null, "Đặt lại mật khẩu thành công"));
});
