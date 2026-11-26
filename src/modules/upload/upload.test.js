import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../app.js";
import { createUploadService } from "./upload.service.js";

const config = {
  R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  R2_ACCESS_KEY_ID: "test-key",
  R2_SECRET_ACCESS_KEY: "test-secret",
  R2_BUCKET: "images",
};
const id = "507f1f77bcf86cd799439011";

test("presigns the correct key, content type and expiry for each supported type", async () => {
  const service = createUploadService({ config, uuid: () => "12345678-1234-4234-8234-123456789abc" });
  for (const [type, ext, role, prefix] of [
    ["image/png", "png", "admin", "common"],
    ["image/jpeg", "jpeg", "seller", "individual"],
    ["image/jpg", "jpg", "customer", "individual"],
    ["image/webp", "webp", "delivery_partner", "individual"],
  ]) {
    const result = await service.createPresignedUrl({ user_id: id, role }, type);
    assert.equal(result.object_path, `${prefix}/${id}/12345678-1234-4234-8234-123456789abc.${ext}`);
    const url = new URL(result.upload_url);
    assert.equal(url.searchParams.get("X-Amz-Expires"), "60");
    assert.ok(url.searchParams.get("X-Amz-SignedHeaders").split(";").includes("content-type"));
    assert.equal(url.hostname, "images.account.r2.cloudflarestorage.com");
    assert.equal(url.pathname, `/${result.object_path}`);
  }
});

test("upload endpoint authenticates, validates input and uses token identity", async (t) => {
  let actor;
  let contentType;
  const app = buildApp({
    connectDatabase: false,
    jwtSecret: "test-secret",
    authService: { async loginAdmin() { return { user_id: id, role: "admin" }; } },
    uploadService: { async createPresignedUrl(user, type) {
      actor = user; contentType = type;
      return { object_path: "key", upload_url: "https://example.com" };
    } },
  });
  t.after(() => app.close());
  const login = await app.inject({ method: "POST", url: "/auth/admin/login", payload: { user_email: "a@example.com", password: "secret123" } });
  const headers = { authorization: `Bearer ${login.json().data.token}` };
  assert.equal((await app.inject({ method: "POST", url: "/uploads/presigned-url", payload: {} })).statusCode, 401);
  assert.equal((await app.inject({ method: "POST", url: "/uploads/presigned-url", headers, payload: { content_type: "image/gif" } })).statusCode, 400);
  assert.equal((await app.inject({ method: "POST", url: "/uploads/presigned-url", headers, payload: {} })).statusCode, 400);
  const response = await app.inject({ method: "POST", url: "/uploads/presigned-url", headers, payload: { user_id: "other", content_type: "image/png" } });
  // Fastify strips additional properties by default; only the verified token is used.
  assert.equal(response.statusCode, 200);
  assert.equal(actor.user_id, id);
  assert.equal(contentType, "image/png");
  assert.deepEqual(response.json(), { status: "success", message: "Request successful", data: { object_path: "key", upload_url: "https://example.com" } });
});

test("upload service rejects unrecognized roles and unsafe identities", async () => {
  const service = createUploadService({ config });
  await assert.rejects(service.createPresignedUrl({ user_id: id, role: "unknown" }), { statusCode: 403 });
  await assert.rejects(service.createPresignedUrl({ user_id: "../other", role: "seller" }), { statusCode: 401 });
});
