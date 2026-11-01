import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../app.js";

const jwtSecret = "test-jwt-secret";
const ids = {
  cart: "64b000000000000000000001",
  user: "64b000000000000000000002",
  product: "64b000000000000000000003",
  shop: "64b000000000000000000004",
  category: "64b000000000000000000005",
  variant: "64b000000000000000000006",
};

function cartData(quantity = 1) {
  return {
    id: ids.cart,
    user_id: ids.user,
    items: [
      {
        seller_product_id: ids.product,
        shop_id: ids.shop,
        product_category_id: ids.category,
        variant_id: ids.variant,
        quantity,
      },
    ],
  };
}

async function customerToken(app) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/admin/login",
    payload: { user_email: "customer@example.com", password: "secret123" },
  });
  return response.json().data.token;
}

test("POST /cart adds an item", async (t) => {
  let receivedInput;
  let receivedUserId;
  const cartService = {
    async addItem(userId, input) {
      receivedUserId = userId;
      receivedInput = input;
      return cartData(input.quantity ?? 1);
    },
  };
  const app = buildApp({
    connectDatabase: false,
    jwtSecret,
    cartService,
    authService: {
      async loginAdmin() {
        return { user_id: ids.user, role: "customer" };
      },
    },
  });
  t.after(() => app.close());
  const token = await customerToken(app);

  const response = await app.inject({
    method: "POST",
    url: "/cart",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      seller_product_id: ids.product,
      variant_id: ids.variant,
      quantity: 2,
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(receivedUserId, ids.user);
  assert.equal(receivedInput.quantity, 2);
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Item added to cart successfully",
    data: null,
  });
});

test("PATCH /cart updates an item", async (t) => {
  let receivedUserId;
  const cartService = {
    async updateItem(userId, input) {
      receivedUserId = userId;
      assert.equal(input.variant_id, ids.variant);
      return cartData(input.quantity);
    },
  };
  const app = buildApp({
    connectDatabase: false,
    jwtSecret,
    cartService,
    authService: {
      async loginAdmin() {
        return { user_id: ids.user, role: "customer" };
      },
    },
  });
  t.after(() => app.close());
  const token = await customerToken(app);

  const response = await app.inject({
    method: "PATCH",
    url: "/cart",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      seller_product_id: ids.product,
      variant_id: ids.variant,
      quantity: 3,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(receivedUserId, ids.user);
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Cart item updated successfully",
    data: null,
  });
});

test("PATCH /cart requires authentication and strips controlled fields", async (t) => {
  const cartService = {
    async updateItem(userId, input) {
      assert.equal(userId, ids.user);
      assert.equal(Object.hasOwn(input, "user_id"), false);
      return cartData(input.quantity);
    },
  };
  const app = buildApp({
    connectDatabase: false,
    jwtSecret,
    cartService,
    authService: {
      async loginAdmin() {
        return { user_id: ids.user, role: "customer" };
      },
    },
  });
  t.after(() => app.close());

  const missingToken = await app.inject({
    method: "PATCH",
    url: "/cart",
    payload: {
      seller_product_id: ids.product,
      variant_id: ids.variant,
      quantity: 2,
    },
  });
  const token = await customerToken(app);
  const controlledFields = await app.inject({
    method: "PATCH",
    url: "/cart",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      user_id: ids.user,
      seller_product_id: ids.product,
      variant_id: ids.variant,
      quantity: 2,
    },
  });

  assert.equal(missingToken.statusCode, 401);
  assert.equal(controlledFields.statusCode, 200);
});

test("DELETE /cart removes a scoped item", async (t) => {
  const cartService = {
    async removeItem(userId, identity) {
      assert.equal(userId, ids.user);
      assert.equal(identity.seller_product_id, ids.product);
      assert.equal(identity.shop_id, ids.shop);
      assert.equal(identity.product_category_id, ids.category);
      return { ...cartData(), items: [] };
    },
  };
  const app = buildApp({ connectDatabase: false, jwtSecret, cartService });
  t.after(() => app.close());

  const response = await app.inject({
    method: "DELETE",
    url:
      `/cart/seller_product_id/${ids.product}/shop_id/${ids.shop}` +
      `/product_category_id/${ids.category}?user_id=${ids.user}`,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.items, []);
});

test("DELETE /cart succeeds when the cart item does not exist", async (t) => {
  const cartService = {
    async removeItem() {
      return null;
    },
  };
  const app = buildApp({ connectDatabase: false, jwtSecret, cartService });
  t.after(() => app.close());

  const response = await app.inject({
    method: "DELETE",
    url:
      `/cart/seller_product_id/${ids.product}/shop_id/${ids.shop}` +
      `/product_category_id/${ids.category}?user_id=${ids.user}`,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Cart item removed successfully",
    data: null,
  });
});

test("GET /cart returns grouped items for the authenticated customer", async (t) => {
  const groupedCart = [
    {
      shop_id: ids.shop,
      items: [
        {
          seller_product_id: ids.product,
          variant_id: ids.variant,
          variant_sku: "SKU-1",
          variant_label: "1 kg",
          product_name: "Rice",
          product_price: 95,
          product_availability: false,
          available_quantity: 1,
          quantity: 2,
        },
      ],
    },
  ];
  const cartService = {
    async getCart(userId) {
      assert.equal(userId, ids.user);
      return groupedCart;
    },
  };
  const app = buildApp({
    connectDatabase: false,
    jwtSecret,
    cartService,
    authService: {
      async loginAdmin() {
        return { user_id: ids.user, role: "customer" };
      },
    },
  });
  t.after(() => app.close());
  const token = await customerToken(app);

  const response = await app.inject({
    method: "GET",
    url: "/cart",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, groupedCart);
});

test("GET /cart requires customer authentication", async (t) => {
  const app = buildApp({ connectDatabase: false, jwtSecret, cartService: {} });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/cart" });

  assert.equal(response.statusCode, 401);
});
