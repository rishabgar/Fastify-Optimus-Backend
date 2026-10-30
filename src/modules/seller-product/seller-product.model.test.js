import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import sellerProductModel from "./seller-product.model.js";

function commercialFields() {
  return {
    seller_sku: "SELLER-SKU-1",
    price: 100,
  };
}

test("common seller products require master product and variant references", async () => {
  const sellerProduct = new sellerProductModel({
    seller_id: new Types.ObjectId(),
    shop_id: new Types.ObjectId(),
    product_type: "common",
    variants: [commercialFields()],
  });

  const error = await sellerProduct.validate().catch((validationError) =>
    validationError,
  );

  assert.ok(error.errors.product_id);
  assert.ok(error.errors["variants.0.product_variant_id"]);
});

test("individual seller products validate seller-owned catalog data", async () => {
  const sellerProduct = new sellerProductModel({
    seller_id: new Types.ObjectId(),
    shop_id: new Types.ObjectId(),
    product_type: "individual",
    product_name: "Custom flour",
    brand_name: "Local seller",
    product_category_id: new Types.ObjectId(),
    product_images: [{ url: "https://example.com/flour.jpg" }],
    variants: [
      {
        ...commercialFields(),
        label: "1 kg",
        quantity_value: 1,
        quantity_unit: "kg",
        normalized_value: 1000,
        normalized_unit: "g",
      },
    ],
  });

  await sellerProduct.validate();

  assert.equal(sellerProduct.product_id, undefined);
  assert.equal(sellerProduct.variants[0].product_variant_id, undefined);
  assert.equal(sellerProduct.product_images[0]._id, undefined);
  assert.equal(sellerProduct.variants[0].discount_percent, 0);
  assert.equal(sellerProduct.variants[0].available_quantity, 0);
});

test("individual seller products reject master product references", async () => {
  const sellerProduct = new sellerProductModel({
    seller_id: new Types.ObjectId(),
    shop_id: new Types.ObjectId(),
    product_type: "individual",
    product_id: new Types.ObjectId(),
    product_name: "Custom flour",
    brand_name: "Local seller",
    product_category_id: new Types.ObjectId(),
  });

  const error = await sellerProduct.validate().catch((validationError) =>
    validationError,
  );

  assert.ok(error.errors.product_id);
});

test("seller products omit fields that do not apply", async () => {
  const commonProduct = new sellerProductModel({
    seller_id: new Types.ObjectId(),
    shop_id: new Types.ObjectId(),
    product_type: "common",
    product_id: new Types.ObjectId(),
    variants: [
      {
        ...commercialFields(),
        product_variant_id: new Types.ObjectId(),
      },
    ],
  });
  const individualProduct = new sellerProductModel({
    seller_id: new Types.ObjectId(),
    shop_id: new Types.ObjectId(),
    product_type: "individual",
    product_name: "Custom flour",
    brand_name: "Local seller",
    product_category_id: new Types.ObjectId(),
    variants: [
      {
        ...commercialFields(),
        label: "1 kg",
        quantity_value: 1,
        quantity_unit: "kg",
        normalized_value: 1000,
        normalized_unit: "g",
      },
    ],
  });

  await Promise.all([commonProduct.validate(), individualProduct.validate()]);
  const commonData = commonProduct.toObject();
  const individualData = individualProduct.toObject();

  assert.equal(Object.hasOwn(commonData, "product_name_override"), false);
  assert.equal(Object.hasOwn(commonData, "product_description_override"), false);
  assert.equal(Object.hasOwn(individualData, "product_id"), false);
  assert.equal(
    Object.hasOwn(individualData.variants[0], "product_variant_id"),
    false,
  );
});

test("seller product model limits common product uniqueness to common records", () => {
  const index = sellerProductModel.schema
    .indexes()
    .find(
      ([fields]) => fields.shop_id === 1 && fields.product_id === 1,
    );

  assert.deepEqual(index, [
    { shop_id: 1, product_id: 1 },
    {
      unique: true,
      partialFilterExpression: { product_type: "common" },
      name: "shop_common_product_unique_idx",
    },
  ]);

  const skuIndex = sellerProductModel.schema
    .indexes()
    .find(([fields]) => fields["variants.seller_sku"] === 1);
  assert.equal(skuIndex[1].unique, true);
});
