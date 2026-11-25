import assert from "node:assert/strict";
import { test } from "node:test";
import productModel from "../product/product.model.js";
import { sellerProductRepository } from "./seller-product.repository.js";

test("available master product query returns only selection fields", async (t) => {
  const originalAggregate = productModel.aggregate;
  let pipeline;
  productModel.aggregate = async (receivedPipeline) => {
    pipeline = receivedPipeline;
    return [{ items: [], total: 0 }];
  };
  t.after(() => {
    productModel.aggregate = originalAggregate;
  });

  await sellerProductRepository.listAvailableMasterProducts({
    shopId: "64b000000000000000000001",
    categoryIds: ["64b000000000000000000002"],
    search: "rice",
    skip: 0,
    limit: 20,
  });

  const facet = pipeline.find((stage) => stage.$facet).$facet;
  const projection = facet.items.at(-1).$project;
  assert.deepEqual(Object.keys(projection).sort(), [
    "_id",
    "brand_name",
    "product_id",
    "product_images",
    "product_name",
    "variants",
  ]);
  assert.deepEqual(Object.keys(projection.variants.$map.in).sort(), [
    "label",
    "product_variant_id",
  ]);
});
