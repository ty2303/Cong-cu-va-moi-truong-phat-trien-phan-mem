import express from "express";
import { createOrder, db, paginate } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const ordersRouter = express.Router();

ordersRouter.get("/", requireAdmin, (req, res) => {
  const page = Number(req.query.page ?? 0);
  const size = Number(req.query.size ?? 10);
  res.json(ok(paginate(db.orders, page, size)));
});

ordersRouter.get("/my", requireAuth, (req, res) => {
  const items = db.orders.filter((order) => order.userId === req.user.id);
  res.json(ok(items));
});

ordersRouter.post("/", requireAuth, (req, res) => {
  const order = createOrder(req.body, req.user);
  res.status(201).json(ok(order, "Dat hang thanh cong", 201));
});

ordersRouter.patch("/:id/status", requireAdmin, (req, res) => {
  const order = db.orders.find((item) => item.id === req.params.id);
  if (!order) {
    return res.status(404).json(fail("Khong tim thay don hang", 404));
  }
  order.status = req.query.status ?? req.body.status ?? order.status;
  res.json(ok(order, "Cap nhat trang thai thanh cong"));
});

ordersRouter.patch("/:id/cancel", requireAuth, (req, res) => {
  const order = db.orders.find((item) => item.id === req.params.id);
  if (!order) {
    return res.status(404).json(fail("Khong tim thay don hang", 404));
  }
  order.status = "CANCELLED";
  order.cancelReason = String(req.query.reason ?? "Khac");
  order.cancelledBy = req.user.role === "ADMIN" ? "ADMIN" : "USER";
  order.paymentStatus = "FAILED";
  res.json(ok(order, "Huy don hang thanh cong"));
});
