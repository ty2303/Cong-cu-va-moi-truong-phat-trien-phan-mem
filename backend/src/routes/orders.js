import express from "express";
import { createOrder, db, paginate } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { sendToUser } from "../lib/realtime.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const ordersRouter = express.Router();

const VALID_ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SHIPPING",
  "DELIVERED",
  "CANCELLED",
];

const VALID_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const CANCELLABLE_STATUSES = ["PENDING", "CONFIRMED"];

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

  const nextStatus = req.query.status ?? req.body.status;

  if (!VALID_ORDER_STATUSES.includes(nextStatus)) {
    return res.status(400).json(fail("Trang thai don hang khong hop le", 400));
  }

  if (!VALID_TRANSITIONS[order.status]?.includes(nextStatus)) {
    return res
      .status(400)
      .json(fail("Khong the cap nhat trang thai don hang theo luong nay", 400));
  }

  order.status = nextStatus;
  sendToUser(order.userId, "/user/queue/order-status", {
    orderId: order.id,
    newStatus: order.status
  });
  res.json(ok(order, "Cap nhat trang thai thanh cong"));
});

ordersRouter.patch("/:id/cancel", requireAuth, (req, res) => {
  const order = db.orders.find((item) => item.id === req.params.id);
  if (!order) {
    return res.status(404).json(fail("Khong tim thay don hang", 404));
  }

  if (req.user.role !== "ADMIN" && order.userId !== req.user.id) {
    return res.status(403).json(fail("Forbidden", 403));
  }

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return res
      .status(400)
      .json(fail("Khong the huy don hang o trang thai nay", 400));
  }

  order.status = "CANCELLED";
  order.cancelReason = String(req.query.reason ?? "Khac");
  order.cancelledBy = req.user.role === "ADMIN" ? "ADMIN" : "USER";
  order.paymentStatus = "FAILED";
  res.json(ok(order, "Huy don hang thanh cong"));
});
