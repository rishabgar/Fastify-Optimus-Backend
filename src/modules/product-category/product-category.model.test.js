import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import productCategoryModel from "./product-category.model.js";

test("product category model trims names and applies defaults", async () => {
  const category = new productCategoryModel({
    product_category_name: "  Medicine  ",
    shop_type_ids: [new Types.ObjectId()],
    created_by: new Types.ObjectId(),
  });

  await category.validate();

  assert.equal(category.product_category_name, "Medicine");
  assert.equal(category.is_active, true);
  assert.equal(category.is_deleted, false);
  assert.equal(category.sort_order, 0);
});

test("product category model defines case-insensitive unique and list indexes", () => {
  const indexes = productCategoryModel.schema.indexes();
  const nameIndex = indexes.find(
    ([fields]) => fields.product_category_name === 1,
  );
  const listIndex = indexes.find(
    ([fields]) =>
      fields.is_active === 1 &&
      fields.is_deleted === 1 &&
      fields.sort_order === 1,
  );
  const shopTypeIndex = indexes.find(
    ([fields]) =>
      fields.shop_type_ids === 1 &&
      fields.is_active === 1 &&
      fields.is_deleted === 1 &&
      fields.sort_order === 1,
  );

  assert.equal(nameIndex[1].unique, true);
  assert.deepEqual(nameIndex[1].collation, { locale: "en", strength: 2 });
  assert.ok(listIndex);
  assert.ok(shopTypeIndex);
  assert.equal(productCategoryModel.schema.path("product_category_type"), undefined);
});
