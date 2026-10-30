import assert from "node:assert/strict";
import { test } from "node:test";
import { createUpdateSellerProductService } from "./update-seller-product.service.js";

const ids = {
  seller: "64b000000000000000000001",
  shop: "64b000000000000000000002",
  shopType: "64b000000000000000000003",
  sellerProduct: "64b000000000000000000004",
  masterProduct: "64b000000000000000000005",
  variant: "64b000000000000000000006",
  category: "64b000000000000000000007",
};

function commonProduct() {
  return {
    _id: ids.sellerProduct,
    seller_id: ids.seller,
    shop_id: ids.shop,
    product_type: "common",
    product_id: ids.masterProduct,
    variants: [
      {
        _id: "64b000000000000000000008",
        product_variant_id: ids.variant,
        seller_sku: "SP-UNCHANGED",
        product_quantity: 20,
        available_quantity: 18,
        reserved_quantity: 2,
      },
    ],
  };
}

function individualProduct() {
  return {
    _id: ids.sellerProduct,
    seller_id: ids.seller,
    shop_id: ids.shop,
    product_type: "individual",
    variants: [
      {
        _id: ids.variant,
        label: "1 kg",
        quantity_value: 1,
        quantity_unit: "kg",
        seller_sku: "SP-UNCHANGED",
        product_quantity: 20,
        available_quantity: 18,
        reserved_quantity: 2,
      },
    ],
  };
}

function baseRepository(product, capture) {
  return {
    async findOwnedProduct(productId, sellerId) {
      assert.equal(productId, ids.sellerProduct);
      assert.equal(sellerId, ids.seller);
      return product;
    },
    async findOwnedShop() {
      return { _id: ids.shop, shop_type_id: ids.shopType };
    },
    async updateOwnedProduct(productId, sellerId, updates) {
      capture.updates = updates;
      return { _id: productId, seller_id: sellerId };
    },
  };
}

test("common update changes only whitelisted seller fields atomically", async () => {
  const capture = {};
  const repository = {
    ...baseRepository(commonProduct(), capture),
    async findAvailableMasterProduct(productId) {
      assert.equal(productId, ids.masterProduct);
      return { variants: [{ _id: ids.variant, is_active: true }] };
    },
  };
  const service = createUpdateSellerProductService({ repository });

  await service.updateSellerProduct(
    {
      product_id: ids.sellerProduct,
      product_name_override: " Better Rice ",
      variants: [{ product_variant_id: ids.variant, price: 95 }],
    },
    ids.seller,
  );

  assert.deepEqual(capture.updates.set, {
    product_name_override: "Better Rice",
    "variants.$[variant0].price": 95,
  });
  assert.deepEqual(capture.updates.arrayFilters, [
    { "variant0.product_variant_id": ids.variant },
  ]);
  assert.equal(capture.updates.set.seller_sku, undefined);
  assert.equal(capture.updates.set.reserved_quantity, undefined);
});

test("individual update validates category and recalculates quantity", async () => {
  const capture = {};
  const repository = {
    ...baseRepository(individualProduct(), capture),
    async findAvailableCategory(categoryId, shopTypeId) {
      assert.equal(categoryId, ids.category);
      assert.equal(shopTypeId, ids.shopType);
      return { _id: categoryId };
    },
  };
  const service = createUpdateSellerProductService({ repository });

  await service.updateSellerProduct(
    {
      product_id: ids.sellerProduct,
      product_category_id: ids.category,
      variants: [
        {
          product_variant_id: ids.variant,
          label: "500 g",
          quantity_value: 500,
          quantity_unit: "g",
        },
      ],
    },
    ids.seller,
  );

  assert.equal(capture.updates.set.product_category_id, ids.category);
  assert.equal(
    capture.updates.set["variants.$[variant0].normalized_value"],
    500,
  );
  assert.equal(
    capture.updates.set["variants.$[variant0].normalized_unit"],
    "g",
  );
  assert.deepEqual(capture.updates.arrayFilters, [
    { "variant0._id": ids.variant },
  ]);
});

test("update reports missing or unowned products without writing", async () => {
  const service = createUpdateSellerProductService({
    repository: {
      async findOwnedProduct() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.updateSellerProduct(
      { product_id: ids.sellerProduct, is_active: false },
      ids.seller,
    ),
    (error) => error.statusCode === 404 && error.details.field === "product_id",
  );
});

test("common update rejects unrelated master variants", async () => {
  const service = createUpdateSellerProductService({
    repository: {
      ...baseRepository(commonProduct(), {}),
      async findAvailableMasterProduct() {
        return { variants: [{ _id: ids.variant, is_active: false }] };
      },
    },
  });

  await assert.rejects(
    service.updateSellerProduct(
      {
        product_id: ids.sellerProduct,
        variants: [{ product_variant_id: ids.variant, price: 90 }],
      },
      ids.seller,
    ),
    (error) =>
      error.statusCode === 400 &&
      error.details.field === "variants.product_variant_id",
  );
});

test("individual update rejects an unavailable category", async () => {
  const service = createUpdateSellerProductService({
    repository: {
      ...baseRepository(individualProduct(), {}),
      async findAvailableCategory() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.updateSellerProduct(
      {
        product_id: ids.sellerProduct,
        product_category_id: ids.category,
      },
      ids.seller,
    ),
    (error) =>
      error.statusCode === 400 &&
      error.details.field === "product_category_id",
  );
});

test("stored product type controls the update whitelist", async () => {
  const service = createUpdateSellerProductService({
    repository: baseRepository(commonProduct(), {}),
  });

  await assert.rejects(
    service.updateSellerProduct(
      { product_id: ids.sellerProduct, brand_name: "Changed" },
      ids.seller,
    ),
    (error) => error.statusCode === 400 && error.details.field === "brand_name",
  );
});

test("update preserves reservation consistency without changing reservations", async () => {
  const service = createUpdateSellerProductService({
    repository: {
      ...baseRepository(individualProduct(), {}),
    },
  });

  await assert.rejects(
    service.updateSellerProduct(
      {
        product_id: ids.sellerProduct,
        variants: [
          {
            product_variant_id: ids.variant,
            product_quantity: 10,
            available_quantity: 9,
          },
        ],
      },
      ids.seller,
    ),
    (error) =>
      error.statusCode === 400 &&
      error.details.field === "variants.available_quantity",
  );
});
