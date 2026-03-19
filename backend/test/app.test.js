import assert from "node:assert/strict";
import http from "node:http";
import { describe, test } from "node:test";
import { WebSocket } from "ws";
import { app } from "../src/app.js";
import { db } from "../src/data/store.js";
import { attachRealtimeServer } from "../src/lib/realtime.js";

async function withServer(run) {
	const server = http.createServer(app);
	attachRealtimeServer(server);
	server.listen(0);
	const { port } = server.address();

	try {
		await run(port);
	} finally {
		server.close();
	}
}

function buildFrame(command, headers = {}, body = "") {
	const lines = [command];
	for (const [key, value] of Object.entries(headers)) {
		lines.push(`${key}:${value}`);
	}
	return `${lines.join("\n")}\n\n${body}\0`;
}

function parseFrame(frameText) {
	const normalized = frameText.replace(/\r/g, "");
	const separatorIndex = normalized.indexOf("\n\n");
	const headerBlock = normalized.slice(0, separatorIndex);
	const body = normalized.slice(separatorIndex + 2);
	const [command, ...headerLines] = headerBlock.split("\n");
	const headers = {};

	for (const line of headerLines) {
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) {
			continue;
		}
		headers[line.slice(0, colonIndex)] = line.slice(colonIndex + 1);
	}

	return { command, headers, body };
}

function waitForFrame(ws) {
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			ws.off("message", onMessage);
			ws.off("error", onError);
			ws.off("close", onClose);
		};

		const onMessage = (data) => {
			const frames = data
				.toString()
				.split("\0")
				.filter((frame) => frame && frame.replace(/\r?\n/g, "").trim())
				.map(parseFrame);

			if (frames.length > 0) {
				cleanup();
				resolve(frames[0]);
			}
		};

		const onError = (error) => {
			cleanup();
			reject(error);
		};

		const onClose = () => {
			cleanup();
			reject(new Error("WebSocket closed before a frame was received"));
		};

		ws.on("message", onMessage);
		ws.on("error", onError);
		ws.on("close", onClose);
	});
}

async function connectAndSubscribe(port, token, destination) {
	const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

	await new Promise((resolve, reject) => {
		ws.once("open", resolve);
		ws.once("error", reject);
	});

	ws.send(
		buildFrame("CONNECT", {
			Authorization: `Bearer ${token}`,
			"accept-version": "1.2",
			"heart-beat": "0,0",
		}),
	);

	const connectedFrame = await waitForFrame(ws);
	assert.equal(connectedFrame.command, "CONNECTED");

	ws.send(
		buildFrame("SUBSCRIBE", {
			id: "sub-1",
			destination,
			receipt: "sub-1-ready",
		}),
	);

	const receiptFrame = await waitForFrame(ws);
	assert.equal(receiptFrame.command, "RECEIPT");
	assert.equal(receiptFrame.headers["receipt-id"], "sub-1-ready");

	return ws;
}

test("GET /health returns service status", async () => {
	await withServer(async (port) => {
		const response = await fetch(`http://127.0.0.1:${port}/health`);
		const body = await response.json();

		assert.equal(response.status, 200);
		assert.equal(body.status, 200);
		assert.equal(body.data.service, "backend");
	});
});

