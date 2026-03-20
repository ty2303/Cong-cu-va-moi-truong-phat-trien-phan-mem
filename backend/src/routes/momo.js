import crypto from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import { fail, ok } from "../lib/apiResponse.js";
import { requireAuth } from "../middleware/auth.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";

export const momoRouter = express.Router();

// ─── MoMo config (sandbox defaults, override via env vars) ───────────────────
const MOMO = {
  partnerCode: process.env.MOMO_PARTNER_CODE ?? "MOMOBKUN20180529",
  accessKey:   process.env.MOMO_ACCESS_KEY   ?? "klm05TvNBzhg7h7j",
  secretKey:   process.env.MOMO_SECRET_KEY   ?? "at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa",
  apiUrl:      process.env.MOMO_API_URL      ?? "https://test-payment.momo.vn/v2/gateway/api/create",
  ipnUrl:      process.env.MOMO_IPN_URL      ?? "http://localhost:8080/api/momo/ipn",
  redirectUrl: process.env.MOMO_REDIRECT_URL ?? "http://localhost:8080/api/momo/return",
  frontendUrl: process.env.FRONTEND_URL      ?? "http://localhost:5173",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sign(rawSignature) {
  return crypto
    .createHmac("sha256", MOMO.secretKey)
    .update(rawSignature)
    .digest("hex");
}

function buildVerifyRaw(p) {
  // MoMo KHÔNG gửi lại accessKey trong callback → phải dùng từ config
  const s = (key) => String(p[key] ?? "");
  return (
    `accessKey=${MOMO.accessKey}` +
    `&amount=${s("amount")}` +
    `&extraData=${s("extraData")}` +
    `&message=${s("message")}` +
    `&orderId=${s("orderId")}` +
    `&orderInfo=${s("orderInfo")}` +
    `&orderType=${s("orderType")}` +
    `&partnerCode=${s("partnerCode")}` +
    `&payType=${s("payType")}` +
    `&requestId=${s("requestId")}` +
    `&responseTime=${s("responseTime")}` +
    `&resultCode=${s("resultCode")}` +
    `&transId=${s("transId")}`
  );
}

// ─── Concurrency Control + Idempotency: Thanh toán thành công ────────────────
/**
 * Atomic update với điều kiện paymentStatus = "PENDING".
 *
 * Concurrency Control: MongoDB đảm bảo chỉ 1 trong nhiều request đồng thời
 *   thỏa điều kiện và được update. Các request còn lại nhận null → bỏ qua.
 *
 * Idempotency: Gọi nhiều lần (IPN retry, F5 return) → lần đầu update thành công,
 *   các lần sau nhận null → skip, không có side effect.
 *
 * @returns {boolean} true nếu đây là request đầu tiên xử lý, false nếu đã idempotent.
 */
async function markPaymentSuccess(orderId, transId) {
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: "PENDING" }, // ← điều kiện atomic (Concurrency Control)
    { paymentStatus: "PAID", momoTransId: transId },
    { new: false }
  );

  // null → điều kiện không khớp → đã được xử lý trước đó (Idempotency)
  return updated !== null;
}

// ─── Transaction + Concurrency Control + Idempotency: Thanh toán thất bại ───
/**
 * Chạy trong MongoDB Transaction để đảm bảo tính nguyên tử (all-or-nothing):
 *   1. Cập nhật Order → CANCELLED, paymentStatus → FAILED
 *   2. Hoàn kho cho từng item
 * Nếu bất kỳ bước nào lỗi → abortTransaction(), cả 2 thao tác bị rollback.
 *
 * Concurrency Control: atomic condition paymentStatus = "PENDING" đảm bảo
 *   chỉ 1 request (return hoặc IPN) thực sự xử lý, tránh restore stock 2 lần.
 *
 * Idempotency: Nếu order đã là FAILED/CANCELLED → findOneAndUpdate trả null
 *   → withTransaction không có side effect.
 *
 * @returns {boolean} true nếu đây là request đầu tiên xử lý.
 */
