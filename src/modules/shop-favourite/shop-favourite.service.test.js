import assert from "node:assert/strict";
import { test } from "node:test";
import { createShopFavouriteService } from "./shop-favourite.service.js";

const userId = "64b000000000000000000001";
const shopId = "64b000000000000000000002";
const secondShopId = "64b000000000000000000003";
const favouriteId = "64b000000000000000000004";

test("add verifies shop availability and derives user ownership", async () => {
  let created;
  const service = createShopFavouriteService({
    repository: {
      async findAvailableCustomer(id) {
        assert.equal(id, userId);
        return { _id: id };
      },
      async findAvailableShop(id) {
        assert.equal(id, shopId);
        return { _id: id };
      },
      async findByUserAndShop() {
        return null;
      },
      async create(input) {
        created = input;
        return input;
      },
    },
  });

  const result = await service.add(userId, shopId, { note: "Nearby" });

  assert.deepEqual(created, {
    user_id: userId,
    shop_id: shopId,
    note: "Nearby",
  });
  assert.deepEqual(result, {
    created: true,
    data: { user_id: userId, shop_id: shopId },
  });
});

test("add maps duplicate-key races to idempotent success", async () => {
  let lookupCount = 0;
  const service = createShopFavouriteService({
    repository: {
      async findAvailableCustomer() {
        return { _id: userId };
      },
      async findAvailableShop() {
        return { _id: shopId };
      },
      async findByUserAndShop() {
        lookupCount += 1;
        return lookupCount === 1
          ? null
          : { user_id: userId, shop_id: shopId };
      },
      async create() {
        const error = new Error("duplicate");
        error.code = 11000;
        throw error;
      },
    },
  });

  assert.deepEqual(await service.add(userId, shopId), {
    created: false,
    data: { user_id: userId, shop_id: shopId },
  });
});

test("add rejects an unavailable authenticated customer", async () => {
  const service = createShopFavouriteService({
    repository: {
      async findAvailableCustomer() {
        return null;
      },
      async findAvailableShop() {
        assert.fail("shop lookup must not run for an unavailable customer");
      },
    },
  });

  await assert.rejects(
    service.add(userId, shopId),
    (error) => error.statusCode === 403,
  );
});

