import assert from "node:assert/strict";
import { test } from "node:test";
import productModel from "../product/product.model.js";
import sellerProductModel from "../seller-product/seller-product.model.js";
import shopModel from "../shop/shop.model.js";
import productCategoryModel from "./product-category.model.js";
import { productCategoryRepository } from "./product-category.repository.js";

const shopId = "64b000000000000000000003";
const shopTypeId = "64b000000000000000000004";

function captureAggregate(t) {
  const originalAggregate = shopModel.aggregate;
  let pipeline;
  shopModel.aggregate = (receivedPipeline) => {
    pipeline = receivedPipeline;
    return receivedPipeline;
  };
  t.after(() => {
    shopModel.aggregate = originalAggregate;
  });
  return () => pipeline;
}

test("shop category aggregation resolves both seller product types", (t) => {
  const getPipeline = captureAggregate(t);

  productCategoryRepository.listByShop(shopId);
  const pipeline = getPipeline();

  assert.equal(pipeline[0].$match._id.toString(), shopId);
  assert.equal(pipeline[0].$match.is_active, true);
  assert.equal(pipeline[0].$match.is_deleted, false);
  assert.equal(pipeline[1].$lookup.from, sellerProductModel.collection.name);

  const productLookup = pipeline.find(
    (stage) => stage.$lookup?.from === productModel.collection.name,
  );
  assert.ok(productLookup);

  const categoryResolution = pipeline.find(
    (stage) => stage.$set?.resolved_category_id,
  ).$set.resolved_category_id.$cond;
  assert.deepEqual(categoryResolution[0], {
    $eq: ["$product_type", "common"],
  });
  assert.equal(categoryResolution[1].$arrayElemAt[0], "$master_product.product_category_id");
  assert.equal(categoryResolution[2], "$product_category_id");

  const categoryLookup = pipeline.find(
    (stage) => stage.$lookup?.from === productCategoryModel.collection.name,
  );
  assert.ok(categoryLookup);
  assert.deepEqual(pipeline.at(-1), {
    $sort: { sort_order: 1, product_category_name: 1 },
  });
});

test("shop type lookup uses the direct category mapping", (t) => {
  const originalFind = productCategoryModel.find;
  let filter;
  let projection;
  let sort;
  productCategoryModel.find = (receivedFilter) => {
    filter = receivedFilter;
    return {
      select(receivedProjection) {
        projection = receivedProjection;
        return this;
      },
      sort(receivedSort) {
        sort = receivedSort;
        return this;
      },
      collation() {
        return this;
      },
      lean() {
        return [];
      },
    };
  };
  t.after(() => {
    productCategoryModel.find = originalFind;
  });

  productCategoryRepository.listByShopType(shopTypeId);

  assert.deepEqual(filter, {
    shop_type_ids: shopTypeId,
    is_active: true,
    is_deleted: false,
  });
  assert.match(projection, /product_category_name/);
  assert.deepEqual(sort, { sort_order: 1, product_category_name: 1 });
});
