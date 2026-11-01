import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import cartModel from "./cart.model.js";

test("cart model validates items and applies defaults", async () => {
  const cart = new cartModel({
    user_id: new Types.ObjectId(),
    items: [
      {
        seller_product_id: new Types.ObjectId(),
        shop_id: new Types.ObjectId(),
        product_category_id: new Types.ObjectId(),
        variant_id: new Types.ObjectId(),
      },
    ],
  });

  await cart.validate();

  assert.ok(cart.items[0].variant_id);
  assert.equal(cart.items[0].quantity, 1);
  assert.equal(cart.items[0]._id, undefined);
});

test("cart model defines a unique user index", () => {
  const userIndex = cartModel.schema
    .indexes()
    .find(([fields]) => fields.user_id === 1);

  assert.deepEqual(userIndex, [
    { user_id: 1 },
    { unique: true, name: "cart_user_id_unique_idx" },
  ]);
});
