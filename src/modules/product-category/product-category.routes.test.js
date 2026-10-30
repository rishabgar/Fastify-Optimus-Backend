import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../app.js";

const jwtSecret = "test-jwt-secret";
const adminId = "64b000000000000000000002";
const shopId = "64b000000000000000000003";
const shopTypeId = "64b000000000000000000004";

async function adminToken(app, role = "admin") {
  const response = await app.inject({
    method: "POST",
    url: "/auth/admin/login",
    payload: { user_email: "admin@example.com", password: "secret123" },
  });
  const body = response.json();
  if (role === "admin") return body.data.token;
  return body.data.token;
}

function buildTestApp(productCategoryService, role = "admin") {
  return buildApp({
    connectDatabase: false,
    isDevelopment: true,
    jwtSecret,
    productCategoryService,
    authService: {
      async loginAdmin() {
        return { user_id: adminId, role };
      },
    },
  });
}

test("admin category routes require authentication", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/categories/admin/product-categories",
  });

  assert.equal(response.statusCode, 401);
});

test("non-core category routes are unavailable outside development", async (t) => {
  const app = buildApp({
    connectDatabase: false,
    isDevelopment: false,
    jwtSecret,
    productCategoryService: {},
  });
  t.after(() => app.close());

  const requests = [
    { method: "GET", url: "/categories/admin/product-categories" },
    {
      method: "GET",
      url: `/categories/admin/product-categories/${shopTypeId}`,
    },
    {
      method: "PATCH",
      url: `/categories/admin/product-categories/${shopTypeId}/restore`,
    },
    { method: "GET", url: "/categories/product-categories" },
  ];

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 404);
  }
});

test("create category derives created_by from the admin token", async (t) => {
  let receivedAdminId;
  const service = {
    async create(input, actorId) {
      receivedAdminId = actorId;
      assert.equal(input.created_by, undefined);
      return { _id: "category-id", ...input, created_by: actorId };
    },
  };
  const app = buildTestApp(service);
  t.after(() => app.close());
  const token = await adminToken(app);

  const response = await app.inject({
    method: "POST",
    url: "/categories/create",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      product_category_name: "Medicine",
      shop_type_ids: [shopTypeId],
      sort_order: 1,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(receivedAdminId, adminId);
});

test("category input strips arbitrary audit fields", async (t) => {
  const app = buildTestApp({
    async create(input, actorId) {
      assert.equal(input.created_by, undefined);
      return { _id: "category-id", ...input, created_by: actorId };
    },
  });
  t.after(() => app.close());
  const token = await adminToken(app);

  const response = await app.inject({
    method: "POST",
    url: "/categories/create",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      product_category_name: "Medicine",
      shop_type_ids: [shopTypeId],
      created_by: "64b000000000000000000009",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.created_by, adminId);
});

test("delete category uses the product_category_id parameter", async (t) => {
  let receivedCategoryId;
  const app = buildTestApp({
    async remove(categoryId, actorId) {
      receivedCategoryId = categoryId;
      assert.equal(actorId, adminId);
      return { product_category_id: categoryId, is_deleted: true };
    },
  });
  t.after(() => app.close());
  const token = await adminToken(app);

  const response = await app.inject({
    method: "DELETE",
    url: `/categories/delete/${shopTypeId}`,
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(receivedCategoryId, shopTypeId);
});

test("update category uses the product_category_id parameter", async (t) => {
  let receivedCategoryId;
  const app = buildTestApp({
    async update(categoryId, input, actorId) {
      receivedCategoryId = categoryId;
      assert.deepEqual(input, { product_category_name: "Updated" });
      assert.equal(actorId, adminId);
      return { product_category_id: categoryId, ...input };
    },
  });
  t.after(() => app.close());
  const token = await adminToken(app);

  const response = await app.inject({
    method: "PATCH",
    url: `/categories/update/${shopTypeId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { product_category_name: "Updated" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(receivedCategoryId, shopTypeId);
});

test("public category list does not require authentication", async (t) => {
  const service = {
    async listPublic(query) {
      assert.equal(query.search, "med");
      return [{ _id: "category-id", product_category_name: "Medicine" }];
    },
  };
  const app = buildTestApp(service);
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/categories/product-categories?search=med",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data[0].product_category_name, "Medicine");
});

test("shop category route is public and passes the validated shop ID", async (t) => {
  const app = buildTestApp({
    async listByShop(receivedShopId) {
      assert.equal(receivedShopId, shopId);
      return [{ _id: "category-id", product_category_name: "Medicine" }];
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: `/categories/shop_id/${shopId}`,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data[0].product_category_name, "Medicine");
});

test("shop type category route is public and passes the validated ID", async (t) => {
  const app = buildTestApp({
    async listByShopType(receivedShopTypeId) {
      assert.equal(receivedShopTypeId, shopTypeId);
      return [{ _id: "category-id", product_category_name: "Medicine" }];
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: `/categories/shop_type_id/${shopTypeId}`,
  });

  assert.equal(response.statusCode, 200);
});

test("category lookup routes reject invalid IDs", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());

  const [shopResponse, shopTypeResponse] = await Promise.all([
    app.inject({ method: "GET", url: "/categories/shop_id/not-an-id" }),
    app.inject({
      method: "GET",
      url: "/categories/shop_type_id/not-an-id",
    }),
  ]);

  assert.equal(shopResponse.statusCode, 400);
  assert.equal(shopTypeResponse.statusCode, 400);
  assert.deepEqual(Object.keys(shopResponse.json()).sort(), [
    "data",
    "message",
    "status",
  ]);
  assert.equal(shopResponse.json().status, "fail");
  assert.equal(shopResponse.json().data, null);
});
