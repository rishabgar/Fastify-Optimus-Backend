import assert from "node:assert/strict";
import { test } from "node:test";
import shopTypeModel from "./shop-type.model.js";

test("shop type model trims fields and applies defaults", async () => {
  const shopType = new shopTypeModel({
    shop_type_name: "  Pharmacy  ",
    shop_type_image: "  https://example.com/pharmacy.png  ",
  });

  await shopType.validate();

  assert.equal(shopType.shop_type_name, "Pharmacy");
  assert.equal(shopType.shop_type_image, "https://example.com/pharmacy.png");
  assert.equal(shopType.is_active, true);
  assert.equal(shopType.is_deleted, false);
});

test("shop type model defines a case-insensitive unique name index", () => {
  const indexes = shopTypeModel.schema.indexes();
  const nameIndex = indexes.find(([fields]) => fields.shop_type_name === 1);

  assert.equal(nameIndex[1].unique, true);
  assert.deepEqual(nameIndex[1].collation, { locale: "en", strength: 2 });
});
