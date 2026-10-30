import assert from "node:assert/strict";
import { test } from "node:test";
import { createSellerProductService } from "./seller-product.service.js";

const ids = {
  seller: "64b000000000000000000001",
  shop: "64b000000000000000000002",
  shopType: "64b000000000000000000003",
  product: "64b000000000000000000004",
  category: "64b000000000000000000005",
  variant: "64b000000000000000000006",
};

const commonInput = {
  shop_id: ids.shop,
  product_type: "common",
  product_id: ids.product,
  variants: [
    {
      product_variant_id: ids.variant,
      price: 90,
      mrp: 100,
      product_quantity: 10,
      available_quantity: 10,
      reserved_quantity: 0,
    },
  ],
};

test("common registration verifies ownership and master variants", async () => {
  let created;
  const service = createSellerProductService({
    generateSellerSku: () => "SP-GENERATED-COMMON",
    repository: {
      async findOwnedShop(shopId, sellerId) {
        assert.equal(shopId, ids.shop);
        assert.equal(sellerId, ids.seller);
        return { _id: shopId, shop_type_id: ids.shopType, is_active: true };
      },
      async findAvailableMasterProduct(productId) {
        assert.equal(productId, ids.product);
        return {
          _id: productId,
          variants: [{ _id: ids.variant, is_active: true }],
        };
      },
      async findCommonByShopAndProduct() {
        return null;
      },
      async createSellerProduct(input) {
        created = input;
        return input;
      },
    },
  });

  await service.createSellerProduct(commonInput, ids.seller);

  assert.equal(created.seller_id, ids.seller);
  assert.equal(created.product_id, ids.product);
  assert.equal(created.variants[0].seller_sku, "SP-GENERATED-COMMON");
});

test("common registration rejects mismatched or inactive master variants", async () => {
  const service = createSellerProductService({
    repository: {
      async findOwnedShop() {
        return { _id: ids.shop, is_active: true };
      },
      async findAvailableMasterProduct() {
        return { variants: [{ _id: ids.variant, is_active: false }] };
      },
      async findCommonByShopAndProduct() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.createSellerProduct(commonInput, ids.seller),
    (error) =>
      error.statusCode === 400 &&
      error.details.field === "variants.product_variant_id",
  );
});

test("common registration rejects duplicate shop products", async () => {
  const service = createSellerProductService({
    repository: {
      async findOwnedShop() {
        return { _id: ids.shop, is_active: true };
      },
      async findAvailableMasterProduct() {
        return { variants: [{ _id: ids.variant, is_active: true }] };
      },
      async findCommonByShopAndProduct() {
        return { _id: "existing" };
      },
    },
  });

  await assert.rejects(
    service.createSellerProduct(commonInput, ids.seller),
    (error) => error.statusCode === 409,
  );
});

test("individual registration validates category and normalizes quantities", async () => {
  let created;
  const input = {
    shop_id: ids.shop,
    product_type: "individual",
    product_name: "Rice",
    brand_name: "Local",
    product_category_id: ids.category,
    variants: [
      {
        label: "1 kg",
        quantity_value: 1,
        quantity_unit: "kg",
        price: 80,
      },
    ],
  };
  const service = createSellerProductService({
    generateSellerSku: () => "SP-GENERATED-INDIVIDUAL",
    repository: {
      async findOwnedShop() {
        return {
          _id: ids.shop,
          shop_type_id: ids.shopType,
          is_active: true,
        };
      },
      async findAvailableCategory(categoryId, shopTypeId) {
        assert.equal(categoryId, ids.category);
        assert.equal(shopTypeId, ids.shopType);
        return { _id: categoryId };
      },
      async createSellerProduct(data) {
        created = data;
        return data;
      },
    },
  });

  await service.createSellerProduct(input, ids.seller);

  assert.equal(created.product_id, undefined);
  assert.equal(
    created.variants[0].seller_sku,
    "SP-GENERATED-INDIVIDUAL",
  );
  assert.equal(created.variants[0].normalized_value, 1000);
  assert.equal(created.variants[0].normalized_unit, "g");
});

test("registration hides shops not owned by the authenticated seller", async () => {
  const service = createSellerProductService({
    repository: {
      async findOwnedShop() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.createSellerProduct(commonInput, ids.seller),
    (error) => error.statusCode === 404 && error.details.field === "shop_id",
  );
});

test("registration rejects an inactive owned shop", async () => {
  const service = createSellerProductService({
    repository: {
      async findOwnedShop() {
        return { _id: ids.shop, is_active: false };
      },
    },
  });

  await assert.rejects(
    service.createSellerProduct(commonInput, ids.seller),
    (error) =>
      error.statusCode === 409 &&
      error.message === "Shop is inactive" &&
      error.details.field === "shop_id",
  );
});

test("registration retries generated seller SKU conflicts", async () => {
  let createAttempts = 0;
  let skuSequence = 0;
  const service = createSellerProductService({
    generateSellerSku: () => `SP-GENERATED-${++skuSequence}`,
    repository: {
      async findOwnedShop() {
        return { _id: ids.shop, is_active: true };
      },
      async findAvailableMasterProduct() {
        return { variants: [{ _id: ids.variant, is_active: true }] };
      },
      async findCommonByShopAndProduct() {
        return null;
      },
      async createSellerProduct(input) {
        createAttempts += 1;
        if (createAttempts === 1) {
          throw {
            code: 11000,
            keyPattern: { "variants.seller_sku": 1 },
          };
        }
        return input;
      },
    },
  });

  const product = await service.createSellerProduct(commonInput, ids.seller);

  assert.equal(createAttempts, 2);
  assert.equal(product.variants[0].seller_sku, "SP-GENERATED-2");
});

test("registration stops after repeated seller SKU conflicts", async () => {
  let createAttempts = 0;
  const service = createSellerProductService({
    repository: {
      async findOwnedShop() {
        return { _id: ids.shop, is_active: true };
      },
      async findAvailableMasterProduct() {
        return { variants: [{ _id: ids.variant, is_active: true }] };
      },
      async findCommonByShopAndProduct() {
        return null;
      },
      async createSellerProduct() {
        createAttempts += 1;
        throw { code: 11000, keyPattern: { "variants.seller_sku": 1 } };
      },
    },
  });

  await assert.rejects(
    service.createSellerProduct(commonInput, ids.seller),
    (error) =>
      error.statusCode === 409 &&
      error.message === "Could not generate a unique seller SKU",
  );
  assert.equal(createAttempts, 3);
});

test("registration does not misreport unrelated duplicate key errors", async () => {
  const duplicateError = { code: 11000, keyPattern: { unrelated_field: 1 } };
  const service = createSellerProductService({
    repository: {
      async findOwnedShop() {
        return { _id: ids.shop, is_active: true };
      },
      async findAvailableMasterProduct() {
        return { variants: [{ _id: ids.variant, is_active: true }] };
      },
      async findCommonByShopAndProduct() {
        return null;
      },
      async createSellerProduct() {
        throw duplicateError;
      },
    },
  });

  await assert.rejects(
    service.createSellerProduct(commonInput, ids.seller),
    (error) => error === duplicateError,
  );
});
