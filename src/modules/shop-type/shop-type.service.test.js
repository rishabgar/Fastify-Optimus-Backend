import assert from "node:assert/strict";
import { test } from "node:test";
import { createShopTypeService } from "./shop-type.service.js";

const shopTypeId = "64b000000000000000000001";

test("create normalizes names and whitelists fields", async () => {
  let created;
  const service = createShopTypeService({
    repository: {
      async findByName(name) {
        assert.equal(name, "Pharmacy");
        return null;
      },
      async create(input) {
        created = input;
        return input;
      },
    },
  });

  await service.create({
    shop_type_name: " Pharmacy ",
    shop_type_image: "image.png",
    is_deleted: true,
  });

  assert.deepEqual(created, {
    shop_type_name: "Pharmacy",
    shop_type_image: "image.png",
  });
});

test("create prevents case-insensitive duplicate names", async () => {
  const service = createShopTypeService({
    repository: {
      async findByName() {
        return { _id: shopTypeId, shop_type_name: "Pharmacy" };
      },
    },
  });

  await assert.rejects(
    service.create({ shop_type_name: "PHARMACY", shop_type_image: "x.png" }),
    (error) => error.statusCode === 409,
  );
});

test("delete blocks a shop type referenced by non-deleted shops", async () => {
  const service = createShopTypeService({
    repository: {
      async findById() {
        return { _id: shopTypeId };
      },
      async hasReferencingShops() {
        return { _id: "shop" };
      },
    },
  });

  await assert.rejects(
    service.remove(shopTypeId),
    (error) => error.statusCode === 409,
  );
});

test("delete blocks a shop type referenced by non-deleted categories", async () => {
  const service = createShopTypeService({
    repository: {
      async findById() {
        return { _id: shopTypeId };
      },
      async hasReferencingShops() {
        return null;
      },
      async hasReferencingCategories() {
        return { _id: "category" };
      },
    },
  });

  await assert.rejects(
    service.remove(shopTypeId),
    (error) => error.statusCode === 409,
  );
});

test("restore keeps the shop type inactive", async () => {
  const service = createShopTypeService({
    repository: {
      async restore() {
        return { _id: shopTypeId, is_deleted: false, is_active: false };
      },
    },
  });

  const restored = await service.restore(shopTypeId);

  assert.equal(restored.is_deleted, false);
  assert.equal(restored.is_active, false);
});

test("public list requests only active and non-deleted records", async () => {
  let filter;
  const service = createShopTypeService({
    repository: {
      async listPublic(input) {
        filter = input;
        return [];
      },
    },
  });

  await service.listPublic({ search: "pharm" });

  assert.equal(filter.is_active, true);
  assert.equal(filter.is_deleted, false);
  assert.equal(filter.shop_type_name.$options, "i");
});
