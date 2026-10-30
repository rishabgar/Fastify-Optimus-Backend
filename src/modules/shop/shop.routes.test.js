import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../app.js";

const jwtSecret = "test-jwt-secret";
const sellerId = "64b000000000000000000001";
const shopId = "64b000000000000000000002";
const shopTypeId = "64b000000000000000000003";

function buildTestApp(shopService, { role = "seller", isProduction = false } = {}) {
  return buildApp({
    connectDatabase: false,
    jwtSecret,
    isProduction,
    shopService,
    authService: {
      async loginAdmin() {
        return { user_id: sellerId, role };
      },
    },
  });
}

async function tokenFor(app) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/admin/login",
    payload: { user_email: "seller@example.com", password: "secret123" },
  });
  return response.json().data.token;
}

function createPayload() {
  return {
    shop_name: "Health Store",
    shop_address: "123 Main Street",
    operating_hours: { open: "09:00", close: "22:30" },
    shop_type_id: shopTypeId,
    seller_location: { coordinates: [77.5946, 12.9716] },
  };
}

test("seller shop creation derives seller id from JWT", async (t) => {
  let actorId;
  const app = buildTestApp({
    async create(input, id) {
      actorId = id;
      assert.equal(input.seller_id, undefined);
      return { _id: shopId, ...input, seller_id: id };
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "POST",
    url: "/shop/seller/shops",
    headers: { authorization: `Bearer ${token}` },
    payload: { ...createPayload(), seller_id: "64b000000000000000000009" },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(actorId, sellerId);
});

test("non-sellers cannot access seller shop APIs", async (t) => {
  const app = buildTestApp({}, { role: "customer" });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "GET",
    url: "/shop/seller/shops",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 403);
});

test("seller shop detail route is not available", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "GET",
    url: `/shop/seller/shops/${shopId}`,
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 404);
});

