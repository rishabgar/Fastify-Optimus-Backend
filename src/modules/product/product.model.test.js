import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import productModel from "./product.model.js";

test("product model validates its catalog fields and variant defaults", async () => {
  const product = new productModel({
    product_name: "Milk",
    brand_name: "Example",
    product_category_id: new Types.ObjectId(),
    product_images: [{ url: "https://example.com/milk.jpg" }],
    variants: [
      {
        label: "500 ml",
        quantity_value: 500,
        quantity_unit: "ml",
        normalized_value: 500,
        normalized_unit: "ml",
        sku: "MILK-500",
      },
    ],
  });

  await product.validate();

  assert.ok(product.variants[0]._id);
  assert.equal(product.product_images[0]._id, undefined);
  assert.equal(product.variants[0].is_active, true);
  assert.equal(product.variants[0].sort_order, 0);
  assert.equal(product.is_active, true);
  assert.equal(product.is_deleted, false);
});

test("product model defines the requested catalog indexes", () => {
  const indexes = productModel.schema.indexes();

  assert.ok(
    indexes.some(
      ([fields]) =>
        fields.product_category_id === 1 &&
        fields.is_active === 1 &&
        fields.is_deleted === 1,
    ),
  );
  assert.ok(
    indexes.some(
      ([fields, options]) =>
        fields["variants.sku"] === 1 && options.unique === true,
    ),
  );
});
