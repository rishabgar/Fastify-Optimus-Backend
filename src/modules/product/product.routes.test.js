import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../app.js";

const shopId = "64b000000000000000000001";
const categoryId = "64b000000000000000000002";
const adminId = "64b000000000000000000003";
const jwtSecret = "test-jwt-secret";

async function authToken(app) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/admin/login",
    payload: { user_email: "admin@example.com", password: "secret123" },
  });
  return response.json().data.token;
}

function productApp(productService, role = "admin") {
  return buildApp({
    connectDatabase: false,
    jwtSecret,
    productService,
    authService: {
      async loginAdmin() {
        return { user_id: adminId, role };
      },
    },
  });
}

const validProduct = {
  product_name: "Rice",
  brand_name: "Farm",
  product_category_id: categoryId,
  product_images: [{ url: "https://example.com/rice.jpg", is_main: true }],
  variants: [
    {
      label: "1 kg",
      quantity_value: 1,
      quantity_unit: "kg",
      is_default: true,
    },
  ],
};

test("admin can create a master product", async (t) => {
  let received;
  const app = productApp({
      async create(input) {
        received = input;
        return { product_id: "product-id" };
      },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/product/admin/create",
    headers: { authorization: `Bearer ${await authToken(app)}` },
    payload: validProduct,
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().status, "success");
  assert.deepEqual(response.json().data, { product_id: "product-id" });
  assert.deepEqual(received, validProduct);
});

test("master product creation rejects sellers and unauthenticated users", async (t) => {
  const app = productApp({ async create() {} });
  const sellerApp = productApp({ async create() {} }, "seller");
  t.after(() => app.close());
  t.after(() => sellerApp.close());

  const unauthenticated = await app.inject({
    method: "POST",
    url: "/product/admin/create",
    payload: validProduct,
  });
  const seller = await sellerApp.inject({
    method: "POST",
    url: "/product/admin/create",
    headers: { authorization: `Bearer ${await authToken(sellerApp)}` },
    payload: validProduct,
  });

  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(seller.statusCode, 403);
  assert.deepEqual(seller.json(), {
    status: "fail",
    message: "Admin access is required",
    data: null,
  });
});

test("master product schema strips controlled and seller fields", async (t) => {
  const receivedInputs = [];
  const app = productApp({
    async create(input) {
      receivedInputs.push(input);
      return input;
    },
  });
  t.after(() => app.close());
  const token = await authToken(app);

  for (const controlledField of [
    ["is_deleted", false],
    ["price", 100],
    ["normalized_value", 1000],
  ]) {
    const [field, value] = controlledField;
    const payload =
      field === "normalized_value"
        ? {
            ...validProduct,
            variants: [{ ...validProduct.variants[0], [field]: value }],
          }
        : { ...validProduct, [field]: value };
    const response = await app.inject({
      method: "POST",
      url: "/product/admin/create",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    assert.equal(response.statusCode, 201);
  }

  assert.equal(receivedInputs[0].is_deleted, undefined);
  assert.equal(receivedInputs[1].price, undefined);
  assert.equal(receivedInputs[2].variants[0].normalized_value, undefined);
});

test("master product creation rejects client supplied SKUs", async (t) => {
  const app = productApp({ async create() {} });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/product/admin/create",
    headers: { authorization: `Bearer ${await authToken(app)}` },
    payload: {
      ...validProduct,
      variants: [{ ...validProduct.variants[0], sku: "CLIENT-SKU" }],
    },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    status: "fail",
    message: "sku must not be provided",
    data: null,
  });
});

test("shop category product listing is public", async (t) => {
  const app = buildApp({
    connectDatabase: false,
    productService: {
      async listByShopAndCategory(receivedShopId, receivedCategoryId, query) {
        assert.equal(receivedShopId, shopId);
        assert.equal(receivedCategoryId, categoryId);
        assert.equal(query.page, 2);
        assert.equal(query.limit, 5);
        return [{ product_id: "seller-product-id", variants: [] }];
      },
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: `/product/${shopId}/${categoryId}?page=2&limit=5`,
  });

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.json().data));
  assert.equal(response.json().data[0].product_id, "seller-product-id");
});