test("authenticated seller can fetch an owned shop by id", async (t) => {
  const expected = {
    shop_id: shopId,
    shop_name: "Health Store",
    shop_address: "123 Main Street",
    shop_image: "shop.jpg",
    is_closed: false,
    operating_hours: { open: "09:00", close: "23:55" },
    seller_location: { type: "Point", coordinates: [77.04, 28.68] },
  };
  const app = buildTestApp({
    async getDetail(receivedShopId, receivedSellerId) {
      assert.equal(receivedShopId, shopId);
      assert.equal(receivedSellerId, sellerId);
      return expected;
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "GET",
    url: `/shop/${shopId}`,
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Shop fetched successfully",
    data: expected,
  });
  assert.equal(Object.hasOwn(response.json().data, "_id"), false);
});

test("authenticated seller can update shop details and closed state", async (t) => {
  const expected = {
    _id: shopId,
    shop_name: "Updated Store",
    is_closed: true,
  };
  const app = buildTestApp({
    async update(receivedShopId, receivedSellerId, input) {
      assert.equal(receivedShopId, shopId);
      assert.equal(receivedSellerId, sellerId);
      assert.deepEqual(input, {
        shop_name: "Updated Store",
        is_closed: true,
      });
      return expected;
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "PATCH",
    url: `/shop/shop_id/${shopId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { shop_name: "Updated Store", is_closed: true },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Shop updated successfully",
    data: expected,
  });
});

test("shop update accepts is_closed as the only field", async (t) => {
  const app = buildTestApp({
    async update(receivedShopId, receivedSellerId, input) {
      assert.equal(receivedShopId, shopId);
      assert.equal(receivedSellerId, sellerId);
      assert.deepEqual(input, { is_closed: false });
      return { _id: shopId, is_closed: false };
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "PATCH",
    url: `/shop/shop_id/${shopId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { is_closed: false },
  });

  assert.equal(response.statusCode, 200);
});

test("shop update requires seller authentication", async (t) => {
  const customerApp = buildTestApp({}, { role: "customer" });
  t.after(() => customerApp.close());
  const customerToken = await tokenFor(customerApp);

  const missingToken = await customerApp.inject({
    method: "PATCH",
    url: `/shop/shop_id/${shopId}`,
    payload: { is_closed: true },
  });
  const customer = await customerApp.inject({
    method: "PATCH",
    url: `/shop/shop_id/${shopId}`,
    headers: { authorization: `Bearer ${customerToken}` },
    payload: { is_closed: true },
  });

  assert.equal(missingToken.statusCode, 401);
  assert.equal(customer.statusCode, 403);
});

test("shop update rejects invalid ids, empty bodies, and controlled fields", async (t) => {
  const app = buildTestApp({
    async update() {
      assert.fail("service must not run for invalid update input");
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);
  const headers = { authorization: `Bearer ${token}` };

  const responses = await Promise.all([
    app.inject({
      method: "PATCH",
      url: "/shop/shop_id/not-an-id",
      headers,
      payload: { is_closed: true },
    }),
    app.inject({
      method: "PATCH",
      url: `/shop/shop_id/${shopId}`,
      headers,
      payload: {},
    }),
    app.inject({
      method: "PATCH",
      url: `/shop/shop_id/${shopId}`,
      headers,
      payload: { seller_id: sellerId },
    }),
  ]);

  for (const response of responses) assert.equal(response.statusCode, 400);
});

test("old seller shop update routes are unavailable", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());
  const token = await tokenFor(app);
  const headers = { authorization: `Bearer ${token}` };

  const oldUpdate = await app.inject({
    method: "PATCH",
    url: `/shop/seller/shops/${shopId}`,
    headers,
    payload: { shop_name: "Updated" },
  });
  const oldStatus = await app.inject({
    method: "PATCH",
    url: `/shop/seller/shops/${shopId}/status`,
    headers,
    payload: { is_closed: true },
  });

  assert.equal(oldUpdate.statusCode, 404);
  assert.equal(oldStatus.statusCode, 404);
});

test("shop detail requires a valid seller token", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());

  const missingToken = await app.inject({
    method: "GET",
    url: `/shop/${shopId}`,
  });
  const invalidToken = await app.inject({
    method: "GET",
    url: `/shop/${shopId}`,
    headers: { authorization: "Bearer invalid-token" },
  });

  assert.equal(missingToken.statusCode, 401);
  assert.equal(invalidToken.statusCode, 401);
});

test("shop detail validates the shop id", async (t) => {
  const app = buildTestApp({
    async getDetail() {
      assert.fail("service must not run for an invalid shop id");
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "GET",
    url: "/shop/not-an-id",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 400);
});

test("old public shop detail route is not available", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "GET",
    url: `/shop/shops/${shopId}`,
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 404);
});

test("nearby endpoint validates and forwards coordinates", async (t) => {
  const app = buildTestApp({
    async listNearby(query) {
      assert.equal(query.longitude, 77.5);
      assert.equal(query.latitude, 12.9);
      assert.equal(query.distance, 1000);
      assert.equal(Object.hasOwn(query, "page"), false);
      assert.equal(Object.hasOwn(query, "limit"), false);
      return [];
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/shop/nearby?longitude=77.5&latitude=12.9",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Nearby shops fetched successfully",
    data: [],
  });
});

test("nearby endpoint requires both coordinates", async (t) => {
  const app = buildTestApp({
    async listNearby() {
      assert.fail("service must not run without both coordinates");
    },
  });
  t.after(() => app.close());

  for (const query of ["", "?longitude=77.5", "?latitude=12.9"]) {
    const response = await app.inject({
      method: "GET",
      url: `/shop/nearby${query}`,
    });
    assert.equal(response.statusCode, 400);
  }
});

test("nearby endpoint rejects removed query parameters", async (t) => {
  const app = buildTestApp({
    async listNearby() {
      assert.fail("service must not run for an invalid query");
    },
  });
  t.after(() => app.close());

  for (const parameter of [
    "page=1",
    "limit=20",
    "radius=5",
    "is_closed=true",
    "sort_by=name",
  ]) {
    const response = await app.inject({
      method: "GET",
      url: `/shop/nearby?longitude=77.5&latitude=12.9&${parameter}`,
    });
    assert.equal(response.statusCode, 400);
  }
});

test("only core shop routes remain available in production", async (t) => {
  const detail = {
    shop_id: shopId,
    shop_name: "Health Store",
    shop_address: "123 Main Street",
    is_closed: false,
    operating_hours: { open: "09:00", close: "23:55" },
    seller_location: { type: "Point", coordinates: [77.5, 12.9] },
  };
  const app = buildTestApp(
    {
      async update(id, actorId, input) {
        assert.equal(id, shopId);
        assert.equal(actorId, sellerId);
        return { _id: id, ...input };
      },
      async listNearby() {
        return [];
      },
      async getDetail(id, actorId) {
        assert.equal(id, shopId);
        assert.equal(actorId, sellerId);
        return detail;
      },
    },
    { isProduction: true },
  );
  t.after(() => app.close());
  const token = await tokenFor(app);
  const headers = { authorization: `Bearer ${token}` };

  const coreResponses = await Promise.all([
    app.inject({
      method: "PATCH",
      url: `/shop/shop_id/${shopId}`,
      headers,
      payload: { is_closed: true },
    }),
    app.inject({
      method: "GET",
      url: "/shop/nearby?longitude=77.5&latitude=12.9",
    }),
    app.inject({ method: "GET", url: `/shop/${shopId}`, headers }),
  ]);
  for (const response of coreResponses) assert.equal(response.statusCode, 200);

  const unavailableResponses = await Promise.all([
    app.inject({ method: "POST", url: "/shop/seller/shops", headers }),
    app.inject({ method: "GET", url: "/shop/seller/shops", headers }),
    app.inject({
      method: "DELETE",
      url: `/shop/seller/shops/${shopId}`,
      headers,
    }),
    app.inject({ method: "GET", url: "/shop/shops" }),
    app.inject({
      method: "PATCH",
      url: `/shop/dev/shops/${shopId}`,
      payload: { shop_name: "Updated" },
    }),
  ]);

  assert.deepEqual(
    unavailableResponses.map((response) => response.statusCode),
    [404, 404, 404, 404, 404],
  );
});

test("non-production shop routes remain registered", async (t) => {
  const app = buildTestApp({
    async listSeller() {
      return { items: [], pagination: {} };
    },
    async remove() {
      return { _id: shopId, is_deleted: true };
    },
    async listCustomer() {
      return { items: [], pagination: {} };
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);
  const headers = { authorization: `Bearer ${token}` };

  const responses = await Promise.all([
    app.inject({ method: "GET", url: "/shop/seller/shops", headers }),
    app.inject({
      method: "DELETE",
      url: `/shop/seller/shops/${shopId}`,
      headers,
    }),
    app.inject({ method: "GET", url: "/shop/shops" }),
  ]);

  for (const response of responses) assert.equal(response.statusCode, 200);
});
