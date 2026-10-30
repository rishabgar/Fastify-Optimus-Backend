import assert from "node:assert/strict";
import { test } from "node:test";
import { createProductCategoryService } from "./product-category.service.js";

const categoryId = "64b000000000000000000001";
const adminId = "64b000000000000000000002";
const shopId = "64b000000000000000000003";
const shopTypeId = "64b000000000000000000004";

test("create trims the category name and derives created_by", async () => {
  let created;
  const service = createProductCategoryService({
    repository: {
      async findByName(name) {
        assert.equal(name, "Medicine");
        return null;
      },
      async create(input) {
        created = input;
        return input;
      },
      async countAvailableShopTypes(ids) {
        return ids.length;
      },
    },
  });

  const result = await service.create(
    { product_category_name: " Medicine ", shop_type_ids: [shopTypeId] },
    adminId,
  );

  assert.equal(created.product_category_name, "Medicine");
  assert.equal(created.created_by, adminId);
  assert.deepEqual(created.shop_type_ids, [shopTypeId]);
  assert.equal(result.created_by, undefined);
});

test("create returns the public category identifier without audit fields", async () => {
  const service = createProductCategoryService({
    repository: {
      async findByName() {
        return null;
      },
      async countAvailableShopTypes(ids) {
        return ids.length;
      },
      async create(input) {
        return {
          ...input,
          _id: categoryId,
          createdAt: "created-at",
          updatedAt: "updated-at",
        };
      },
    },
  });

  const result = await service.create(
    { product_category_name: "Medicine", shop_type_ids: [shopTypeId] },
    adminId,
  );

  assert.equal(result.product_category_id, categoryId);
  assert.equal(result._id, undefined);
  assert.equal(result.created_by, undefined);
  assert.equal(result.createdAt, undefined);
  assert.equal(result.updatedAt, undefined);
});

test("create reports a case-insensitive duplicate", async () => {
  const service = createProductCategoryService({
    repository: {
      async findByName() {
        return { _id: categoryId };
      },
    },
  });

  await assert.rejects(
    service.create(
      { product_category_name: "MEDICINE", shop_type_ids: [shopTypeId] },
      adminId,
    ),
    (error) =>
      error.statusCode === 409 &&
      error.details.field === "product_category_name",
  );
});

test("create rejects inactive or missing shop type mappings", async () => {
  const service = createProductCategoryService({
    repository: {
      async findByName() {
        return null;
      },
      async countAvailableShopTypes() {
        return 0;
      },
    },
  });

  await assert.rejects(
    service.create(
      { product_category_name: "Medicine", shop_type_ids: [shopTypeId] },
      adminId,
    ),
    (error) =>
      error.statusCode === 400 && error.details.field === "shop_type_ids",
  );
});

test("update validates changed shop type mappings", async () => {
  let updated;
  const service = createProductCategoryService({
    repository: {
      async countAvailableShopTypes(ids) {
        assert.deepEqual(ids, [shopTypeId]);
        return ids.length;
      },
      async update(id, changes) {
        assert.equal(id, categoryId);
        updated = changes;
        return { _id: id, ...changes };
      },
    },
  });

  await service.update(
    categoryId,
    { shop_type_ids: [shopTypeId] },
    adminId,
  );

  assert.deepEqual(updated.shop_type_ids, [shopTypeId]);
  assert.equal(updated.updated_by, adminId);
});

test("delete blocks categories referenced by active products", async () => {
  const service = createProductCategoryService({
    repository: {
      async findById() {
        return { _id: categoryId };
      },
      async hasActiveProducts() {
        return { _id: "product-id" };
      },
    },
  });

  await assert.rejects(
    service.remove(categoryId, adminId),
    (error) => error.statusCode === 409,
  );
});

test("admin list excludes deleted categories and uses stable default sorting", async () => {
  let options;
  const service = createProductCategoryService({
    repository: {
      async listAdmin(input) {
        options = input;
        return { items: [], total: 0 };
      },
    },
  });

  const result = await service.listAdmin({ page: 1, limit: 20 });

  assert.deepEqual(options.filter, { is_deleted: false });
  assert.deepEqual(options.sort, {
    sort_order: 1,
    product_category_name: 1,
  });
  assert.equal(result.pagination.total_pages, 0);
});

test("restore does not automatically activate a category", async () => {
  let receivedAdminId;
  const service = createProductCategoryService({
    repository: {
      async restore(id, actorId) {
        assert.equal(id, categoryId);
        receivedAdminId = actorId;
        return { _id: id, is_deleted: false, is_active: false };
      },
    },
  });

  const restored = await service.restore(categoryId, adminId);

  assert.equal(receivedAdminId, adminId);
  assert.equal(restored.is_active, false);
});

test("listByShop verifies availability before loading categories", async () => {
  const categories = [{ _id: categoryId }];
  const service = createProductCategoryService({
    repository: {
      async findAvailableShop(id) {
        assert.equal(id, shopId);
        return { _id: id };
      },
      async listByShop(id) {
        assert.equal(id, shopId);
        return categories;
      },
    },
  });

  assert.equal(await service.listByShop(shopId), categories);
});

test("listByShop rejects unavailable shops without querying categories", async () => {
  const service = createProductCategoryService({
    repository: {
      async findAvailableShop() {
        return null;
      },
      async listByShop() {
        assert.fail("categories must not be queried");
      },
    },
  });

  await assert.rejects(
    service.listByShop(shopId),
    (error) => error.statusCode === 404 && error.details.field === "shop_id",
  );
});

test("listByShopType verifies availability before loading categories", async () => {
  const categories = [
    {
      _id: categoryId,
      product_category_name: "Medicine",
      product_category_image: "medicine.png",
      product_category_description: "Not returned",
      sort_order: 1,
    },
  ];
  const service = createProductCategoryService({
    repository: {
      async findAvailableShopType(id) {
        assert.equal(id, shopTypeId);
        return { _id: id };
      },
      async listByShopType(id) {
        assert.equal(id, shopTypeId);
        return categories;
      },
    },
  });

  assert.deepEqual(await service.listByShopType(shopTypeId), [
    {
      product_category_id: categoryId,
      product_category_name: "Medicine",
      product_category_type: "common",
      product_category_image: "medicine.png",
    },
  ]);
});

test("listByShopType rejects unavailable shop types", async () => {
  const service = createProductCategoryService({
    repository: {
      async findAvailableShopType() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.listByShopType(shopTypeId),
    (error) =>
      error.statusCode === 404 && error.details.field === "shop_type_id",
  );
});
