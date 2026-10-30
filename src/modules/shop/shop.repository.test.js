import assert from "node:assert/strict";
import { test } from "node:test";
import shopModel from "./shop.model.js";
import { shopRepository } from "./shop.repository.js";

const sellerId = "64b000000000000000000001";
const shopId = "64b000000000000000000002";

test("seller shop detail query enforces ownership and soft deletion", async (t) => {
  const originalFindOne = shopModel.findOne;
  let filter;
  let selectedFields;
  shopModel.findOne = (receivedFilter) => {
    filter = receivedFilter;
    return {
      select(fields) {
        selectedFields = fields;
        return this;
      },
      async lean() {
        return null;
      },
    };
  };
  t.after(() => {
    shopModel.findOne = originalFindOne;
  });

  await shopRepository.findOwnedDetail(shopId, sellerId);

  assert.deepEqual(filter, {
    _id: shopId,
    seller_id: sellerId,
    is_deleted: false,
  });
  assert.deepEqual(selectedFields.split(" ").sort(), [
    "_id",
    "is_closed",
    "operating_hours",
    "seller_location",
    "shop_address",
    "shop_image",
    "shop_name",
  ]);
});

test("nearby shop query is unpaginated and nearest-first", async (t) => {
  const originalAggregate = shopModel.aggregate;
  let pipeline;
  shopModel.aggregate = async (receivedPipeline) => {
    pipeline = receivedPipeline;
    return [];
  };
  t.after(() => {
    shopModel.aggregate = originalAggregate;
  });

  const result = await shopRepository.listNearby({
    coordinates: [77.5, 12.9],
    maxDistance: 1000,
    match: { is_active: true, is_deleted: false },
  });

  assert.deepEqual(result, []);
  assert.deepEqual(pipeline[0], {
    $geoNear: {
      near: { type: "Point", coordinates: [77.5, 12.9] },
      distanceField: "distance",
      maxDistance: 1000,
      spherical: true,
      query: { is_active: true, is_deleted: false },
    },
  });
  assert.equal(
    pipeline.some(
      (stage) =>
        "$facet" in stage ||
        "$skip" in stage ||
        "$limit" in stage ||
        "$count" in stage,
    ),
    false,
  );
});