test("shop category product listing validates IDs and pagination", async (t) => {
  const app = buildApp({
    connectDatabase: false,
    productService: {},
  });
  t.after(() => app.close());

  const invalidId = await app.inject({
    method: "GET",
    url: `/product/not-an-id/${categoryId}`,
  });
  const invalidLimit = await app.inject({
    method: "GET",
    url: `/product/${shopId}/${categoryId}?limit=101`,
  });

  assert.equal(invalidId.statusCode, 400);
  assert.equal(invalidLimit.statusCode, 400);
});

test("shop product listing is public and forwards validated filters", async (t) => {
  const app = buildApp({
    connectDatabase: false,
    productService: {
      async listByShop(receivedShopId, query) {
        assert.equal(receivedShopId, shopId);
        assert.deepEqual({ ...query }, {
          page: 2,
          limit: 5,
          search: "rice",
          product_type: "common",
          in_stock: true,
          sort_by: "price",
          sort_direction: "asc",
        });
        return [{ product_id: "seller-product-id", variants: [] }];
      },
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url:
      `/product/${shopId}?page=2&limit=5&search=rice` +
      "&product_type=common&in_stock=true&sort_by=price&sort_direction=asc",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "success");
  assert.equal(response.json().data[0].product_id, "seller-product-id");
});

test("shop product listing validates IDs and query filters", async (t) => {
  const app = buildApp({
    connectDatabase: false,
    productService: {},
  });
  t.after(() => app.close());

  const invalidId = await app.inject({
    method: "GET",
    url: "/product/not-an-id",
  });
  const invalidType = await app.inject({
    method: "GET",
    url: `/product/${shopId}?product_type=unsupported`,
  });

  assert.equal(invalidId.statusCode, 400);
  assert.equal(invalidType.statusCode, 400);
});

test("nearby product listing is public and forwards validated input", async (t) => {
  const app = buildApp({
    connectDatabase: false,
    productService: {
      async listNearby(params, query) {
        assert.deepEqual({ ...params }, {
          latitude: 28.6139,
          longitude: 77.209,
          shop_type_id: categoryId,
        });
        assert.deepEqual({ ...query }, {
          distance: 25,
          distance_unit: "km",
          page: 2,
          limit: 5,
          sort_by: "price",
          sort_order: "desc",
          product_category_id: shopId,
          product_type: "common",
          in_stock: true,
        });
        return [{ product_id: "nearby-product" }];
      },
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url:
      `/product/${categoryId}/28.6139/77.209` +
      `?distance=25&page=2&limit=5&sort_by=price&sort_order=desc` +
      `&product_category_id=${shopId}&product_type=common&in_stock=true`,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data[0].product_id, "nearby-product");
});

test("nearby product listing validates coordinates, IDs, and distance", async (t) => {
  const app = buildApp({ connectDatabase: false, productService: {} });
  t.after(() => app.close());

  const responses = await Promise.all([
    app.inject({ method: "GET", url: `/product/${categoryId}/91/77` }),
    app.inject({ method: "GET", url: `/product/${categoryId}/28/181` }),
    app.inject({ method: "GET", url: "/product/not-an-id/28/77" }),
    app.inject({
      method: "GET",
      url: `/product/${categoryId}/28/77?distance=0`,
    }),
    app.inject({
      method: "GET",
      url: `/product/${categoryId}/28/77?distance=100001`,
    }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.statusCode),
    [400, 400, 400, 400, 400],
  );
});

test("nearby product listing accepts distance in metres", async (t) => {
  const app = buildApp({
    connectDatabase: false,
    productService: {
      async listNearby(params, query) {
        assert.equal(query.distance, 5000);
        assert.equal(query.distance_unit, "m");
        return [];
      },
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: `/product/${categoryId}/28/77?distance=5000&distance_unit=m`,
  });

  assert.equal(response.statusCode, 200);
});

test("product detail is public and uses the seller-product ID", async (t) => {
  const app = buildApp({
    connectDatabase: false,
    productService: {
      async getDetail(receivedProductId) {
        assert.equal(receivedProductId, shopId);
        return { product_id: receivedProductId, variants: [] };
      },
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: `/product/details/${shopId}`,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.product_id, shopId);
});

test("product detail validates the product ID", async (t) => {
  const app = buildApp({ connectDatabase: false, productService: {} });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/product/details/not-an-id",
  });

  assert.equal(response.statusCode, 400);
});
