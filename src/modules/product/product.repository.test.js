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

  const facet = pipeline.find((stage) => stage.$facet).$facet;
  assert.ok(facet);
  assert.ok(facet.items.some((stage) => stage.$skip === 10));
  assert.ok(facet.items.some((stage) => stage.$limit === 5));
  assert.deepEqual(facet.metadata, [{ $count: "total" }]);
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
  const facet = pipeline.find((stage) => stage.$facet).$facet;
  assert.ok(
    facet.items.some(
      (stage) => stage.$sort?.minimum_price === 1 && stage.$sort?._id === 1,
    ),
  );

  const finalProjection = facet.items.at(-1).$project;
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

test("shop product summary aggregation returns only the requested fields", async (t) => {
  const originalAggregate = sellerProductModel.aggregate;
  let pipeline;
  sellerProductModel.aggregate = async (receivedPipeline) => {
    pipeline = receivedPipeline;
    return [];
  };
  t.after(() => {
    sellerProductModel.aggregate = originalAggregate;
  });

  await productRepository.listSummaryByShop({ shopId, skip: 5, limit: 5 });

  assert.equal(pipeline[0].$match.shop_id.toString(), shopId);
  assert.ok(pipeline.some((stage) => stage.$lookup));

  const facet = pipeline.find((stage) => stage.$facet).$facet;
  assert.ok(facet.items.some((stage) => stage.$skip === 5));
  assert.ok(facet.items.some((stage) => stage.$limit === 5));
  assert.deepEqual(facet.items.at(-1).$project, {
    _id: 0,
    product_id: "$_id",
    product_name: 1,
    brand_name: 1,
    product_images: 1,
    variants: 1,
  });

  const variantProjection = pipeline.find(
    (stage) => stage.$project?.variant,
  ).$project.variant;
  assert.deepEqual(Object.keys(variantProjection), [
    "label",
    "available_quantity",
  ]);
});

test("category summary filters resolved products and returns only summary fields", async (t) => {
  const originalAggregate = sellerProductModel.aggregate;
  let pipeline;
  sellerProductModel.aggregate = async (receivedPipeline) => {
    pipeline = receivedPipeline;
    return [];
  };
  t.after(() => {
    sellerProductModel.aggregate = originalAggregate;
  });

  await productRepository.listSummaryByShopAndCategory({
    shopId,
    categoryId,
    skip: 0,
    limit: 20,
  });

  const lookup = pipeline.find((stage) => stage.$lookup).$lookup;
  assert.ok(
    lookup.pipeline[0].$match.$expr.$and.some(
      (condition) => condition.$eq?.[0] === "$product_category_id",
    ),
  );

  const facet = pipeline.find((stage) => stage.$facet).$facet;
  assert.deepEqual(facet.items.at(-1).$project, {
    _id: 0,
    product_id: "$_id",
    product_name: 1,
    brand_name: 1,
    product_images: 1,
    product_category_id: 1,
    variants: 1,
  });

  const variantProjection = pipeline.find(
    (stage) => stage.$project?.variant,
  ).$project.variant;
  assert.deepEqual(Object.keys(variantProjection), [
    "product_variant_id",
    "label",
    "available_quantity",
  ]);
});
