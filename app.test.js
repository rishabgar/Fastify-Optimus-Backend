import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "./app.js";

const jwtSecret = "test-jwt-secret";

test("health module reports that the service is available", async (t) => {
  const app = buildApp({ connectDatabase: false, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Service is healthy",
    data: { status: "ok" },
  });
});

test("unknown routes use the standard failure response", async (t) => {
  const app = buildApp({ connectDatabase: false, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/missing" });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    status: "fail",
    message: "Route not found",
    data: null,
  });
});

test("JWT authentication errors use the global unauthorized message", async (t) => {
  const app = buildApp({ connectDatabase: false, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/categories/create",
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    status: "fail",
    message: "Unauthorized user",
    data: null,
  });
});

test("unexpected errors hide details outside production", async (t) => {
  const app = buildApp({
    connectDatabase: false,
    isProduction: false,
    jwtSecret,
  });
  app.get("/error", async () => {
    throw new Error("database unavailable");
  });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/error" });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), {
    status: "fail",
    message: "Internal server error",
    data: null,
  });
});

test("unexpected errors hide details in production", async (t) => {
  const app = buildApp({
    connectDatabase: false,
    isProduction: true,
    jwtSecret,
  });
  app.get("/error", async () => {
    throw new Error("database unavailable");
  });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/error" });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), {
    status: "fail",
    message: "Internal server error",
    data: null,
  });
});