describe("Order pricing", () => {
	test("POST /api/orders calculates shipping fee and discount on the backend", async () => {
		await withServer(async (port) => {
			const response = await fetch(`http://127.0.0.1:${port}/api/orders`, {
				method: "POST",
				headers: {
					Authorization: "Bearer demo-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: "demo@example.com",
					customerName: "Demo User",
					phone: "0900000001",
					address: "123 Duong Nguyen Hue",
					city: "TP.HCM",
					district: "Quan 1",
					ward: "Ben Nghe",
					paymentMethod: "COD",
					discount: 50000,
					items: [
						{
							productId: "prod-iphone-15",
							productName: "iPhone 15 Pro",
							productImage: "",
							brand: "Apple",
							price: 100000,
							quantity: 1,
						},
					],
				}),
			});
			const body = await response.json();

			assert.equal(response.status, 201);
			assert.equal(body.data.subtotal, 100000);
			assert.equal(body.data.shippingFee, 30000);
			assert.equal(body.data.discount, 50000);
			assert.equal(body.data.total, 80000);
		});
	});

	test("POST /api/orders returns free shipping once subtotal reaches the frontend threshold", async () => {
		await withServer(async (port) => {
			const response = await fetch(`http://127.0.0.1:${port}/api/orders`, {
				method: "POST",
				headers: {
					Authorization: "Bearer demo-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: "demo@example.com",
					customerName: "Demo User",
					phone: "0900000001",
					address: "123 Duong Nguyen Hue",
					city: "TP.HCM",
					district: "Quan 1",
					ward: "Ben Nghe",
					paymentMethod: "COD",
					items: [
						{
							productId: "prod-iphone-15",
							productName: "iPhone 15 Pro",
							productImage: "",
							brand: "Apple",
							price: 500000,
							quantity: 1,
						},
					],
				}),
			});
			const body = await response.json();

			assert.equal(response.status, 201);
			assert.equal(body.data.subtotal, 500000);
			assert.equal(body.data.shippingFee, 0);
			assert.equal(body.data.discount, 0);
			assert.equal(body.data.total, 500000);
		});
	});

	test("GET /api/orders/:id lets the owner view order details", async () => {
		await withServer(async (port) => {
			const response = await fetch(
				`http://127.0.0.1:${port}/api/orders/order-1`,
				{
					headers: {
						Authorization: "Bearer demo-token",
					},
				},
			);
			const body = await response.json();

			assert.equal(response.status, 200);
			assert.equal(body.data.id, "order-1");
			assert.equal(body.data.paymentMethod, "COD");
		});
	});
});

test("admin middleware rejects unauthenticated requests", async () => {
	await withServer(async (port) => {
		const response = await fetch(`http://127.0.0.1:${port}/api/products`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: "Test product" }),
		});
		const body = await response.json();

		assert.equal(response.status, 401);
		assert.equal(body.status, 401);
		assert.equal(body.message, "Unauthorized");
	});
});

test("admin middleware rejects non-admin users", async () => {
	await withServer(async (port) => {
		const response = await fetch(`http://127.0.0.1:${port}/api/products`, {
			method: "POST",
			headers: {
				Authorization: "Bearer demo-token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: "Test product" }),
		});
		const body = await response.json();

		assert.equal(response.status, 403);
		assert.equal(body.status, 403);
		assert.equal(body.message, "Forbidden");
	});
});

test("admin middleware allows admin users", async () => {
	await withServer(async (port) => {
		const response = await fetch(`http://127.0.0.1:${port}/api/products`, {
			method: "POST",
			headers: {
				Authorization: "Bearer admin-token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: "Test product",
				brand: "Test brand",
				categoryId: "cat-iphone",
				price: 1000,
				originalPrice: 1200,
				image: "https://example.com/test.jpg",
				specs: "Test specs",
			}),
		});
		const body = await response.json();

		assert.equal(response.status, 201);
		assert.equal(body.status, 201);
		assert.equal(body.message, "Tao san pham thanh cong");
		assert.equal(body.data.name, "Test product");
	});
});

test("realtime sends order status updates to the order owner", async () => {
	await withServer(async (port) => {
		const ws = await connectAndSubscribe(
			port,
			"demo-token",
			"/user/queue/order-status",
		);

		try {
			const responsePromise = fetch(
				`http://127.0.0.1:${port}/api/orders/order-1/status`,
				{
					method: "PATCH",
					headers: {
						Authorization: "Bearer admin-token",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ status: "SHIPPING" }),
				},
			);

			const framePromise = waitForFrame(ws);
			const [response, frame] = await Promise.all([
				responsePromise,
				framePromise,
			]);
			const body = await response.json();
			const payload = JSON.parse(frame.body);

			assert.equal(response.status, 200);
			assert.equal(body.data.status, "SHIPPING");
			assert.equal(frame.command, "MESSAGE");
			assert.equal(frame.headers.destination, "/user/queue/order-status");
			assert.deepEqual(payload, {
				orderId: "order-1",
				newStatus: "SHIPPING",
			});
		} finally {
			db.orders[0].status = "DELIVERED";
			ws.close();
		}
	});
});

