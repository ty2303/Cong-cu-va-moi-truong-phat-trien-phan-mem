import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { app } from "../src/app.js";
import { db } from "../src/data/store.js";
import { attachRealtimeServer } from "../src/lib/realtime.js";
import { WebSocket } from "ws";

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
      "heart-beat": "0,0"
    })
  );

  const connectedFrame = await waitForFrame(ws);
  assert.equal(connectedFrame.command, "CONNECTED");

  ws.send(
    buildFrame("SUBSCRIBE", {
      id: "sub-1",
      destination,
      receipt: "sub-1-ready"
    })
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

test("admin middleware rejects unauthenticated requests", async () => {
  await withServer(async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Test product" })
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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Test product" })
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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Test product",
        brand: "Test brand",
        categoryId: "cat-iphone",
        price: 1000,
        originalPrice: 1200,
        image: "https://example.com/test.jpg",
        specs: "Test specs"
      })
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
    const ws = await connectAndSubscribe(port, "demo-token", "/user/queue/order-status");

    try {
      const responsePromise = fetch(`http://127.0.0.1:${port}/api/orders/order-1/status`, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "SHIPPING" })
      });

      const framePromise = waitForFrame(ws);
      const [response, frame] = await Promise.all([responsePromise, framePromise]);
      const body = await response.json();
      const payload = JSON.parse(frame.body);

      assert.equal(response.status, 200);
      assert.equal(body.data.status, "SHIPPING");
      assert.equal(frame.command, "MESSAGE");
      assert.equal(frame.headers.destination, "/user/queue/order-status");
      assert.deepEqual(payload, {
        orderId: "order-1",
        newStatus: "SHIPPING"
      });
    } finally {
      db.orders[0].status = "DELIVERED";
      ws.close();
    }
  });
});

test("realtime sends role updates to the affected user", async () => {
  await withServer(async (port) => {
    const ws = await connectAndSubscribe(port, "demo-token", "/user/queue/role-change");

    try {
      const responsePromise = fetch(`http://127.0.0.1:${port}/api/users/user-1/role`, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role: "ADMIN" })
      });

      const framePromise = waitForFrame(ws);
      const [response, frame] = await Promise.all([responsePromise, framePromise]);
      const body = await response.json();
      const payload = JSON.parse(frame.body);

      assert.equal(response.status, 200);
      assert.equal(body.data.role, "ADMIN");
      assert.equal(frame.command, "MESSAGE");
      assert.equal(frame.headers.destination, "/user/queue/role-change");
      assert.deepEqual(payload, {
        userId: "user-1",
        newRole: "ADMIN"
      });
    } finally {
      db.users[0].role = "USER";
      ws.close();
    }
  });
});
