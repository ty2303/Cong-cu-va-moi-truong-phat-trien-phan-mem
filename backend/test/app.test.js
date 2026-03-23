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

async function withAbsaServer(handler, run) {
	const server = http.createServer(handler);
	server.listen(0);
	const { port } = server.address();

	try {
		await run(`http://127.0.0.1:${port}/predict`);
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

function createTestOrder(overrides = {}) {
	const order = {
		id: `order-test-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
		userId: "user-1",
		email: "demo@example.com",
		customerName: "Demo User",
		phone: "0900000001",
		address: "123 Duong Nguyen Hue",
		city: "TP.HCM",
		district: "Quan 1",
		ward: "Ben Nghe",
		note: "Test order",
		paymentMethod: "COD",
		status: "PENDING",
		items: [
			{
				productId: "prod-iphone-15",
				productName: "iPhone 15 Pro",
				price: 27990000,
				quantity: 1,
			},
		],
		subtotal: 27990000,
		shippingFee: 0,
		total: 27990000,
		createdAt: new Date().toISOString(),
		paymentStatus: "UNPAID",
		...overrides,
	};

	db.orders.unshift(order);
	return order;
}

function removeTestOrder(orderId) {
	db.orders = db.orders.filter((order) => order.id !== orderId);
}

function removeTestUserByEmail(email) {
	db.users = db.users.filter((user) => user.email !== email);
}

function createMockJsonResponse(payload, ok = true, status = 200) {
	return {
		ok,
		status,
		async json() {
			return payload;
		},
		async text() {
			return JSON.stringify(payload);
		},
	};
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

test("POST /api/reviews stores sentiment analysis results when ABSA responds successfully", async () => {
	await withAbsaServer((req, res) => {
		if (req.method !== "POST" || req.url !== "/predict") {
			res.writeHead(404).end();
			return;
		}

		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				results: [
					{ aspect: "Battery", sentiment: "positive", confidence: 0.92 },
					{ aspect: "Price", sentiment: "negative", confidence: 0.81 },
				],
			}),
		);
	}, async (absaUrl) => {
		const previousUrl = process.env.ABSA_SERVICE_URL;
		process.env.ABSA_SERVICE_URL = absaUrl;

		try {
			await withServer(async (port) => {
				const response = await fetch(`http://127.0.0.1:${port}/api/reviews`, {
					method: "POST",
					headers: {
						Authorization: "Bearer admin-token",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						productId: "prod-iphone-15",
						rating: 4,
						comment: "Pin trau nhung gia hoi cao",
						images: [],
					}),
				});
				const body = await response.json();

				assert.equal(response.status, 201);
				assert.equal(body.data.analysisResults.length, 2);
				assert.deepEqual(body.data.analysisResults[0], {
					aspect: "Battery",
					sentiment: "positive",
					confidence: 0.92,
				});

				db.reviews = db.reviews.filter((review) => review.id !== body.data.id);
				const product = db.products.find((item) => item.id === "prod-iphone-15");
				if (product) {
					product.rating = 5;
				}
			});
		} finally {
			if (previousUrl) {
				process.env.ABSA_SERVICE_URL = previousUrl;
			} else {
				delete process.env.ABSA_SERVICE_URL;
			}
		}
	});
});

test("POST /api/reviews still saves review when ABSA service is unavailable", async () => {
	const previousUrl = process.env.ABSA_SERVICE_URL;
	process.env.ABSA_SERVICE_URL = "http://127.0.0.1:65500/predict";

	try {
		await withServer(async (port) => {
			const response = await fetch(`http://127.0.0.1:${port}/api/reviews`, {
				method: "POST",
				headers: {
					Authorization: "Bearer admin-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					productId: "prod-galaxy-s25",
					rating: 5,
					comment: "Man hinh dep va may chay muot",
				}),
			});
			const body = await response.json();

			assert.equal(response.status, 201);
			assert.deepEqual(body.data.analysisResults, []);

			db.reviews = db.reviews.filter((review) => review.id !== body.data.id);
			const product = db.products.find((item) => item.id === "prod-galaxy-s25");
			if (product) {
				product.rating = 4.8;
			}
		});
	} finally {
		if (previousUrl) {
			process.env.ABSA_SERVICE_URL = previousUrl;
		} else {
			delete process.env.ABSA_SERVICE_URL;
		}
	}
});

