import express from "express";
import {
  cleanDocument,
  createOrderDocument,
  getCollection,
  paginate
} from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const ordersRouter = express.Router();

ordersRouter.get("/", requireAdmin, async (req, res) => {
  const page = Number(req.query.page ?? 0);
  const size = Number(req.query.size ?? 10);
  const orders = await getCollection("orders");
  const items = (await orders.find({}).sort({ createdAt: -1 }).toArray()).map(cleanDocument);
  res.json(ok(paginate(items, page, size)));
});

ordersRouter.get("/my", requireAuth, async (req, res) => {
  const orders = await getCollection("orders");
  const items = (await orders.find({ userId: req.user.id }).sort({ createdAt: -1 }).toArray()).map(cleanDocument);
  res.json(ok(items));
});

ordersRouter.post("/", async (req, res) => {
  const orders = await getCollection("orders");
  const order = createOrderDocument(req.body, req.user);
  await orders.insertOne(order);
  res.status(201).json(ok(order, "Dat hang thanh cong", 201));
});

ordersRouter.patch("/:id/status", requireAdmin, async (req, res) => {
  const orders = await getCollection("orders");
  const current = cleanDocument(await orders.findOne({ id: req.params.id }));
  const nextStatus = req.query.status ?? req.body.status ?? current?.status;
  const order = current ? { ...current, status: nextStatus } : null;
  if (!order) {
    return res.status(404).json(fail("Khong tim thay don hang", 404));
  }
  await orders.updateOne({ id: req.params.id }, { $set: { status: nextStatus } });
  res.json(ok(order, "Cap nhat trang thai thanh cong"));
});

ordersRouter.patch("/:id/cancel", requireAuth, async (req, res) => {
  const orders = await getCollection("orders");
  const current = cleanDocument(await orders.findOne({ id: req.params.id }));
  const order = current
    ? {
        ...current,
        status: "CANCELLED",
        cancelReason: String(req.query.reason ?? "Khac"),
        cancelledBy: req.user.role === "ADMIN" ? "ADMIN" : "USER",
        paymentStatus: "FAILED"
      }
    : null;
  if (!order) {
    return res.status(404).json(fail("Khong tim thay don hang", 404));
  }
  await orders.updateOne(
    { id: req.params.id },
    {
      $set: {
        status: order.status,
        cancelReason: order.cancelReason,
        cancelledBy: order.cancelledBy,
        paymentStatus: order.paymentStatus
      }
    }
  );
  res.json(ok(order, "Huy don hang thanh cong"));
});
