import express from "express";
import {
	addToCartItem,
	clearCart,
	getCart,
	removeCartItem,
	updateCartItem,
} from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";
import { requireAuth } from "../middleware/auth.js";

export const cartRouter = express.Router();

// All cart routes require authentication
cartRouter.use(requireAuth);

// GET /api/cart — get current user's cart
cartRouter.get("/", (req, res) => {
	const cart = getCart(req.user.id);
	res.json(ok(cart));
});

// POST /api/cart/items — add item to cart
cartRouter.post("/items", (req, res) => {
	const { productId, quantity = 1 } = req.body;

	if (!productId) {
		return res.status(400).json(fail("productId là bắt buộc", 400));
	}

	const qty = Number(quantity);
	if (!Number.isInteger(qty) || qty <= 0 || qty > 99) {
		return res.status(400).json(fail("Số lượng không hợp lệ", 400));
	}

	const result = addToCartItem(req.user.id, productId, qty);

	if (result.error) {
		return res.status(result.status).json(fail(result.error, result.status));
	}

	res.json(ok(result.cart, "Thêm vào giỏ hàng thành công"));
});

// PATCH /api/cart/items/:productId — update item quantity
cartRouter.patch("/items/:productId", (req, res) => {
	const { quantity } = req.body;

	const qty = Number(quantity);
	if (!Number.isInteger(qty) || qty <= 0 || qty > 99) {
		return res.status(400).json(fail("Số lượng không hợp lệ", 400));
	}

	const result = updateCartItem(req.user.id, req.params.productId, qty);

	if (result.error) {
		return res.status(result.status).json(fail(result.error, result.status));
	}

	res.json(ok(result.cart, "Cập nhật giỏ hàng thành công"));
});

// DELETE /api/cart/items/:productId — remove item from cart
cartRouter.delete("/items/:productId", (req, res) => {
	const result = removeCartItem(req.user.id, req.params.productId);
	res.json(ok(result.cart, "Xóa sản phẩm khỏi giỏ hàng"));
});

// DELETE /api/cart — clear cart
cartRouter.delete("/", (req, res) => {
	const result = clearCart(req.user.id);
	res.json(ok(result.cart, "Xóa giỏ hàng thành công"));
});
