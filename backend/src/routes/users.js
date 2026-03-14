import express from "express";
import {
  cleanDocument,
  getCollection,
  paginate,
  sanitizeUser
} from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const usersRouter = express.Router();

usersRouter.get("/", requireAdmin, async (req, res) => {
  const page = Number(req.query.page ?? 0);
  const size = Number(req.query.size ?? 10);
  const usersCollection = await getCollection("users");
  const users = (await usersCollection.find({}).toArray()).map((user) =>
    sanitizeUser(cleanDocument(user))
  );
  res.json(ok(paginate(users, page, size)));
});

usersRouter.get("/me", requireAuth, async (req, res) => {
  const users = await getCollection("users");
  const user = cleanDocument(await users.findOne({ id: req.user.id }));
  if (!user) {
    return res.status(404).json(fail("Khong tim thay nguoi dung", 404));
  }
  res.json(ok(sanitizeUser(user)));
});

usersRouter.put("/me/password", requireAuth, async (req, res) => {
  const users = await getCollection("users");
  const user = cleanDocument(await users.findOne({ id: req.user.id }));
  if (!user) {
    return res.status(404).json(fail("Khong tim thay nguoi dung", 404));
  }
  if (user.password !== req.body.currentPassword) {
    return res.status(400).json(fail("Mat khau hien tai khong dung", 400));
  }
  await users.updateOne(
    { id: req.user.id },
    {
      $set: {
        password: req.body.newPassword,
        hasPassword: true,
        authProvider:
          user.authProvider === "GOOGLE" ? "GOOGLE_AND_LOCAL" : user.authProvider
      }
    }
  );
  res.json(ok(null, "Doi mat khau thanh cong"));
});

usersRouter.post("/me/setup-password", requireAuth, async (req, res) => {
  const users = await getCollection("users");
  const user = cleanDocument(await users.findOne({ id: req.user.id }));
  if (!user) {
    return res.status(404).json(fail("Khong tim thay nguoi dung", 404));
  }
  await users.updateOne(
    { id: req.user.id },
    {
      $set: {
        password: req.body.newPassword,
        hasPassword: true,
        authProvider: user.authProvider === "GOOGLE" ? "GOOGLE_AND_LOCAL" : "LOCAL"
      }
    }
  );
  res.json(ok(null, "Thiet lap mat khau thanh cong"));
});

usersRouter.patch("/:id/role", requireAdmin, async (req, res) => {
  const users = await getCollection("users");
  const current = cleanDocument(await users.findOne({ id: req.params.id }));
  const nextRole = req.query.role ?? req.body.role ?? current?.role;
  const user = current ? { ...current, role: nextRole } : null;
  if (!user) {
    return res.status(404).json(fail("Khong tim thay nguoi dung", 404));
  }
  await users.updateOne({ id: req.params.id }, { $set: { role: nextRole } });
  res.json(ok(sanitizeUser(user), "Cap nhat vai tro thanh cong"));
});
