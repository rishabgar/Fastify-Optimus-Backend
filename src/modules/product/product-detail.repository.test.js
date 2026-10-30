import assert from "node:assert/strict";
import { test } from "node:test";
import sellerProductModel from "../seller-product/seller-product.model.js";
import shopModel from "../shop/shop.model.js";
import productModel from "./product.model.js";
import { getPublicProductDetail } from "./product-detail.repository.js";

const productId = "64b000000000000000000001";

test("product detail aggregation resolves one public seller product", async (t) => {
  const originalAggregate = sellerProductModel.aggregate;
  let pipeline;
  sellerProductModel.aggregate = async (receivedPipeline) => {
    pipeline = receivedPipeline;
    return [];
  };
  t.after(() => {
    sellerProductModel.aggregate = originalAggregate;
  });

  assert.equal(await getPublicProductDetail(productId), null);
  assert.equal(pipeline[0].$match._id.toString(), productId);
  assert.equal(pipeline[0].$match.is_active, true);
  assert.equal(pipeline[0].$match.is_deleted, false);

  const shopLookup = pipeline.find(
    (stage) => stage.$lookup?.from === shopModel.collection.name,
  ).$lookup;
  assert.deepEqual(shopLookup.pipeline[0].$match, {
    is_active: true,
    is_deleted: false,
  });

  const masterLookup = pipeline.find(
    (stage) => stage.$lookup?.from === productModel.collection.name,
  ).$lookup;
  assert.ok(masterLookup);

  const resolvedProjection = pipeline.find(
    (stage) => stage.$project?.variant,
  ).$project;
  assert.ok(resolvedProjection.product_name.$cond);
  assert.ok(resolvedProjection.product_description.$ifNull);
  assert.ok(resolvedProjection.product_images.$cond);
  assert.equal(resolvedProjection.variant.sku, "$variants.seller_sku");
  assert.equal(resolvedProjection.variant.reserved_quantity, undefined);
  assert.equal(resolvedProjection.product_name_override, undefined);

  const group = pipeline.find((stage) => stage.$group).$group;
  assert.equal(group._id, "$product_id");
  const finalProjection = pipeline.at(-1).$project;
  assert.equal(finalProjection.product_id, "$_id");
  assert.equal(finalProjection.seller_product_id, undefined);
});
