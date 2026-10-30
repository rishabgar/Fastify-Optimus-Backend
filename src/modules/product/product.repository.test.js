import assert from "node:assert/strict";
import { test } from "node:test";
import sellerProductModel from "../seller-product/seller-product.model.js";
import { productRepository } from "./product.repository.js";

const shopId = "64b000000000000000000001";
const categoryId = "64b000000000000000000002";

test("public product aggregation resolves and paginates seller products", async (t) => {
  const originalAggregate = sellerProductModel.aggregate;
  let pipeline;
  sellerProductModel.aggregate = async (receivedPipeline) => {
    pipeline = receivedPipeline;
    return [];
  };
  t.after(() => {
    sellerProductModel.aggregate = originalAggregate;
  });

  await productRepository.listByShopAndCategory({
    shopId,
    categoryId,
    skip: 10,
    limit: 5,
  });

  assert.equal(pipeline[0].$match.shop_id.toString(), shopId);
  assert.equal(pipeline[0].$match.is_active, true);
  assert.equal(pipeline[0].$match.is_deleted, false);
  assert.ok(pipeline.some((stage) => stage.$lookup));

  const resolvedProjection = pipeline.find(
    (stage) => stage.$project?.variant,
  ).$project;
  assert.equal(resolvedProjection.product_id, "$_id");
  assert.ok(resolvedProjection.product_name.$cond);
  assert.equal(resolvedProjection.product_name_override, undefined);

  assert.ok(pipeline.some((stage) => stage.$skip === 10));
  assert.ok(pipeline.some((stage) => stage.$limit === 5));
  assert.equal(
    pipeline.some((stage) => stage.$facet),
    false,
  );
});

test("shop product aggregation applies public filters after resolving products", async (t) => {
  const originalAggregate = sellerProductModel.aggregate;
  let pipeline;
  sellerProductModel.aggregate = async (receivedPipeline) => {
    pipeline = receivedPipeline;
    return [];
  };
  t.after(() => {
    sellerProductModel.aggregate = originalAggregate;
  });

  await productRepository.listByShop({
    shopId,
    skip: 0,
    limit: 20,
    search: "rice",
    productType: "common",
    inStock: true,
    sortBy: "price",
    sortDirection: "asc",
  });

  assert.equal(pipeline[0].$match.product_type, "common");
  assert.deepEqual(pipeline[0].$match.variants, {
    $elemMatch: { is_active: true, available_quantity: { $gt: 0 } },
  });
  assert.ok(
    pipeline.some(
      (stage) =>
        stage.$match?.$or?.[0]?.product_name?.$regex === "rice" &&
        stage.$match.$or[1].brand_name.$regex === "rice" &&
        stage.$match.$or[2].product_description.$regex === "rice",
    ),
  );
  assert.ok(
    pipeline.some(
      (stage) => stage.$sort?.minimum_price === 1 && stage.$sort?._id === 1,
    ),
  );

  const finalProjection = pipeline.at(-1).$project;
  assert.equal(finalProjection.product_id, "$_id");
  assert.equal(finalProjection.minimum_price, undefined);
  assert.equal(finalProjection.product_name_override, undefined);
  assert.equal(finalProjection.reserved_quantity, undefined);

  const resolvedProjection = pipeline.find(
    (stage) => stage.$project?.variant,
  ).$project;
  assert.equal(resolvedProjection.variant.sku, "$variants.seller_sku");
  assert.equal(resolvedProjection.variant.seller_sku, undefined);
});
