import assert from "node:assert/strict";
import { test } from "node:test";
import { createProductService } from "./product.service.js";

const shopId = "64b000000000000000000001";
const categoryId = "64b000000000000000000002";

const createInput = {
  product_name: " Rice ",
  brand_name: " Farm ",
  product_description: " Staple food ",
  product_category_id: categoryId,
  product_images: [
    { url: " https://example.com/rice.jpg ", alt: " Rice bag ", is_main: true },
  ],
  variants: [
    {
      label: " 500 g ",
      quantity_value: 500,
      quantity_unit: "g",
      is_default: true,
    },
    {
      label: " 1 kg ",
      quantity_value: 1,
      quantity_unit: "kg",
    },
  ],
};

test("admin product creation validates and normalizes master-product data", async () => {
  let created;
  const service = createProductService({
    generateSku: (() => {
      const skus = ["MP-RICE-500", "MP-RICE-1KG"];
      return () => skus.shift();
    })(),
    repository: {
      async findAvailableCategory(id) {
        assert.equal(id, categoryId);
        return { _id: id };
      },
      async create(input) {
        created = input;
        return { _id: "product-id", ...input };
      },
    },
  });

  const result = await service.create(createInput);

  assert.deepEqual(result, { product_id: "product-id" });
  assert.equal(created.product_name, "Rice");
  assert.equal(created.product_images[0].url, "https://example.com/rice.jpg");
  assert.deepEqual(
    created.variants.map((variant) => variant.sku),
    ["MP-RICE-500", "MP-RICE-1KG"],
  );
  assert.deepEqual(
    created.variants.map(({ normalized_value, normalized_unit }) => ({
      normalized_value,
      normalized_unit,
    })),
    [
      { normalized_value: 500, normalized_unit: "g" },
      { normalized_value: 1000, normalized_unit: "g" },
    ],
  );
  assert.equal(created.is_deleted, undefined);
});

