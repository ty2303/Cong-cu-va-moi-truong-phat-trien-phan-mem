import express from "express";
import { ok } from "../lib/apiResponse.js";

export const momoRouter = express.Router();

momoRouter.post("/create", (req, res) => {
  const orderId = String(req.query.orderId ?? "");
  res.json(
    ok(
      {
        payUrl: `https://test-payment.momo.vn/pay?orderId=${orderId || "demo"}`
      },
      "Tao lien ket thanh toan thanh cong"
    )
  );
});
