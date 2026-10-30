import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../app.js";

const jwtSecret = "test-jwt-secret";
const userId = "64b000000000000000000001";
const shopId = "64b000000000000000000002";
const favouriteId = "64b000000000000000000003";

function buildTestApp(service, role = "customer") {
  return buildApp({
    connectDatabase: false,
    jwtSecret,
    shopFavouriteService: service,
    authService: {
      async loginAdmin() {
        return { user_id: userId, role };
      },
    },
  });
}

async function tokenFor(app) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/admin/login",
    payload: { user_email: "customer@example.com", password: "secret123" },
  });
  return response.json().data.token;
}

test("favourite routes require customer authentication", async (t) => {
  const app = buildTestApp({}, "seller");
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "GET",
    url: "/shopFavourites?latitude=28.6139&longitude=77.209",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 403);
});

test("listing favourites requires coordinates", async (t) => {
  const app = buildTestApp({
    async list() {
      assert.fail("service must not run without coordinates");
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const missingLatitude = await app.inject({
    method: "GET",
    url: "/shopFavourites?longitude=77.209",
    headers: { authorization: `Bearer ${token}` },
  });
  const missingLongitude = await app.inject({
    method: "GET",
    url: "/shopFavourites?latitude=28.6139",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(missingLatitude.statusCode, 400);
  assert.equal(missingLongitude.statusCode, 400);
});

test("listing favourites validates coordinates and distance", async (t) => {
  const app = buildTestApp({
    async list() {
      assert.fail("service must not run for invalid query values");
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);
  const urls = [
    "/shopFavourites?latitude=91&longitude=77",
    "/shopFavourites?latitude=28&longitude=181",
    "/shopFavourites?latitude=28&longitude=77&distance=0",
    "/shopFavourites?latitude=28&longitude=77&distance=invalid",
  ];

  for (const url of urls) {
    const response = await app.inject({
      method: "GET",
      url,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.statusCode, 400);
  }
});

test("listing favourites defaults distance to 1000 metres", async (t) => {
  const app = buildTestApp({
    async list(id, query) {
      assert.equal(id, userId);
      assert.equal(query.latitude, 28.6139);
      assert.equal(query.longitude, 77.209);
      assert.equal(query.distance, 1000);
      return [];
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "GET",
    url: "/shopFavourites?latitude=28.6139&longitude=77.209",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, []);
});

test("adding a favourite requires authentication", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: `/shopFavourites/${shopId}`,
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    status: "fail",
    message: "Unauthorized user",
    data: null,
  });
});

test("adding a favourite rejects non-customer tokens", async (t) => {
  const app = buildTestApp({}, "seller");
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "POST",
    url: `/shopFavourites/${shopId}`,
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), {
    status: "fail",
    message: "Customer access is required",
    data: null,
  });
});

test("adding a favourite derives user id from authentication", async (t) => {
  let actorId;
  let receivedShopId;
  const app = buildTestApp({
    async add(id, idFromPath, input) {
      actorId = id;
      receivedShopId = idFromPath;
      assert.equal(input.user_id, undefined);
      return {
        created: true,
        data: { user_id: id, shop_id: idFromPath },
      };
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "POST",
    url: `/shopFavourites/${shopId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      note: "Nearby",
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(actorId, userId);
  assert.equal(receivedShopId, shopId);
  assert.deepEqual(response.json().data, {
    user_id: userId,
    shop_id: shopId,
  });
});

test("adding an existing favourite returns idempotent success", async (t) => {
  const app = buildTestApp({
    async add(id, idFromPath) {
      return {
        created: false,
        data: { user_id: id, shop_id: idFromPath },
      };
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "POST",
    url: `/shopFavourites/${shopId}`,
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().message, "Shop already added to favourites");
  assert.deepEqual(response.json().data, {
    user_id: userId,
    shop_id: shopId,
  });
});

test("adding a favourite rejects controlled body fields", async (t) => {
  const app = buildTestApp({
    async add() {
      assert.fail("service must not run for controlled body fields");
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "POST",
    url: `/shopFavourites/${shopId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { user_id: "64b000000000000000000009" },
  });

  assert.equal(response.statusCode, 400);
});

test("adding a favourite validates the optional note", async (t) => {
  const app = buildTestApp({
    async add() {
      assert.fail("service must not run for an invalid note");
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "POST",
    url: `/shopFavourites/${shopId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { note: "x".repeat(501) },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    status: "fail",
    message: "note must be null or a string up to 500 characters",
    data: null,
  });
});

test("note is optional when adding a favourite", async (t) => {
  const app = buildTestApp({
    async add(id, idFromPath, input) {
      assert.equal(id, userId);
      assert.equal(idFromPath, shopId);
      assert.equal(input, undefined);
      return {
        created: true,
        data: { user_id: id, shop_id: idFromPath },
      };
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "POST",
    url: `/shopFavourites/${shopId}`,
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json().data, {
    user_id: userId,
    shop_id: shopId,
  });
});

test("note can be updated and cleared by favourite id", async (t) => {
  const app = buildTestApp({
    async updateNote(id, receivedFavouriteId, note) {
      assert.equal(id, userId);
      assert.equal(receivedFavouriteId, favouriteId);
      assert.equal(note, null);
      return {
        _id: favouriteId,
        user_id: id,
        shop_id: shopId,
        note,
      };
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "PATCH",
    url: `/shopFavourites/${favouriteId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { note: null },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, {
    _id: favouriteId,
    user_id: userId,
    shop_id: shopId,
    note: null,
  });
});

test("update rejects controlled fields and oversized notes", async (t) => {
  const app = buildTestApp({
    async updateNote() {
      assert.fail("service must not run for invalid update input");
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  for (const payload of [
    { note: "valid", shop_id: shopId },
    { note: "x".repeat(501) },
  ]) {
    const response = await app.inject({
      method: "PATCH",
      url: `/shopFavourites/${favouriteId}`,
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    assert.equal(response.statusCode, 400);
  }
});

test("delete uses favourite id and returns null data", async (t) => {
  const app = buildTestApp({
    async remove(id, receivedFavouriteId) {
      assert.equal(id, userId);
      assert.equal(receivedFavouriteId, favouriteId);
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "DELETE",
    url: `/shopFavourites/${favouriteId}`,
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Shop favourite removed successfully",
    data: null,
  });
});

test("update and delete validate favourite ids", async (t) => {
  const app = buildTestApp({
    async updateNote() {
      assert.fail("update service must not run for invalid id");
    },
    async remove() {
      assert.fail("remove service must not run for invalid id");
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const updateResponse = await app.inject({
    method: "PATCH",
    url: "/shopFavourites/not-an-id",
    headers: { authorization: `Bearer ${token}` },
    payload: { note: "Preferred" },
  });
  const deleteResponse = await app.inject({
    method: "DELETE",
    url: "/shopFavourites/not-an-id",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(updateResponse.statusCode, 400);
  assert.equal(deleteResponse.statusCode, 400);
});

test("shop favourite status route is not available", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "GET",
    url: `/shopFavourites/${shopId}/status`,
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 404);
});
