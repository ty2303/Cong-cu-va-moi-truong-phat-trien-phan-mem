import express from "express";
import { db, paginate, sanitizeUser } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const usersRouter = express.Router();

usersRouter.get("/", requireAdmin, (req, res) => {
  const page = Number(req.query.page ?? 0);
  const size = Number(req.query.size ?? 10);
  const users = db.users.map((user) => sanitizeUser(user));
  res.json(ok(paginate(users, page, size)));
});

usersRouter.get("/me", requireAuth, (req, res) => {
  const user = db.users.find((item) => item.id === req.user.id);
  res.json(ok(sanitizeUser(user)));
});

usersRouter.put("/me/password", requireAuth, (req, res) => {
  const user = db.users.find((item) => item.id === req.user.id);
  if (user.password !== req.body.currentPassword) {
    return res.status(400).json(fail("Mat khau hien tai khong dung", 400));
  }
  user.password = req.body.newPassword;
  user.hasPassword = true;
  user.authProvider = user.authProvider === "GOOGLE" ? "GOOGLE_AND_LOCAL" : user.authProvider;
  res.json(ok(null, "Doi mat khau thanh cong"));
});

usersRouter.post("/me/setup-password", requireAuth, (req, res) => {
  const user = db.users.find((item) => item.id === req.user.id);
  user.password = req.body.newPassword;
  user.hasPassword = true;
  user.authProvider = user.authProvider === "GOOGLE" ? "GOOGLE_AND_LOCAL" : "LOCAL";
  res.json(ok(null, "Thiet lap mat khau thanh cong"));
});

usersRouter.patch("/:id/role", requireAdmin, (req, res) => {
  const user = db.users.find((item) => item.id === req.params.id);
  if (!user) {
    return res.status(404).json(fail("Khong tim thay nguoi dung", 404));
  }
  user.role = req.query.role ?? req.body.role ?? user.role;
  res.json(ok(sanitizeUser(user), "Cap nhat vai tro thanh cong"));
});
