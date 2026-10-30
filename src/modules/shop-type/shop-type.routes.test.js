import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../app.js";

const jwtSecret = "test-jwt-secret";
const adminId = "64b000000000000000000001";
const shopTypeId = "64b000000000000000000002";

function buildTestApp(shopTypeService, role = "admin") {
  return buildApp({
    connectDatabase: false,
    jwtSecret,
    shopTypeService,
    authService: {
      async loginAdmin() {
        return { user_id: adminId, role };
      },
    },
  });
}

async function tokenFor(app) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/admin/login",
    payload: { user_email: "admin@example.com", password: "secret123" },
  });
  return response.json().data.token;
}

test("admin shop type routes require admin authorization", async (t) => {
  const app = buildTestApp({}, "seller");
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "GET",
    url: "/admin/shop-types",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 403);
});

test("admin can create a validated shop type", async (t) => {
  let received;
  const app = buildTestApp({
    async create(input) {
      received = input;
      return { _id: shopTypeId, ...input };
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "POST",
    url: "/admin/shop-types",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      shop_type_name: "Pharmacy",
      shop_type_image: "https://example.com/pharmacy.png",
      is_deleted: true,
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(received.is_deleted, undefined);
});

test("public shop types are available without authentication", async (t) => {
  const app = buildTestApp({
    async listPublic(query) {
      assert.equal(query.search, "pharm");
      return [{ _id: shopTypeId, shop_type_name: "Pharmacy" }];
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/shop-types?search=pharm",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data[0].shop_type_name, "Pharmacy");
});

test("shop type IDs are validated before service execution", async (t) => {
  const app = buildTestApp({
    async getById() {
      assert.fail("service must not run for an invalid id");
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "GET",
    url: "/admin/shop-types/not-an-object-id",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 400);
});
