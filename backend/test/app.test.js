import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../src/app.js";

test("GET /health returns service status", async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 200);
    assert.equal(body.data.service, "backend");
  } finally {
    server.close();
  }
});
