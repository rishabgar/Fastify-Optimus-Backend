import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../app.js";

const sellerId = "64b000000000000000000001";
const shopId = "64b000000000000000000002";
const productId = "64b000000000000000000003";
const variantId = "64b000000000000000000004";

function buildTestApp(sellerProductService) {
  return buildApp({
    connectDatabase: false,
    isDevelopment: true,
    sellerProductService,
    authService: {
      async getDevelopmentTokenClaims() {
        return { user_id: sellerId, role: "seller" };
      },
    },
  });
}

async function sellerToken(app) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/dev/token",
    payload: { user_email: "seller@example.com" },
  });
  return response.json().data.token;
}

function commonPayload() {
  return {
    shop_id: shopId,
    product_type: "common",
    product_id: productId,
    variants: [
      {
        product_variant_id: variantId,
        price: 90,
        mrp: 100,
      },
    ],
  };
}

test("seller product registration requires authentication", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/product/seller/create",
    payload: commonPayload(),
  });

  assert.equal(response.statusCode, 401);
});

test("seller product registration derives seller ID from JWT", async (t) => {
  const app = buildTestApp({
    async createSellerProduct(input, receivedSellerId) {
      assert.equal(receivedSellerId, sellerId);
      assert.equal(input.seller_id, undefined);
      return { _id: "seller-product-id", ...input, seller_id: receivedSellerId };
    },
  });
  t.after(() => app.close());
  const token = await sellerToken(app);

  const response = await app.inject({
    method: "POST",
    url: "/product/seller/create",
    headers: { authorization: `Bearer ${token}` },
    payload: commonPayload(),
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.seller_id, sellerId);
});

test("seller product registration rejects controlled and mismatched fields", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());
  const token = await sellerToken(app);

  const withSellerId = await app.inject({
    method: "POST",
    url: "/product/seller/create",
    headers: { authorization: `Bearer ${token}` },
    payload: { ...commonPayload(), seller_id: sellerId },
  });
  const individualWithMasterId = await app.inject({
    method: "POST",
    url: "/product/seller/create",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      shop_id: shopId,
      product_type: "individual",
      product_id: productId,
      product_name: "Rice",
      brand_name: "Local",
      product_category_id: variantId,
      variants: [
        {
          label: "1 kg",
          quantity_value: 1,
          quantity_unit: "kg",
          price: 80,
        },
      ],
    },
  });

  assert.equal(withSellerId.statusCode, 400);
  assert.equal(individualWithMasterId.statusCode, 400);
});

test("individual registration does not require product_id", async (t) => {
  const app = buildTestApp({
    async createSellerProduct(input, receivedSellerId) {
      assert.equal(receivedSellerId, sellerId);
      assert.equal(Object.hasOwn(input, "product_id"), false);
      return { _id: "seller-product-id", ...input };
    },
  });
  t.after(() => app.close());
  const token = await sellerToken(app);

  const response = await app.inject({
    method: "POST",
    url: "/product/seller/create",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      shop_id: shopId,
      product_type: "individual",
      product_name: "Rice",
      brand_name: "Local",
      product_category_id: variantId,
      variants: [
        {
          label: "1 kg",
          quantity_value: 1,
          quantity_unit: "kg",
          price: 80,
        },
      ],
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.product_id, undefined);
});

test("seller product registration rejects client supplied seller SKU", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());
  const token = await sellerToken(app);
  const payload = commonPayload();
  payload.variants[0].seller_sku = "CLIENT-SKU";

  const response = await app.inject({
    method: "POST",
    url: "/product/seller/create",
    headers: { authorization: `Bearer ${token}` },
    payload,
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "seller_sku must not be provided");
});

test("seller product update requires authentication and valid input", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());

  const unauthenticated = await app.inject({
    method: "PATCH",
    url: "/product",
    payload: { product_id: productId, is_active: false },
  });
  const token = await sellerToken(app);
  const missingId = await app.inject({
    method: "PATCH",
    url: "/product",
    headers: { authorization: `Bearer ${token}` },
    payload: { is_active: false },
  });
  const invalidId = await app.inject({
    method: "PATCH",
    url: "/product",
    headers: { authorization: `Bearer ${token}` },
    payload: { product_id: "invalid", is_active: false },
  });

  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(missingId.statusCode, 400);
  assert.equal(invalidId.statusCode, 400);
});

test("seller product update derives seller ID and rejects controlled fields", async (t) => {
  let receivedSellerId;
  const app = buildTestApp({
    async updateSellerProduct(input, sellerId) {
      receivedSellerId = sellerId;
      return input;
    },
  });
  t.after(() => app.close());
  const token = await sellerToken(app);

  const updated = await app.inject({
    method: "PATCH",
    url: "/product",
    headers: { authorization: `Bearer ${token}` },
    payload: { product_id: productId, is_active: false },
  });
  const sellerSku = await app.inject({
    method: "PATCH",
    url: "/product",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      product_id: productId,
      variants: [{ product_variant_id: variantId, seller_sku: "CHANGED" }],
    },
  });
  const immutable = await app.inject({
    method: "PATCH",
    url: "/product",
    headers: { authorization: `Bearer ${token}` },
    payload: { product_id: productId, shop_id: shopId },
  });

  assert.equal(updated.statusCode, 200);
  assert.deepEqual(updated.json(), {
    status: "success",
    message: "Seller product updated successfully",
    data: null,
  });
  assert.equal(receivedSellerId, sellerId);
  assert.equal(sellerSku.statusCode, 400);
  assert.equal(immutable.statusCode, 400);
});

test("seller product update rejects invalid pricing and inventory", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());
  const token = await sellerToken(app);

  for (const field of ["price", "mrp", "product_quantity", "available_quantity"]) {
    const response = await app.inject({
      method: "PATCH",
      url: "/product",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        product_id: productId,
        variants: [{ product_variant_id: variantId, [field]: -1 }],
      },
    });
    assert.equal(response.statusCode, 400);
  }
});

test("seller product deletion requires authentication and validates ID", async (t) => {
  const app = buildTestApp({});
  t.after(() => app.close());

  const unauthenticated = await app.inject({
    method: "DELETE",
    url: `/product/${productId}`,
  });
  const invalidId = await app.inject({
    method: "DELETE",
    url: "/product/not-an-id",
    headers: { authorization: `Bearer ${await sellerToken(app)}` },
  });

  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(invalidId.statusCode, 400);
});

test("seller product deletion derives ownership and returns no details", async (t) => {
  let received;
  const app = buildTestApp({
    async deleteSellerProduct(receivedProductId, receivedSellerId) {
      received = { receivedProductId, receivedSellerId };
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "DELETE",
    url: `/product/${productId}`,
    headers: { authorization: `Bearer ${await sellerToken(app)}` },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(received, {
    receivedProductId: productId,
    receivedSellerId: sellerId,
  });
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Seller product deleted successfully",
    data: null,
  });
});
