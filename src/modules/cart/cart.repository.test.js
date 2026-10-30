import assert from "node:assert/strict";
import { test } from "node:test";
import cartModel from "./cart.model.js";
import productModel from "../product/product.model.js";
import sellerProductModel from "../seller-product/seller-product.model.js";
import shopModel from "../shop/shop.model.js";
import { cartRepository } from "./cart.repository.js";

const userId = "64b000000000000000000001";

test("cart item aggregation resolves products and groups them by shop", async (t) => {
  const originalAggregate = cartModel.aggregate;
  let pipeline;
  cartModel.aggregate = async (receivedPipeline) => {
    pipeline = receivedPipeline;
    return [];
  };
  t.after(() => {
    cartModel.aggregate = originalAggregate;
  });

  assert.deepEqual(await cartRepository.getItemsByUserId(userId), []);
  assert.equal(pipeline[0].$match.user_id.toString(), userId);

  const lookupCollections = pipeline
    .filter((stage) => stage.$lookup)
    .map((stage) => stage.$lookup.from);
  assert.deepEqual(lookupCollections, [
    sellerProductModel.collection.name,
    shopModel.collection.name,
    productModel.collection.name,
  ]);

  const itemProjection = pipeline.find(
    (stage) => stage.$project?.item,
  ).$project.item;
  assert.equal(itemProjection.product_id.$toString, "$seller_product._id");
  assert.equal(itemProjection.variant_id.$toString, "$seller_variant._id");
  assert.equal(itemProjection.variant_sku, "$seller_variant.seller_sku");
  assert.equal(itemProjection.product_price, "$seller_variant.price");
  assert.equal(
    itemProjection.available_quantity,
    "$seller_variant.available_quantity",
  );
  assert.ok(itemProjection.product_availability.$and);

  const group = pipeline.find((stage) => stage.$group).$group;
  assert.equal(group._id, "$shop_id");
  assert.deepEqual(group.items, { $push: "$item" });
});