async function markPaymentFailed(orderId, reason) {
  const session = await mongoose.startSession();
  let processed = false;

  try {
    // withTransaction tự động retry khi gặp transient errors (write conflict, network)
    await session.withTransaction(async () => {
      // ── Bước 1: Atomic update Order (Concurrency Control) ──────────────────
      const order = await Order.findOneAndUpdate(
        { _id: orderId, paymentStatus: "PENDING" }, // điều kiện lock
        {
          paymentStatus: "FAILED",
          status:        "CANCELLED",
          cancelReason:  reason,
          cancelledBy:   "USER",
        },
        { new: false, session } // trả về doc cũ để lấy items
      );

      if (!order) {
        // Đã được xử lý bởi request khác (Idempotency) → skip
        processed = false;
        return;
      }

      // ── Bước 2: Hoàn kho trong cùng transaction (Transaction Management) ──
      await Promise.all(
        order.items.map((item) =>
          Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: item.quantity }, updatedAt: new Date() },
            { session }
          )
        )
      );

      processed = true;
      // Nếu bất kỳ Product.findByIdAndUpdate nào throw → withTransaction abortTransaction()
      // → Order update ở bước 1 cũng bị rollback (Transaction Management)
    });
  } finally {
    session.endSession();
  }

  return processed;
}

// ─── POST /api/momo/create ────────────────────────────────────────────────────
momoRouter.post("/create", requireAuth, async (req, res) => {
  try {
    const orderId = String(req.query.orderId ?? "").trim();
    if (!orderId) return res.status(400).json(fail("Thiếu orderId", 400));

    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json(fail("Không tìm thấy đơn hàng", 404));

    const callerId = String(req.user?._id ?? req.user?.id ?? "");
    if (order.userId !== callerId)
      return res.status(403).json(fail("Không có quyền truy cập", 403));

    if (order.paymentStatus === "PAID")
      return res.status(400).json(fail("Đơn hàng đã được thanh toán", 400));

    const requestId   = `${MOMO.partnerCode}_${Date.now()}`;
    const amount      = String(order.total);
    const orderInfo   = `Thanh toan don hang ${orderId}`;
    const extraData   = "";
    const requestType = "captureWallet";

    const rawSignature =
      `accessKey=${MOMO.accessKey}` +
      `&amount=${amount}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${MOMO.ipnUrl}` +
      `&orderId=${orderId}` +
      `&orderInfo=${orderInfo}` +
      `&partnerCode=${MOMO.partnerCode}` +
      `&redirectUrl=${MOMO.redirectUrl}` +
      `&requestId=${requestId}` +
      `&requestType=${requestType}`;

    const signature = sign(rawSignature);

    const body = {
      partnerCode: MOMO.partnerCode,
      accessKey:   MOMO.accessKey,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl: MOMO.redirectUrl,
      ipnUrl:      MOMO.ipnUrl,
      extraData,
      requestType,
      signature,
      lang: "vi",
    };

    const momoRes  = await fetch(MOMO.apiUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(30_000),
    });
    const momoData = await momoRes.json();

    if (momoData.resultCode !== 0) {
      console.error("[MoMo] create failed:", momoData);
      return res.status(400).json(fail(momoData.message ?? "Tạo liên kết thanh toán thất bại", 400));
    }

    return res.json(ok({ payUrl: momoData.payUrl }, "Tạo liên kết thanh toán thành công"));
  } catch (err) {
    console.error("[MoMo] create error:", err);
    return res.status(500).json(fail("Lỗi hệ thống khi tạo liên kết MoMo", 500));
  }
});

