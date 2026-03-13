import express from "express";
import { db, issueToken, sanitizeUser } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";

export const authRouter = express.Router();

authRouter.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(
    (item) => item.username === username && item.password === password
  );

  if (!user) {
    return res.status(401).json(fail("Sai ten dang nhap hoac mat khau", 401));
  }

  const token = issueToken(user.id);
  return res.json(ok({ token, ...sanitizeUser(user) }, "Dang nhap thanh cong"));
});

authRouter.post("/register", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json(fail("Thieu thong tin dang ky", 400));
  }

  const exists = db.users.some(
    (user) => user.username === username || user.email === email
  );
  if (exists) {
    return res.status(409).json(fail("Tai khoan da ton tai", 409));
  }

  const user = {
    id: `user-${db.users.length + 1}`,
    username,
    email,
    password,
    role: "USER",
    hasPassword: true,
    authProvider: "LOCAL",
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  const token = issueToken(user.id);
  return res.status(201).json(ok({ token, ...sanitizeUser(user) }, "Dang ky thanh cong", 201));
});

authRouter.post("/forgot-password", (_req, res) => {
  res.json(ok(null, "Neu email ton tai, huong dan dat lai mat khau da duoc gui"));
});

authRouter.post("/reset-password", (_req, res) => {
  res.json(ok(null, "Dat lai mat khau thanh cong"));
});
