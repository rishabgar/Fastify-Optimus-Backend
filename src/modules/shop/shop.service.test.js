import assert from "node:assert/strict";
import { test } from "node:test";
import { createShopService } from "./shop.service.js";

const sellerId = "64b000000000000000000001";
const shopId = "64b000000000000000000002";
const shopTypeId = "64b000000000000000000003";

test("shop creation validates type and derives seller id", async () => {
  let created;
  const service = createShopService({
    repository: {
      async findActiveShopType(id) {
        assert.equal(id, shopTypeId);
        return { _id: id };
      },
      async create(input) {
        created = input;
        return input;
      },
    },
  });

  await service.create({ shop_name: "Store", shop_type_id: shopTypeId }, sellerId);

  assert.equal(created.seller_id, sellerId);
});

test("seller updates are ownership scoped and field whitelisted", async () => {
  let updates;
  const service = createShopService({
    repository: {
      async findOwned(id, actorId) {
        assert.equal(id, shopId);
        assert.equal(actorId, sellerId);
        return { _id: id };
      },
      async updateOwned(id, actorId, input) {
        updates = input;
        return {
          _id: id,
          ...input,
          createdAt: "2026-10-13T10:00:00.000Z",
          updatedAt: "2026-10-13T11:00:00.000Z",
        };
      },
    },
  });

  const result = await service.update(shopId, sellerId, {
    shop_name: "Updated",
    is_closed: true,
    seller_id: "attacker",
    is_deleted: true,
  });

  assert.deepEqual(updates, { shop_name: "Updated", is_closed: true });
  assert.equal(Object.hasOwn(result, "createdAt"), false);
  assert.equal(Object.hasOwn(result, "updatedAt"), false);
});

test("shop deletion is blocked by active orders", async () => {
  const service = createShopService({
    repository: {
      async findOwned() {
        return { _id: shopId };
      },
      async hasBlockingOrders() {
        return { _id: "order" };
      },
    },
  });

  await assert.rejects(
    service.remove(shopId, sellerId),
    (error) => error.statusCode === 409,
  );
});

test("shop detail enforces ownership and exposes only seller detail fields", async () => {
  const service = createShopService({
    repository: {
      async findOwnedDetail(receivedShopId, receivedSellerId) {
        assert.equal(receivedShopId, shopId);
        assert.equal(receivedSellerId, sellerId);
        return {
          _id: shopId,
          shop_name: "Health Store",
          shop_address: "123 Main Street",
          shop_image: "shop.jpg",
          is_closed: false,
          operating_hours: { open: "09:00", close: "23:55" },
          seller_location: { type: "Point", coordinates: [77.04, 28.68] },
          seller_id: sellerId,
          is_deleted: false,
          createdAt: "hidden",
        };
      },
    },
  });

  const result = await service.getDetail(shopId, sellerId);

  assert.deepEqual(result, {
    shop_id: shopId,
    shop_name: "Health Store",
    shop_address: "123 Main Street",
    shop_image: "shop.jpg",
    is_closed: false,
    operating_hours: { open: "09:00", close: "23:55" },
    seller_location: { type: "Point", coordinates: [77.04, 28.68] },
  });
  assert.equal(Object.hasOwn(result, "_id"), false);
  assert.equal(Object.hasOwn(result, "seller_id"), false);
});

test("shop detail hides missing, deleted, and unowned shops", async () => {
  const service = createShopService({
    repository: {
      async findOwnedDetail() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.getDetail(shopId, sellerId),
    (error) => error.statusCode === 404 && error.message === "Shop not found",
  );
});

test("nearby discovery delegates distance filtering to the repository", async () => {
  let options;
  const service = createShopService({
    repository: {
      async listNearby(input) {
        options = input;
        return [];
      },
    },
  });

  await service.listNearby({
    longitude: 77.5,
    latitude: 12.9,
    distance: 5000,
  });

  assert.deepEqual(options.coordinates, [77.5, 12.9]);
  assert.equal(options.maxDistance, 5000);
  assert.deepEqual(options.match, { is_active: true, is_deleted: false });
});

test("nearby discovery defaults to 1000 metres and maps public fields", async () => {
  let options;
  const service = createShopService({
    now: () => new Date("2026-10-13T06:30:00.000Z"), // 12:00 Asia/Kolkata
    repository: {
      async listNearby(input) {
        options = input;
        return [
          {
            _id: shopId,
            shop_name: "Gupta store",
            shop_address: "New Delhi",
            seller_id: sellerId,
            is_closed: false,
            operating_hours: { open: "09:00", close: "23:55" },
            shop_type_id: shopTypeId,
            distance: 42.5,
            shop_type_name: "Groceries",
          },
        ];
      },
    },
  });

  const result = await service.listNearby({ longitude: 77.5, latitude: 12.9 });

  assert.equal(options.maxDistance, 1000);
  assert.equal(Object.hasOwn(options, "skip"), false);
  assert.equal(Object.hasOwn(options, "limit"), false);
  assert.deepEqual(result, [
    {
      shop_name: "Gupta store",
      shop_address: "New Delhi",
      seller_id: sellerId,
      is_closed: false,
      operating_hours: { open: "09:00", close: "23:55" },
      shop_type_id: shopTypeId,
      distance: 42.5,
      shop_id: shopId,
      shop_type_name: "Groceries",
    },
  ]);
  assert.equal(Object.hasOwn(result[0], "shop_image"), false);
  assert.equal(Object.hasOwn(result[0], "_id"), false);
});

test("nearby discovery computes manual, daytime, and overnight closure", async () => {
  const shops = [
    {
      _id: "manual",
      is_closed: true,
      operating_hours: { open: "09:00", close: "23:00" },
    },
    {
      _id: "daytime",
      is_closed: false,
      operating_hours: { open: "09:00", close: "11:00" },
    },
    {
      _id: "overnight",
      is_closed: false,
      operating_hours: { open: "20:00", close: "02:00" },
    },
  ].map((shop) => ({
    shop_name: "Store",
    shop_address: "Address",
    seller_id: sellerId,
    shop_type_id: shopTypeId,
    distance: 0,
    shop_type_name: "Groceries",
    ...shop,
  }));
  const service = createShopService({
    now: () => new Date("2026-10-13T19:30:00.000Z"), // 01:00 Asia/Kolkata
    repository: {
      async listNearby() {
        return shops;
      },
    },
  });

  const result = await service.listNearby({ longitude: 77.5, latitude: 12.9 });

  assert.deepEqual(
    result.map((shop) => shop.is_closed),
    [true, true, false],
  );
});
