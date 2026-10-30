import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import shopModel from "./shop.model.js";

function validShop(overrides = {}) {
  return {
    shop_name: "Health Store",
    shop_address: "123 Main Street",
    seller_id: new Types.ObjectId(),
    operating_hours: { open: "09:00", close: "22:30" },
    shop_type_id: new Types.ObjectId(),
    seller_location: { coordinates: [77.5946, 12.9716] },
    ...overrides,
  };
}

test("shop model applies defaults and keeps embedded objects without ids", async () => {
  const shop = new shopModel(validShop());

  await shop.validate();

  assert.equal(shop.is_closed, false);
  assert.equal(shop.is_active, true);
  assert.equal(shop.is_deleted, false);
  assert.equal(shop.seller_location.type, "Point");
  assert.equal(shop.operating_hours._id, undefined);
  assert.equal(shop.seller_location._id, undefined);
});

test("shop model rejects invalid coordinates and operating hours", async () => {
  const shop = new shopModel(
    validShop({
      operating_hours: { open: "9:00", close: "25:00" },
      seller_location: { coordinates: [181, 91] },
    }),
  );

  const error = await shop.validate().catch((validationError) =>
    validationError,
  );

  assert.ok(error.errors["operating_hours.open"]);
  assert.ok(error.errors["operating_hours.close"]);
  assert.ok(error.errors["seller_location.coordinates"]);
});

test("shop model requires GST numbers to contain exactly 15 characters", async () => {
  const shortShop = new shopModel(validShop({ gst_number: "12345678901234" }));
  const longShop = new shopModel(validShop({ gst_number: "1234567890123456" }));

  const shortError = await shortShop.validate().catch((error) => error);
  const longError = await longShop.validate().catch((error) => error);

  assert.ok(shortError.errors.gst_number);
  assert.ok(longError.errors.gst_number);
  await new shopModel(
    validShop({ gst_number: "06ABCDE1234F1Z2" }),
  ).validate();
});

test("shop model defines geospatial and query indexes", () => {
  const indexes = shopModel.schema.indexes();

  assert.ok(
    indexes.some(
      ([fields]) => fields.seller_location === "2dsphere",
    ),
  );
  assert.ok(
    indexes.some(
      ([fields]) =>
        fields.seller_id === 1 &&
        fields.is_active === 1 &&
        fields.is_deleted === 1,
    ),
  );
  assert.ok(
    indexes.some(
      ([fields]) =>
        fields.shop_type_id === 1 &&
        fields.is_active === 1 &&
        fields.is_deleted === 1,
    ),
  );
  assert.equal(
    indexes.some(([fields]) => fields.gst_number === 1),
    false,
  );
});
