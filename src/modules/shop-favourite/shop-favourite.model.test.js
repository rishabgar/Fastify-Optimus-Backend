import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import shopFavouriteModel from "./shop-favourite.model.js";

test("shop favourite model omits an unspecified note", async () => {
  const favourite = new shopFavouriteModel({
    user_id: new Types.ObjectId(),
    shop_id: new Types.ObjectId(),
  });

  await favourite.validate();

  assert.equal(favourite.note, undefined);
  assert.equal(favourite.is_deleted, undefined);
});

test("shop favourite model enforces note length", async () => {
  const favourite = new shopFavouriteModel({
    user_id: new Types.ObjectId(),
    shop_id: new Types.ObjectId(),
    note: "x".repeat(501),
  });

  const error = await favourite.validate().catch((validationError) =>
    validationError,
  );

  assert.ok(error.errors.note);
});

test("shop favourite model trims notes", async () => {
  const favourite = new shopFavouriteModel({
    user_id: new Types.ObjectId(),
    shop_id: new Types.ObjectId(),
    note: "  Preferred  ",
  });

  await favourite.validate();

  assert.equal(favourite.note, "Preferred");
});

test("shop favourite model defines individual and compound indexes", () => {
  const indexes = shopFavouriteModel.schema.indexes();

  assert.ok(indexes.some(([fields]) => fields.user_id === 1));
  assert.ok(indexes.some(([fields]) => fields.shop_id === 1));
  assert.ok(
    indexes.some(
      ([fields, options]) =>
        fields.user_id === 1 &&
        fields.shop_id === 1 &&
        options.unique === true,
    ),
  );
});
