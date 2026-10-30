import assert from "node:assert/strict";
import { test } from "node:test";
import sellerProductModel from "../seller-product/seller-product.model.js";
import shopModel from "../shop/shop.model.js";
import productModel from "./product.model.js";
import { listNearbyProducts } from "./nearby-product.repository.js";

const ids = {
  shopType: "64b000000000000000000001",
  category: "64b000000000000000000002",
};

test("nearby product aggregation filters and resolves sellable products", async (t) => {
  const originalAggregate = shopModel.aggregate;
  let pipeline;
  shopModel.aggregate = async (receivedPipeline) => {
    pipeline = receivedPipeline;
    return [];
  };
  t.after(() => {
    shopModel.aggregate = originalAggregate;
  });

  const result = await listNearbyProducts({
    latitude: 28.6139,
    longitude: 77.209,
    shopTypeId: ids.shopType,
    maxDistance: 10000,
    categoryId: ids.category,
    productType: "common",
    inStock: true,
    sortBy: "price",
    sortOrder: "desc",
    skip: 20,
    limit: 10,
  });

  assert.deepEqual(result, []);
  assert.deepEqual(pipeline[0].$geoNear.near.coordinates, [77.209, 28.6139]);
  assert.equal(pipeline[0].$geoNear.maxDistance, 10000);
  assert.equal(
    pipeline[0].$geoNear.query.shop_type_id.toString(),
    ids.shopType,
  );
  assert.equal(pipeline[0].$geoNear.query.is_active, true);
  assert.equal(pipeline[0].$geoNear.query.is_deleted, false);

  const sellerLookup = pipeline.find(
    (stage) => stage.$lookup?.from === sellerProductModel.collection.name,
  ).$lookup;
  const sellerMatch = sellerLookup.pipeline[0].$match;
  assert.equal(sellerMatch.is_active, true);
  assert.equal(sellerMatch.is_deleted, false);
  assert.equal(sellerMatch.product_type, "common");
  assert.deepEqual(sellerMatch.variants, {
    $elemMatch: { is_active: true, available_quantity: { $gt: 0 } },
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
  assert.equal(group.minimum_price.$min, "$variant.price");
  assert.ok(
    pipeline.some(
      (stage) =>
        stage.$sort?.minimum_price === -1 && stage.$sort?.distance === 1,
    ),
  );
  assert.ok(pipeline.some((stage) => stage.$skip === 20));
  assert.ok(pipeline.some((stage) => stage.$limit === 10));
});

test("nearby product aggregation defaults to stable distance sorting", async (t) => {
  const originalAggregate = shopModel.aggregate;
  let pipeline;
  shopModel.aggregate = async (receivedPipeline) => {
    pipeline = receivedPipeline;
    return [];
  };
  t.after(() => {
    shopModel.aggregate = originalAggregate;
  });

  await listNearbyProducts({
    latitude: 0,
    longitude: 0,
    shopTypeId: ids.shopType,
    maxDistance: 1000,
    sortBy: "distance",
    sortOrder: "asc",
    skip: 0,
    limit: 20,
  });

  assert.ok(
    pipeline.some(
      (stage) => stage.$sort?.distance === 1 && stage.$sort?._id === 1,
    ),
  );
});