test("PUT /api/reviews/:id updates review content and recalculates analysis results", async () => {
	const existingReview = db.reviews.find((review) => review.id === "review-1");
	assert.ok(existingReview);
	const snapshot = structuredClone(existingReview);

	await withAbsaServer((req, res) => {
		if (req.method !== "POST" || req.url !== "/predict") {
			res.writeHead(404).end();
			return;
		}

		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				results: [{ aspect: "Battery", sentiment: "neutral", confidence: 0.77 }],
			}),
		);
	}, async (absaUrl) => {
		const previousUrl = process.env.ABSA_SERVICE_URL;
		process.env.ABSA_SERVICE_URL = absaUrl;

		try {
			await withServer(async (port) => {
				const response = await fetch(`http://127.0.0.1:${port}/api/reviews/review-1`, {
					method: "PUT",
					headers: {
						Authorization: "Bearer demo-token",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						productId: "prod-iphone-15",
						rating: 3,
						comment: "Pin tam on, can dung them",
						images: ["data:image/png;base64,ZmFrZQ=="],
					}),
				});
				const body = await response.json();

				assert.equal(response.status, 200);
				assert.equal(body.data.rating, 3);
				assert.equal(body.data.comment, "Pin tam on, can dung them");
				assert.equal(body.data.analysisResults.length, 1);
				assert.equal(body.data.analysisResults[0].sentiment, "neutral");
			});
		} finally {
			Object.assign(existingReview, snapshot);
			if (previousUrl) {
				process.env.ABSA_SERVICE_URL = previousUrl;
			} else {
				delete process.env.ABSA_SERVICE_URL;
			}
		}
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

test("PATCH /api/orders/:id/cancel restores stock for fallback-created orders", async () => {
	await withServer(async (port) => {
		const product = db.products.find((item) => item.id === "prod-iphone-15");
		assert.ok(product);
		const initialStock = product.stock;
		let createdOrderId;

		try {
			const createResponse = await fetch(`http://127.0.0.1:${port}/api/orders`, {
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
							price: 27990000,
							quantity: 2,
						},
					],
				}),
			});
			const createBody = await createResponse.json();
			createdOrderId = createBody.data.id;

			assert.equal(createResponse.status, 201);
			assert.equal(product.stock, initialStock - 2);

			const cancelResponse = await fetch(
				`http://127.0.0.1:${port}/api/orders/${createdOrderId}/cancel?reason=Kh%C3%B4ng%20c%C3%B2n%20nhu%20c%E1%BA%A7u`,
				{
					method: "PATCH",
					headers: {
						Authorization: "Bearer demo-token",
					},
				},
			);
			const cancelBody = await cancelResponse.json();

			assert.equal(cancelResponse.status, 200);
			assert.equal(cancelBody.data.status, "CANCELLED");
			assert.equal(cancelBody.data.paymentStatus, "FAILED");
			assert.equal(product.stock, initialStock);
		} finally {
			product.stock = initialStock;
			product.updatedAt = new Date().toISOString();
			if (createdOrderId) {
				db.orders = db.orders.filter((order) => order.id !== createdOrderId);
			}
		}
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

