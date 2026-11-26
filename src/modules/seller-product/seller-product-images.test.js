import assert from "node:assert/strict";
import { test } from "node:test";
import { createSellerProductService } from "./seller-product.service.js";
import { createUpdateSellerProductService } from "./update-seller-product.service.js";

const seller = "64b000000000000000000001";
const path = `individual/${seller}/12345678-1234-4234-8234-123456789abc.png`;

test("seller product creation and update resolve owned uploaded paths", async (t) => {
  const original = process.env.PUBLIC_IMAGE_BASE_URL;
  process.env.PUBLIC_IMAGE_BASE_URL = "https://images.example.com/assets/";
  t.after(() => {
    if (original === undefined) delete process.env.PUBLIC_IMAGE_BASE_URL;
    else process.env.PUBLIC_IMAGE_BASE_URL = original;
  });
  let created;
  let updates;
  const repository = {
    async findOwnedShop() { return { is_active: true, shop_type_id: "type" }; },
    async findAvailableCategory() { return {}; },
    async createSellerProduct(input) { created = input; return input; },
    async findOwnedProduct() { return { shop_id: "shop", product_type: "common", variants: [] }; },
    async updateOwnedProduct(productId, sellerId, update) { updates = update; return {}; },
  };
  const create = createSellerProductService({ repository });
  await create.createSellerProduct({
    shop_id: "shop", product_type: "individual", product_category_id: "category",
    product_images: [{ object_path: path, alt: "Photo" }, { url: "https://example.com/old.png" }],
    variants: [{ quantity_unit: "pcs", quantity_value: 1 }],
  }, seller);
  assert.deepEqual(created.product_images, [
    { alt: "Photo", url: `https://images.example.com/assets/${path}` },
    { url: "https://example.com/old.png" },
  ]);
  const update = createUpdateSellerProductService({ repository });
  await update.updateSellerProduct({ product_id: "product", product_images_override: [{ object_path: path }] }, seller);
  assert.deepEqual(updates.set.product_images_override, [{ url: `https://images.example.com/assets/${path}` }]);
});

test("seller product updates reject another user's path and malformed paths before writing", async () => {
  let wrote = false;
  const service = createUpdateSellerProductService({ repository: {
    async findOwnedProduct() { return { shop_id: "shop", product_type: "individual", variants: [] }; },
    async findOwnedShop() { return {}; },
    async updateOwnedProduct() { wrote = true; },
  } });
  for (const objectPath of [
    path.replace(seller, "64b000000000000000000002"),
    path.replace("individual/", "common/"),
    path.replace(".png", ".gif"),
    `${path}/../other`,
  ]) {
    await assert.rejects(service.updateSellerProduct({ product_id: "product", product_images: [{ object_path: objectPath }] }, seller), { statusCode: 400 });
  }
  assert.equal(wrote, false);
});
