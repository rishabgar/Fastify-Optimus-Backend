import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import { createCartService } from "./cart.service.js";

const ids = {
  cart: "64b000000000000000000001",
  user: "64b000000000000000000002",
  product: "64b000000000000000000003",
  shop: "64b000000000000000000004",
  category: "64b000000000000000000005",
  variant: "64b000000000000000000006",
};

function item(variantId = ids.variant, quantity = 1) {
  return {
    product_id: ids.product,
    shop_id: ids.shop,
    product_category_id: ids.category,
    variant_id: variantId,
    quantity,
  };
}

function cart(items = [item()]) {
  return { _id: ids.cart, user_id: ids.user, items };
}

test("cart service creates a cart for the first item", async () => {
  let createdCart;
  const service = createCartService({
    repository: {
      async findSellableItem() {
        return { ...item(), available_quantity: 5 };
      },
      async findByUserId() {
        return null;
      },
      async create(input) {
        createdCart = input;
        return { _id: ids.cart, ...input };
      },
    },
  });

  const result = await service.addItem(ids.user, {
    product_id: ids.product,
    variant_id: ids.variant,
  });

  assert.deepEqual(createdCart, { user_id: ids.user, items: [item()] });
  assert.equal(result.items.length, 1);
});

test("cart service treats a duplicate item as a successful no-op", async () => {
  const existingCart = cart([
    {
      ...item(),
      product_id: new Types.ObjectId(ids.product),
      shop_id: new Types.ObjectId(ids.shop),
      product_category_id: new Types.ObjectId(ids.category),
      variant_id: new Types.ObjectId(ids.variant),
    },
  ]);
  let saved = false;
  const service = createCartService({
    repository: {
      async findSellableItem() {
        return { ...item(), available_quantity: 5 };
      },
      async findByUserId() {
        return existingCart;
      },
      async save() {
        saved = true;
      },
    },
  });

  const result = await service.addItem(ids.user, {
    product_id: ids.product,
    variant_id: ids.variant,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].variant_id, ids.variant);
  assert.equal(saved, false);
});

test("cart service rejects an unavailable product variant", async () => {
  const service = createCartService({
    repository: {
      async findSellableItem() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.addItem(ids.user, {
      product_id: ids.product,
      variant_id: ids.variant,
    }),
    { statusCode: 404, message: "Product variant is unavailable" },
  );
});

test("cart service rejects quantity above available stock", async () => {
  const service = createCartService({
    repository: {
      async findSellableItem() {
        return { ...item(), available_quantity: 2 };
      },
    },
  });

  await assert.rejects(
    service.addItem(ids.user, {
      product_id: ids.product,
      variant_id: ids.variant,
      quantity: 3,
    }),
    { statusCode: 409, message: "Available quantity: 2" },
  );
});

test("cart service updates an item's quantity", async () => {
  const service = createCartService({
    repository: {
      async findSellableItem(productId, variantId) {
        assert.equal(productId, ids.product);
        assert.equal(variantId, ids.variant);
        return { ...item(), available_quantity: 5 };
      },
      async updateItem(userId, identity, updates) {
        assert.equal(userId, ids.user);
        assert.equal(identity.variant_id, ids.variant);
        assert.deepEqual(updates, { quantity: 4 });
        return cart([item(ids.variant, updates.quantity)]);
      },
    },
  });

  const result = await service.updateItem(ids.user, {
    product_id: ids.product,
    variant_id: ids.variant,
    quantity: 4,
  });

  assert.equal(result.items[0].quantity, 4);
});

test("cart service rejects unavailable or insufficient update inventory", async () => {
  let availableItem = null;
  const service = createCartService({
    repository: {
      async findSellableItem() {
        return availableItem;
      },
      async updateItem() {
        assert.fail("cart must not update when inventory is unavailable");
      },
    },
  });

  await assert.rejects(
    service.updateItem(ids.user, {
      product_id: ids.product,
      variant_id: ids.variant,
      quantity: 2,
    }),
    { statusCode: 404, message: "Product variant is unavailable" },
  );

  availableItem = { ...item(), available_quantity: 1 };
  await assert.rejects(
    service.updateItem(ids.user, {
      product_id: ids.product,
      variant_id: ids.variant,
      quantity: 2,
    }),
    { statusCode: 409, message: "Available quantity: 1" },
  );
});

test("cart service removes matching product variants", async () => {
  const service = createCartService({
    repository: {
      async removeItem(userId, identity) {
        assert.equal(userId, ids.user);
        assert.equal(identity.product_id, ids.product);
        return cart([]);
      },
    },
  });

  const result = await service.removeItem(ids.user, {
    product_id: ids.product,
    shop_id: ids.shop,
    product_category_id: ids.category,
  });

  assert.deepEqual(result.items, []);
});

test("cart service succeeds when removing from a missing cart", async () => {
  const service = createCartService({
    repository: {
      async removeItem() {
        return null;
      },
    },
  });

  const result = await service.removeItem(ids.user, {
    product_id: ids.product,
    shop_id: ids.shop,
    product_category_id: ids.category,
  });

  assert.equal(result, null);
});

test("cart service returns grouped cart items and supports an empty cart", async () => {
  const expected = [{ shop_id: ids.shop, items: [item()] }];
  let result = expected;
  const service = createCartService({
    repository: {
      async getItemsByUserId(userId) {
        assert.equal(userId, ids.user);
        return result;
      },
    },
  });

  assert.equal(await service.getCart(ids.user), expected);
  result = [];
  assert.deepEqual(await service.getCart(ids.user), []);
});
