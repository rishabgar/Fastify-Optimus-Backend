import assert from "node:assert/strict";
import { test } from "node:test";
import shopTypeModel from "../shop-type/shop-type.model.js";
import shopModel from "../shop/shop.model.js";
import shopFavouriteModel from "./shop-favourite.model.js";
import { shopFavouriteRepository } from "./shop-favourite.repository.js";

const shopIds = [
  "64b000000000000000000002",
  "64b000000000000000000003",
];
const userId = "64b000000000000000000001";
const favouriteId = "64b000000000000000000004";

function leanQuery(result) {
  return {
    select() {
      return this;
    },
    async lean() {
      return result;
    },
  };
}

test("favourite lookup is scoped to the authenticated user", async (t) => {
  const originalFind = shopFavouriteModel.find;
  let filter;
  shopFavouriteModel.find = (receivedFilter) => {
    filter = receivedFilter;
    return {
      select() {
        return this;
      },
      sort() {
        return this;
      },
      async lean() {
        return [];
      },
    };
  };
  t.after(() => {
    shopFavouriteModel.find = originalFind;
  });

  await shopFavouriteRepository.listForUser(
    "64b000000000000000000001",
  );

  assert.deepEqual(filter, {
    user_id: userId,
  });
});

test("favourite update enforces ownership in one database filter", async (t) => {
  const originalFindOneAndUpdate = shopFavouriteModel.findOneAndUpdate;
  let filter;
  let update;
  let options;
  shopFavouriteModel.findOneAndUpdate = (
    receivedFilter,
    receivedUpdate,
    receivedOptions,
  ) => {
    filter = receivedFilter;
    update = receivedUpdate;
    options = receivedOptions;
    return leanQuery(null);
  };
  t.after(() => {
    shopFavouriteModel.findOneAndUpdate = originalFindOneAndUpdate;
  });

  await shopFavouriteRepository.updateOwnedNote(
    userId,
    favouriteId,
    "Preferred",
  );

  assert.deepEqual(filter, { _id: favouriteId, user_id: userId });
  assert.deepEqual(update, { $set: { note: "Preferred" } });
  assert.deepEqual(options, {
    returnDocument: "after",
    runValidators: true,
  });
});

test("favourite delete enforces ownership in one database filter", async (t) => {
  const originalFindOneAndDelete = shopFavouriteModel.findOneAndDelete;
  let filter;
  shopFavouriteModel.findOneAndDelete = (receivedFilter) => {
    filter = receivedFilter;
    return leanQuery(null);
  };
  t.after(() => {
    shopFavouriteModel.findOneAndDelete = originalFindOneAndDelete;
  });

  await shopFavouriteRepository.removeOwned(userId, favouriteId);

  assert.deepEqual(filter, { _id: favouriteId, user_id: userId });
});

test("favourite shop lookup uses one geospatial aggregation", async (t) => {
  const originalAggregate = shopModel.aggregate;
  let pipeline;
  let aggregateCalls = 0;
  shopModel.aggregate = async (receivedPipeline) => {
    aggregateCalls += 1;
    pipeline = receivedPipeline;
    return [];
  };
  t.after(() => {
    shopModel.aggregate = originalAggregate;
  });

  await shopFavouriteRepository.findVisibleShopsWithDistance({
    shopIds,
    coordinates: [77.209, 28.6139],
  });

  assert.equal(aggregateCalls, 1);
  assert.deepEqual(pipeline[0].$geoNear.near.coordinates, [77.209, 28.6139]);
  assert.equal(pipeline[0].$geoNear.maxDistance, undefined);
  assert.equal(pipeline[0].$geoNear.query.is_active, true);
  assert.equal(pipeline[0].$geoNear.query.is_deleted, false);
  assert.deepEqual(
    pipeline[0].$geoNear.query._id.$in.map(String),
    shopIds,
  );

  const shopTypeLookup = pipeline.find(
    (stage) => stage.$lookup?.from === shopTypeModel.collection.name,
  );
  assert.ok(shopTypeLookup);

  const projection = pipeline.at(-1).$project;
  assert.deepEqual(Object.keys(projection).sort(), [
    "_id",
    "distance",
    "is_closed",
    "operating_hours",
    "shop_image",
    "shop_name",
  ]);
});

test("favourite shop lookup skips aggregation for no shop ids", async (t) => {
  const originalAggregate = shopModel.aggregate;
  shopModel.aggregate = async () => {
    assert.fail("aggregate must not run without shop ids");
  };
  t.after(() => {
    shopModel.aggregate = originalAggregate;
  });

  assert.deepEqual(
    await shopFavouriteRepository.findVisibleShopsWithDistance({
      shopIds: [],
      coordinates: [77.209, 28.6139],
    }),
    [],
  );
});