// ─── GET /api/momo/return ─────────────────────────────────────────────────────
// MoMo redirect trình duyệt về đây sau khi user thanh toán xong.
momoRouter.get("/return", async (req, res) => {
  const p           = req.query;
  const orderId     = String(p.orderId ?? "");
  const resultCode  = String(p.resultCode ?? "-1");
  const transId     = String(p.transId ?? "");
  const signature   = String(p.signature ?? "");
  const frontendUrl = MOMO.frontendUrl;

  const redirectFail = `${frontendUrl}/checkout/result?success=false&orderId=${encodeURIComponent(orderId)}`;
  const redirectOk   = `${frontendUrl}/checkout/result?success=true&orderId=${encodeURIComponent(orderId)}`;

  try {
    // 1. Verify signature — từ chối mọi request không hợp lệ
    const rawToVerify  = buildVerifyRaw(p);
    const computedSig  = sign(rawToVerify);

    // ── DEBUG: xem backend nhận được gì từ MoMo ──────────────────────────
    console.log("[MoMo] return params:", JSON.stringify(p, null, 2));
    console.log("[MoMo] rawSignature  :", rawToVerify);
    console.log("[MoMo] computedSig   :", computedSig);
    console.log("[MoMo] receivedSig   :", signature);
    console.log("[MoMo] sigMatch      :", computedSig === signature);
    console.log("[MoMo] resultCode    :", resultCode);
    // ─────────────────────────────────────────────────────────────────────

    if (computedSig !== signature) {
      console.warn("[MoMo] return: invalid signature, orderId =", orderId);
      return res.redirect(redirectFail);
    }

    const success = resultCode === "0";

    // 2. Xử lý với đủ 3 kỹ thuật
    if (success) {
      // markPaymentSuccess: Concurrency Control + Idempotency
      const processed = await markPaymentSuccess(orderId, transId);
      if (!processed) {
        console.info("[MoMo] return: orderId=%s already processed (idempotent)", orderId);
      }
    } else {
      // markPaymentFailed: Transaction + Concurrency Control + Idempotency
      const processed = await markPaymentFailed(orderId, p.message ?? "Thanh toán MoMo thất bại");
      if (!processed) {
        console.info("[MoMo] return: orderId=%s already processed (idempotent)", orderId);
      }
    }

    return res.redirect(success ? redirectOk : redirectFail);
  } catch (err) {
    console.error("[MoMo] return error:", err);
    return res.redirect(redirectFail);
  }
});

// ─── POST /api/momo/ipn ───────────────────────────────────────────────────────
// MoMo server gọi đây để xác nhận thanh toán (server-to-server, có thể retry nhiều lần).
momoRouter.post("/ipn", async (req, res) => {
  const p          = req.body ?? {};
  const orderId    = String(p.orderId ?? "");
  const resultCode = Number(p.resultCode ?? -1);
  const transId    = String(p.transId ?? "");
  const signature  = String(p.signature ?? "");

  try {
    // 1. Verify signature
    const computedSig = sign(buildVerifyRaw(p));
    if (computedSig !== signature) {
      console.warn("[MoMo] IPN: invalid signature, orderId =", orderId);
      return res.status(400).json({ resultCode: -1, message: "Invalid signature" });
    }

    const success = resultCode === 0;

    // 2. Xử lý với đủ 3 kỹ thuật
    if (success) {
      // Concurrency Control + Idempotency (success chỉ update 1 document → không cần transaction)
      const processed = await markPaymentSuccess(orderId, transId);
      if (!processed) {
        console.info("[MoMo] IPN: orderId=%s already processed (idempotent)", orderId);
      }
    } else {
      // Transaction + Concurrency Control + Idempotency
      const processed = await markPaymentFailed(orderId, p.message ?? "Thanh toán MoMo thất bại");
      if (!processed) {
        console.info("[MoMo] IPN: orderId=%s already processed (idempotent)", orderId);
      }
    }

    // Luôn trả resultCode=0 nếu signature hợp lệ — Idempotent response cho MoMo retry
    return res.json({ resultCode: 0, message: "Success" });
  } catch (err) {
    console.error("[MoMo] IPN error:", err);
    return res.status(500).json({ resultCode: -1, message: "Server error" });
  }
});