test("add rejects a missing or inactive shop", async () => {
  const service = createShopFavouriteService({
    repository: {
      async findAvailableCustomer() {
        return { _id: userId };
      },
      async findAvailableShop() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.add(userId, shopId),
    (error) => error.statusCode === 404 && error.message === "Active shop not found",
  );
});

test("add rejects malformed authenticated user ids before querying", async () => {
  const service = createShopFavouriteService({
    repository: {
      async findAvailableCustomer() {
        assert.fail("repository must not receive a malformed user id");
      },
    },
  });

  await assert.rejects(
    service.add("not-an-object-id", shopId),
    (error) => error.statusCode === 401,
  );
});

test("add returns idempotent success for an existing favourite", async () => {
  const service = createShopFavouriteService({
    repository: {
      async findAvailableCustomer() {
        return { _id: userId };
      },
      async findAvailableShop() {
        return { _id: shopId };
      },
      async findByUserAndShop() {
        return { _id: "existing-favourite" };
      },
      async create() {
        assert.fail("duplicate favourite must not be inserted");
      },
    },
  });

  assert.deepEqual(await service.add(userId, shopId), {
    created: false,
    data: { user_id: userId, shop_id: shopId },
  });
});

test("remove is scoped to the authenticated user", async () => {
  const service = createShopFavouriteService({
    repository: {
      async removeOwned(receivedUserId, receivedFavouriteId) {
        assert.equal(receivedUserId, userId);
        assert.equal(receivedFavouriteId, favouriteId);
        return { _id: favouriteId };
      },
    },
  });

  const removed = await service.remove(userId, favouriteId);

  assert.equal(removed, undefined);
});

test("remove hides missing and unowned favourites", async () => {
  const service = createShopFavouriteService({
    repository: {
      async removeOwned() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.remove(userId, favouriteId),
    (error) => error.statusCode === 404,
  );
});

test("update note is ownership scoped and returns whitelisted fields", async () => {
  const service = createShopFavouriteService({
    repository: {
      async updateOwnedNote(receivedUserId, receivedFavouriteId, note) {
        assert.equal(receivedUserId, userId);
        assert.equal(receivedFavouriteId, favouriteId);
        assert.equal(note, "Preferred");
        return {
          _id: favouriteId,
          user_id: userId,
          shop_id: shopId,
          note,
          createdAt: "hidden",
        };
      },
    },
  });

  assert.deepEqual(
    await service.updateNote(userId, favouriteId, "Preferred"),
    {
      _id: favouriteId,
      user_id: userId,
      shop_id: shopId,
      note: "Preferred",
    },
  );
});

test("update note supports clearing and hides unowned favourites", async () => {
  let found = true;
  const service = createShopFavouriteService({
    repository: {
      async updateOwnedNote() {
        if (found) {
          found = false;
          return {
            _id: favouriteId,
            user_id: userId,
            shop_id: shopId,
            note: null,
          };
        }
        return null;
      },
    },
  });

  const cleared = await service.updateNote(userId, favouriteId, null);
  assert.equal(cleared.note, null);

  await assert.rejects(
    service.updateNote(userId, favouriteId, "Other"),
    (error) => error.statusCode === 404,
  );
});

test("favourite listing maps nearby and distant shops without filtering", async () => {
  let geospatialOptions;
  const service = createShopFavouriteService({
    repository: {
      async listForUser(id) {
        assert.equal(id, userId);
        return [
          {
            _id: "favourite-1",
            user_id: userId,
            shop_id: shopId,
            note: "Preferred",
          },
          {
            _id: "favourite-2",
            user_id: userId,
            shop_id: secondShopId,
            note: null,
          },
        ];
      },
      async findVisibleShopsWithDistance(input) {
        geospatialOptions = input;
        return [
          {
            _id: shopId,
            shop_name: "Nearby shop",
            shop_image: "nearby.jpg",
            is_closed: false,
            operating_hours: { open: "09:00", close: "23:55" },
            distance: 750,
          },
          {
            _id: secondShopId,
            shop_name: "Distant closed shop",
            shop_image: "distant.jpg",
            is_closed: true,
            operating_hours: { open: "10:00", close: "20:00" },
            distance: 1250,
          },
        ];
      },
    },
  });

  const result = await service.list(userId, {
    latitude: 28.6139,
    longitude: 77.209,
  });

  assert.deepEqual(geospatialOptions, {
    shopIds: [shopId, secondShopId],
    coordinates: [77.209, 28.6139],
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].is_nearby, true);
  assert.equal(result[0].note, "Preferred");
  assert.equal(result[1].is_nearby, false);
  assert.equal(Object.hasOwn(result[1], "note"), false);
  assert.equal(result[1].shop.is_closed, true);
});

test("favourite listing applies a custom nearby distance", async () => {
  const service = createShopFavouriteService({
    repository: {
      async listForUser() {
        return [{ _id: "favourite", user_id: userId, shop_id: shopId }];
      },
      async findVisibleShopsWithDistance() {
        return [
          {
            _id: shopId,
            shop_name: "Shop",
            distance: 1500,
            is_closed: false,
          },
        ];
      },
    },
  });

  const result = await service.list(userId, {
    latitude: 28,
    longitude: 77,
    distance: 2000,
  });

  assert.equal(result[0].is_nearby, true);
});

test("favourite listing omits invisible shops returned without a match", async () => {
  const service = createShopFavouriteService({
    repository: {
      async listForUser() {
        return [
          { _id: "visible-favourite", user_id: userId, shop_id: shopId },
          {
            _id: "invisible-favourite",
            user_id: userId,
            shop_id: secondShopId,
          },
        ];
      },
      async findVisibleShopsWithDistance() {
        return [{ _id: shopId, shop_name: "Visible", distance: 10 }];
      },
    },
  });

  const result = await service.list(userId, {
    latitude: 28,
    longitude: 77,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].shop_id, shopId);
});

test("favourite listing avoids the shop query when no favourites exist", async () => {
  const service = createShopFavouriteService({
    repository: {
      async listForUser() {
        return [];
      },
      async findVisibleShopsWithDistance() {
        assert.fail("shop query must not run without favourites");
      },
    },
  });

  const result = await service.list(userId, {
    latitude: 28,
    longitude: 77,
  });

  assert.deepEqual(result, []);
});