test("realtime sends role updates to the affected user", async () => {
	await withServer(async (port) => {
		const ws = await connectAndSubscribe(
			port,
			"demo-token",
			"/user/queue/role-change",
		);

		try {
			const responsePromise = fetch(
				`http://127.0.0.1:${port}/api/users/user-1/role`,
				{
					method: "PATCH",
					headers: {
						Authorization: "Bearer admin-token",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ role: "ADMIN" }),
				},
			);

			const framePromise = waitForFrame(ws);
			const [response, frame] = await Promise.all([
				responsePromise,
				framePromise,
			]);
			const body = await response.json();
			const payload = JSON.parse(frame.body);

			assert.equal(response.status, 200);
			assert.equal(body.data.role, "ADMIN");
			assert.equal(frame.command, "MESSAGE");
			assert.equal(frame.headers.destination, "/user/queue/role-change");
			assert.deepEqual(payload, {
				userId: "user-1",
				newRole: "ADMIN",
			});
		} finally {
			db.users[0].role = "USER";
			ws.close();
		}
	});
});

// ─── Cart ────────────────────────────────────────────────────────
describe("Cart API", () => {
	test("GET /api/cart without auth returns 401", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/cart`);
			assert.strictEqual(res.status, 401);
		});
	});

	test("POST /api/cart/items adds product to cart", async () => {
		await withServer(async (port) => {
			const headers = {
				"Content-Type": "application/json",
				Authorization: "Bearer demo-token",
			};
			// Clear first
			await fetch(`http://127.0.0.1:${port}/api/cart`, {
				method: "DELETE",
				headers,
			});

			const res = await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers,
				body: JSON.stringify({ productId: "prod-iphone-15", quantity: 1 }),
			});
			assert.strictEqual(res.status, 200);
			const body = await res.json();
			assert.strictEqual(body.data.items.length, 1);
			assert.strictEqual(body.data.items[0].productId, "prod-iphone-15");
			assert.strictEqual(body.data.items[0].quantity, 1);
		});
	});

	test("POST /api/cart/items increments quantity for existing item", async () => {
		await withServer(async (port) => {
			const headers = {
				"Content-Type": "application/json",
				Authorization: "Bearer demo-token",
			};
			// Clear first
			await fetch(`http://127.0.0.1:${port}/api/cart`, {
				method: "DELETE",
				headers,
			});

			// Add first
			await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers,
				body: JSON.stringify({ productId: "prod-iphone-15", quantity: 1 }),
			});
			// Add again
			const res = await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers,
				body: JSON.stringify({ productId: "prod-iphone-15", quantity: 2 }),
			});
			const body = await res.json();
			assert.strictEqual(body.data.items[0].quantity, 3);
		});
	});

	test("POST /api/cart/items rejects when exceeding stock", async () => {
		await withServer(async (port) => {
			const headers = {
				"Content-Type": "application/json",
				Authorization: "Bearer demo-token",
			};
			// Clear first
			await fetch(`http://127.0.0.1:${port}/api/cart`, {
				method: "DELETE",
				headers,
			});

			const res = await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers,
				body: JSON.stringify({ productId: "prod-iphone-15", quantity: 50 }),
			});
			assert.strictEqual(res.status, 409);
		});
	});

	test("POST /api/cart/items rejects out-of-stock product", async () => {
		await withServer(async (port) => {
			const headers = {
				"Content-Type": "application/json",
				Authorization: "Bearer demo-token",
			};
			const res = await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers,
				body: JSON.stringify({ productId: "prod-out-of-stock", quantity: 1 }),
			});
			assert.strictEqual(res.status, 409);
			const body = await res.json();
			assert.ok(
				body.message.includes("hết hàng") || body.message.includes("het hang"),
			);
		});
	});

	test("POST /api/cart/items rejects invalid quantity", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer demo-token",
				},
				body: JSON.stringify({ productId: "prod-iphone-15", quantity: -1 }),
			});
			assert.strictEqual(res.status, 400);
		});
	});

	test("POST /api/cart/items rejects nonexistent product", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer demo-token",
				},
				body: JSON.stringify({ productId: "prod-nonexistent", quantity: 1 }),
			});
			assert.strictEqual(res.status, 404);
		});
	});

	test("PATCH /api/cart/items/:productId updates quantity", async () => {
		await withServer(async (port) => {
			const headers = {
				"Content-Type": "application/json",
				Authorization: "Bearer demo-token",
			};
			// Clear first
			await fetch(`http://127.0.0.1:${port}/api/cart`, {
				method: "DELETE",
				headers,
			});

			// Add first
			await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers,
				body: JSON.stringify({ productId: "prod-iphone-15", quantity: 1 }),
			});
			// Update
			const res = await fetch(
				`http://127.0.0.1:${port}/api/cart/items/prod-iphone-15`,
				{
					method: "PATCH",
					headers,
					body: JSON.stringify({ quantity: 5 }),
				},
			);
			assert.strictEqual(res.status, 200);
			const body = await res.json();
			assert.strictEqual(body.data.items[0].quantity, 5);
		});
	});

	test("DELETE /api/cart/items/:productId removes item", async () => {
		await withServer(async (port) => {
			const headers = {
				"Content-Type": "application/json",
				Authorization: "Bearer demo-token",
			};
			// Clear first
			await fetch(`http://127.0.0.1:${port}/api/cart`, {
				method: "DELETE",
				headers,
			});

			await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers,
				body: JSON.stringify({ productId: "prod-iphone-15", quantity: 1 }),
			});
			const res = await fetch(
				`http://127.0.0.1:${port}/api/cart/items/prod-iphone-15`,
				{
					method: "DELETE",
					headers,
				},
			);
			assert.strictEqual(res.status, 200);
			const body = await res.json();
			assert.strictEqual(body.data.items.length, 0);
		});
	});

	test("DELETE /api/cart clears all items", async () => {
		await withServer(async (port) => {
			const headers = {
				"Content-Type": "application/json",
				Authorization: "Bearer demo-token",
			};
			// Clear first
			await fetch(`http://127.0.0.1:${port}/api/cart`, {
				method: "DELETE",
				headers,
			});

			await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers,
				body: JSON.stringify({ productId: "prod-iphone-15", quantity: 1 }),
			});
			await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers,
				body: JSON.stringify({ productId: "prod-galaxy-s25", quantity: 2 }),
			});
			const res = await fetch(`http://127.0.0.1:${port}/api/cart`, {
				method: "DELETE",
				headers,
			});
			assert.strictEqual(res.status, 200);
			const body = await res.json();
			assert.strictEqual(body.data.items.length, 0);
		});
	});

	test("GET /api/cart returns cart with product info", async () => {
		await withServer(async (port) => {
			const headers = {
				"Content-Type": "application/json",
				Authorization: "Bearer demo-token",
			};
			// Clear first
			await fetch(`http://127.0.0.1:${port}/api/cart`, {
				method: "DELETE",
				headers,
			});

			await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers,
				body: JSON.stringify({ productId: "prod-iphone-15", quantity: 2 }),
			});
			const res = await fetch(`http://127.0.0.1:${port}/api/cart`, { headers });
			assert.strictEqual(res.status, 200);
			const body = await res.json();
			assert.strictEqual(body.data.items.length, 1);
			assert.ok(body.data.items[0].product);
			assert.strictEqual(body.data.items[0].product.name, "iPhone 15 Pro");
			assert.ok(body.data.total > 0);
		});
	});
});