test("GET /api/auth/google redirects to Google OAuth consent screen", async () => {
	await withServer(async (port) => {
		const previousEnv = {
			GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
			GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
		};

		process.env.GOOGLE_CLIENT_ID = "google-client-id";
		process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
		process.env.GOOGLE_REDIRECT_URI = `http://127.0.0.1:${port}/api/auth/google/callback`;

		try {
			const response = await fetch(
				`http://127.0.0.1:${port}/api/auth/google`,
				{ redirect: "manual" },
			);
			const location = response.headers.get("location");

			assert.equal(response.status, 302);
			assert.ok(location);
			const redirectUrl = new URL(location);
			assert.equal(
				redirectUrl.origin,
				"https://accounts.google.com",
			);
			assert.equal(
				redirectUrl.searchParams.get("client_id"),
				"google-client-id",
			);
			assert.equal(
				redirectUrl.searchParams.get("redirect_uri"),
				`http://127.0.0.1:${port}/api/auth/google/callback`,
			);
			assert.equal(redirectUrl.searchParams.get("response_type"), "code");
			assert.ok(redirectUrl.searchParams.get("state"));
		} finally {
			Object.entries(previousEnv).forEach(([key, value]) => {
				if (value === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			});
		}
	});
});

test("GET /api/auth/google/callback redirects to frontend callback with app token", async () => {
	await withServer(async (port) => {
		const previousEnv = {
			FRONTEND_URL: process.env.FRONTEND_URL,
			GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
			GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
		};
		const originalFetch = global.fetch;
		const googleEmail = "google-user@example.com";

		process.env.FRONTEND_URL = "http://localhost:5173";
		process.env.GOOGLE_CLIENT_ID = "google-client-id";
		process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
		process.env.GOOGLE_REDIRECT_URI = `http://127.0.0.1:${port}/api/auth/google/callback`;

		global.fetch = async (input, init) => {
			const url = String(input);
			if (url.startsWith(`http://127.0.0.1:${port}`)) {
				return originalFetch(input, init);
			}

			if (url === "https://oauth2.googleapis.com/token") {
				return createMockJsonResponse({ access_token: "google-access-token" });
			}

			if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
				return createMockJsonResponse({
					email: googleEmail,
					email_verified: true,
					name: "Google User",
				});
			}

			throw new Error(`Unexpected fetch url: ${url}`);
		};

		try {
			const startResponse = await originalFetch(
				`http://127.0.0.1:${port}/api/auth/google`,
				{ redirect: "manual" },
			);
			const startLocation = startResponse.headers.get("location");
			assert.ok(startLocation);
			const state = new URL(startLocation).searchParams.get("state");
			assert.ok(state);

			const callbackResponse = await originalFetch(
				`http://127.0.0.1:${port}/api/auth/google/callback?code=test-code&state=${encodeURIComponent(state)}`,
				{ redirect: "manual" },
			);
			const callbackLocation = callbackResponse.headers.get("location");

			assert.equal(callbackResponse.status, 302);
			assert.ok(callbackLocation);
			const redirectUrl = new URL(callbackLocation);
			assert.equal(
				`${redirectUrl.origin}${redirectUrl.pathname}`,
				"http://localhost:5173/oauth2/callback",
			);
			assert.equal(redirectUrl.searchParams.get("email"), googleEmail);
			assert.equal(redirectUrl.searchParams.get("role"), "USER");
			assert.ok(redirectUrl.searchParams.get("token"));
			assert.ok(redirectUrl.searchParams.get("id"));
			assert.ok(redirectUrl.searchParams.get("username"));
		} finally {
			global.fetch = originalFetch;
			removeTestUserByEmail(googleEmail);
			Object.entries(previousEnv).forEach(([key, value]) => {
				if (value === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			});
		}
	});
});

test("GET /api/auth/google redirects to login when Google config is missing", async () => {
	await withServer(async (port) => {
		const previousEnv = {
			FRONTEND_URL: process.env.FRONTEND_URL,
			GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
		};

		process.env.FRONTEND_URL = "http://localhost:5173,http://127.0.0.1:5173";
		delete process.env.GOOGLE_CLIENT_ID;
		delete process.env.GOOGLE_CLIENT_SECRET;

		try {
			const response = await fetch(
				`http://127.0.0.1:${port}/api/auth/google`,
				{ redirect: "manual" },
			);
			assert.equal(response.status, 302);
			assert.equal(
				response.headers.get("location"),
				"http://localhost:5173/login?error=google_not_configured",
			);
		} finally {
			Object.entries(previousEnv).forEach(([key, value]) => {
				if (value === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			});
		}
	});
});

test("GET /api/auth/google uses BACKEND_URL to build local callback URI", async () => {
	await withServer(async (port) => {
		const previousEnv = {
			BACKEND_URL: process.env.BACKEND_URL,
			GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
			GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
		};

		process.env.BACKEND_URL = "http://localhost:8080";
		process.env.GOOGLE_CLIENT_ID = "google-client-id";
		process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
		delete process.env.GOOGLE_REDIRECT_URI;

		try {
			const response = await fetch(
				`http://127.0.0.1:${port}/api/auth/google`,
				{ redirect: "manual" },
			);
			const location = response.headers.get("location");
			assert.ok(location);
			const redirectUrl = new URL(location);
			assert.equal(
				redirectUrl.searchParams.get("redirect_uri"),
				"http://localhost:8080/api/auth/google/callback",
			);
		} finally {
			Object.entries(previousEnv).forEach(([key, value]) => {
				if (value === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			});
		}
	});
});

test("GET /api/auth/google/callback redirects to login when state is invalid", async () => {
	await withServer(async (port) => {
		const previousEnv = {
			FRONTEND_URL: process.env.FRONTEND_URL,
			GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
			GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
		};

		process.env.FRONTEND_URL = "http://localhost:5173";
		process.env.GOOGLE_CLIENT_ID = "google-client-id";
		process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
		process.env.GOOGLE_REDIRECT_URI = `http://127.0.0.1:${port}/api/auth/google/callback`;

		try {
			const response = await fetch(
				`http://127.0.0.1:${port}/api/auth/google/callback?code=test-code&state=invalid-state`,
				{ redirect: "manual" },
			);
			assert.equal(response.status, 302);
			assert.equal(
				response.headers.get("location"),
				"http://localhost:5173/login?error=google_failed",
			);
		} finally {
			Object.entries(previousEnv).forEach(([key, value]) => {
				if (value === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			});
		}
	});
});

test("GET /api/auth/google/callback redirects to login when Google denies access", async () => {
	await withServer(async (port) => {
		const previousEnv = {
			FRONTEND_URL: process.env.FRONTEND_URL,
			GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
		};

		process.env.FRONTEND_URL = "http://localhost:5173";
		process.env.GOOGLE_CLIENT_ID = "google-client-id";
		process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";

		try {
			const response = await fetch(
				`http://127.0.0.1:${port}/api/auth/google/callback?error=access_denied`,
				{ redirect: "manual" },
			);
			assert.equal(response.status, 302);
			assert.equal(
				response.headers.get("location"),
				"http://localhost:5173/login?error=google_failed",
			);
		} finally {
			Object.entries(previousEnv).forEach(([key, value]) => {
				if (value === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			});
		}
	});
});

test("GET /api/admin/dashboard-metrics returns aggregated admin overview", async () => {
	await withServer(async (port) => {
		const response = await fetch(
			`http://127.0.0.1:${port}/api/admin/dashboard-metrics`,
			{
				headers: {
					Authorization: "Bearer admin-token",
				},
			},
		);
		const body = await response.json();

		assert.equal(response.status, 200);
		assert.equal(body.data.totals.users, db.users.length);
		assert.equal(body.data.totals.products, db.products.length);
		assert.equal(body.data.totals.categories, db.categories.length);
		assert.equal(body.data.totals.orders, db.orders.length);
		assert.ok(Array.isArray(body.data.charts.revenueByDay));
		assert.equal(body.data.charts.revenueByDay.length, 7);
		assert.ok(Array.isArray(body.data.recentOrders));
		assert.equal(body.data.recentOrders.length, Math.min(5, db.orders.length));
	});
});

test("realtime sends order status updates to the order owner", async () => {
	await withServer(async (port) => {
		const order = createTestOrder({ status: "CONFIRMED" });
		const ws = await connectAndSubscribe(
			port,
			"demo-token",
			"/user/queue/order-status",
		);

		try {
			const responsePromise = fetch(
				`http://127.0.0.1:${port}/api/orders/${order.id}/status`,
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
				orderId: order.id,
				newStatus: "SHIPPING",
			});
		} finally {
			removeTestOrder(order.id);
			ws.close();
		}
	});
});

test("PATCH /api/orders/:id/status rejects invalid order status values", async () => {
	await withServer(async (port) => {
		const order = createTestOrder();

		try {
			const response = await fetch(
				`http://127.0.0.1:${port}/api/orders/${order.id}/status`,
				{
					method: "PATCH",
					headers: {
						Authorization: "Bearer admin-token",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ status: "ARCHIVED" }),
				},
			);
			const body = await response.json();

			assert.equal(response.status, 400);
			assert.equal(body.message, "Trang thai don hang khong hop le");
			assert.equal(order.status, "PENDING");
		} finally {
			removeTestOrder(order.id);
		}
	});
});

test("PATCH /api/orders/:id/status rejects invalid transition order flow", async () => {
	await withServer(async (port) => {
		const order = createTestOrder({ status: "DELIVERED" });

		try {
			const response = await fetch(
				`http://127.0.0.1:${port}/api/orders/${order.id}/status`,
				{
					method: "PATCH",
					headers: {
						Authorization: "Bearer admin-token",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ status: "SHIPPING" }),
				},
			);
			const body = await response.json();

			assert.equal(response.status, 400);
			assert.equal(
				body.message,
				"Khong the cap nhat trang thai don hang theo luong nay",
			);
			assert.equal(order.status, "DELIVERED");
		} finally {
			removeTestOrder(order.id);
		}
	});
});

test("PATCH /api/orders/:id/cancel allows the order owner to cancel pending orders", async () => {
	await withServer(async (port) => {
		const order = createTestOrder({ status: "CONFIRMED" });

		try {
			const response = await fetch(
				`http://127.0.0.1:${port}/api/orders/${order.id}/cancel?reason=Khong%20muon%20mua%20nua`,
				{
					method: "PATCH",
					headers: {
						Authorization: "Bearer demo-token",
					},
				},
			);
			const body = await response.json();

			assert.equal(response.status, 200);
			assert.equal(body.data.status, "CANCELLED");
			assert.equal(body.data.cancelledBy, "USER");
			assert.equal(body.data.paymentStatus, "FAILED");
			assert.equal(body.data.cancelReason, "Khong muon mua nua");
		} finally {
			removeTestOrder(order.id);
		}
	});
});

test("PATCH /api/orders/:id/cancel rejects cancelling another user's order", async () => {
	await withServer(async (port) => {
		const order = createTestOrder({ userId: "admin-1" });

		try {
			const response = await fetch(
				`http://127.0.0.1:${port}/api/orders/${order.id}/cancel?reason=Khac`,
				{
					method: "PATCH",
					headers: {
						Authorization: "Bearer demo-token",
					},
				},
			);
			const body = await response.json();

			assert.equal(response.status, 403);
			assert.equal(body.message, "Forbidden");
			assert.equal(order.status, "PENDING");
		} finally {
			removeTestOrder(order.id);
		}
	});
});

test("PATCH /api/orders/:id/cancel rejects non-cancellable order statuses", async () => {
	await withServer(async (port) => {
		const order = createTestOrder({ status: "DELIVERED" });

		try {
			const response = await fetch(
				`http://127.0.0.1:${port}/api/orders/${order.id}/cancel?reason=Khac`,
				{
					method: "PATCH",
					headers: {
						Authorization: "Bearer demo-token",
					},
				},
			);
			const body = await response.json();

			assert.equal(response.status, 400);
			assert.equal(body.message, "Khong the huy don hang o trang thai nay");
			assert.equal(order.status, "DELIVERED");
		} finally {
			removeTestOrder(order.id);
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
