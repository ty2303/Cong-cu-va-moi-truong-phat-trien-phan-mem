import crypto from "node:crypto";
import express from "express";
import { User } from "../models/User.js";
import { issueToken, sanitizeUser, db } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";

export const authRouter = express.Router();

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;
  
  console.log(`[AUTH] Login attempt for user: ${username}`);
  
  if (!username || !password) {
    return res.status(400).json(fail("Thieu thong tin dang nhap", 400));
  }

  try {
    const user = await User.findOne({ username, password, authProvider: "LOCAL" });

    if (!user) {
      return res.status(401).json(fail("Sai ten dang nhap hoac mat khau", 401));
    }

    const token = issueToken(user._id.toString());
    console.log(`[AUTH] Login successful for user: ${username}`);
    return res.json(ok({ token, ...sanitizeUser(user) }, "Dang nhap thanh cong"));
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json(fail("Loi server", 500));
  }
});

authRouter.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  
  console.log(`[AUTH] Register attempt for user: ${username}, email: ${email}`);
  
  if (!username || !email || !password) {
    return res.status(400).json(fail("Thieu thong tin dang ky", 400));
  }

  try {
    const exists = await User.findOne({
      $or: [{ username }, { email }]
    });
    
    if (exists) {
      return res.status(409).json(fail("Tai khoan da ton tai", 409));
    }

    const user = await User.create({
      username,
      email,
      password,
      role: "USER",
      hasPassword: true,
      authProvider: "LOCAL"
    });

    const token = issueToken(user._id.toString());
    console.log(`[AUTH] Register successful for user: ${username}`);
    return res.status(201).json(ok({ token, ...sanitizeUser(user) }, "Dang ky thanh cong", 201));
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json(fail("Loi server", 500));
  }
});

authRouter.post("/forgot-password", (_req, res) => {
  res.json(ok(null, "Neu email ton tai, huong dan dat lai mat khau da duoc gui"));
});

authRouter.post("/reset-password", (_req, res) => {
  res.json(ok(null, "Dat lai mat khau thanh cong"));
});