test("admin product creation rejects unavailable categories", async () => {
  const service = createProductService({
    repository: {
      async findAvailableCategory() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.create(createInput),
    (error) =>
      error.statusCode === 400 &&
      error.details.field === "product_category_id",
  );
});

test("admin product creation enforces one default variant", async () => {
  const service = createProductService({ repository: {} });
  await assert.rejects(
    service.create({
      ...createInput,
      variants: createInput.variants.map((variant) => ({
        ...variant,
        is_default: false,
      })),
    }),
    (error) => error.statusCode === 400,
  );
});

test("admin product creation maps database SKU races to a conflict", async () => {
  const service = createProductService({
    repository: {
      async findAvailableCategory() {
        return { _id: categoryId };
      },
      async create() {
        throw Object.assign(new Error("duplicate"), { code: 11000 });
      },
    },
  });

  await assert.rejects(
    service.create(createInput),
    (error) =>
      error.statusCode === 409 &&
      error.message === "Could not generate a unique product SKU",
  );
});

test("product listing verifies resources and returns the product array", async () => {
  let options;
  const service = createProductService({
    repository: {
      async findAvailableShop(id) {
        assert.equal(id, shopId);
        return { _id: id };
      },
      async findAvailableCategory(id) {
        assert.equal(id, categoryId);
        return { _id: id };
      },
      async listByShopAndCategory(input) {
        options = input;
        return { items: [{ product_id: "seller-product" }], total: 21 };
      },
    },
  });

  const result = await service.listByShopAndCategory(shopId, categoryId, {
    page: 2,
    limit: 10,
  });

  assert.deepEqual(options, {
    shopId,
    categoryId,
    skip: 10,
    limit: 10,
  });
  assert.deepEqual(result, [{ product_id: "seller-product" }]);
});

test("product listing rejects an unavailable shop", async () => {
  const service = createProductService({
    repository: {
      async findAvailableShop() {
        return null;
      },
      async findAvailableCategory() {
        return { _id: categoryId };
      },
    },
  });

  await assert.rejects(
    service.listByShopAndCategory(shopId, categoryId, {}),
    (error) => error.statusCode === 404 && error.details.field === "shop_id",
  );
});

test("product listing rejects an unavailable category", async () => {
  const service = createProductService({
    repository: {
      async findAvailableShop() {
        return { _id: shopId };
      },
      async findAvailableCategory() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.listByShopAndCategory(shopId, categoryId, {}),
    (error) =>
      error.statusCode === 404 &&
      error.details.field === "product_category_id",
  );
});

test("shop product listing verifies the shop and maps query options", async () => {
  let options;
  const service = createProductService({
    repository: {
      async findAvailableShop(id) {
        assert.equal(id, shopId);
        return { _id: id };
      },
      async listByShop(input) {
        options = input;
        return { items: [{ product_id: "seller-product" }] };
      },
    },
  });

  const result = await service.listByShop(shopId, {
    page: 2,
    limit: 5,
    search: " Rice.* ",
    product_type: "individual",
    in_stock: false,
    sort_by: "price",
    sort_direction: "asc",
  });

  assert.deepEqual(options, {
    shopId,
    skip: 5,
    limit: 5,
    search: "Rice\\.\\*",
    productType: "individual",
    inStock: false,
    sortBy: "price",
    sortDirection: "asc",
  });
  assert.deepEqual(result, [{ product_id: "seller-product" }]);
});

test("shop product listing rejects an unavailable shop", async () => {
  const service = createProductService({
    repository: {
      async findAvailableShop() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.listByShop(shopId, {}),
    (error) => error.statusCode === 404 && error.details.field === "shop_id",
  );
});

test("nearby product listing verifies shop type and maps query options", async () => {
  let options;
  const service = createProductService({
    repository: {
      async findAvailableShopType(id) {
        assert.equal(id, categoryId);
        return { _id: id };
      },
      async listNearby(input) {
        options = input;
        return [{ product_id: "nearby-product" }];
      },
    },
  });

  const result = await service.listNearby(
    { latitude: 28.6139, longitude: 77.209, shop_type_id: categoryId },
    {
      distance: 25,
      page: 2,
      limit: 10,
      sort_by: "price",
      sort_order: "desc",
      product_category_id: shopId,
      product_type: "individual",
      in_stock: true,
    },
  );

  assert.deepEqual(options, {
    latitude: 28.6139,
    longitude: 77.209,
    shopTypeId: categoryId,
    maxDistance: 25000,
    categoryId: shopId,
    productType: "individual",
    inStock: true,
    sortBy: "price",
    sortOrder: "desc",
    skip: 10,
    limit: 10,
  });
  assert.deepEqual(result, [{ product_id: "nearby-product" }]);
});

test("nearby product listing rejects an unavailable shop type", async () => {
  const service = createProductService({
    repository: {
      async findAvailableShopType() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.listNearby(
      { latitude: 0, longitude: 0, shop_type_id: categoryId },
      {},
    ),
    (error) =>
      error.statusCode === 404 && error.details.field === "shop_type_id",
  );
});

test("nearby product listing accepts distance in metres", async () => {
  let options;
  const service = createProductService({
    repository: {
      async findAvailableShopType() {
        return { _id: categoryId };
      },
      async listNearby(input) {
        options = input;
        return [];
      },
    },
  });

  await service.listNearby(
    { latitude: 28, longitude: 77, shop_type_id: categoryId },
    { distance: 5000, distance_unit: "m" },
  );

  assert.equal(options.maxDistance, 5000);
});

test("nearby product listing defaults to one kilometre", async () => {
  let options;
  const service = createProductService({
    repository: {
      async findAvailableShopType() {
        return { _id: categoryId };
      },
      async listNearby(input) {
        options = input;
        return [];
      },
    },
  });

  await service.listNearby(
    { latitude: 28, longitude: 77, shop_type_id: categoryId },
    {},
  );

  assert.equal(options.maxDistance, 1000);
});

test("nearby product listing enforces the maximum distance for each unit", async () => {
  const service = createProductService({
    repository: {
      async findAvailableShopType() {
        return { _id: categoryId };
      },
    },
  });

  await assert.rejects(
    service.listNearby(
      { latitude: 28, longitude: 77, shop_type_id: categoryId },
      { distance: 101, distance_unit: "km" },
    ),
    (error) => error.statusCode === 400 && error.details.field === "distance",
  );
});

test("product detail returns the resolved public product", async () => {
  const expected = { product_id: shopId, product_type: "individual" };
  const service = createProductService({
    repository: {
      async getPublicDetail(id) {
        assert.equal(id, shopId);
        return expected;
      },
    },
  });

  assert.equal(await service.getDetail(shopId), expected);
});

test("product detail rejects unavailable products", async () => {
  const service = createProductService({
    repository: {
      async getPublicDetail() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.getDetail(shopId),
    (error) => error.statusCode === 404 && error.details.field === "product_id",
  );
});
