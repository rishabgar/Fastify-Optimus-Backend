import assert from "node:assert/strict";
import { test } from "node:test";
import { createAvailableMasterProductService } from "./available-master-product.service.js";

const ids = {
  seller: "64b000000000000000000001",
  shop: "64b000000000000000000002",
  shopType: "64b000000000000000000003",
};

test("available master products verifies the seller shop and paginates escaped search", async () => {
  let received;
  const service = createAvailableMasterProductService({
    repository: {
      async findOwnedShop(shopId, sellerId) {
        assert.equal(shopId, ids.shop);
        assert.equal(sellerId, ids.seller);
        return { _id: ids.shop, shop_type_id: ids.shopType, is_active: true };
      },
      async listAvailableMasterProducts(input) {
        received = input;
        return { items: [{ product_id: "product-id" }], total: 21 };
      },
      async listAvailableCategoryIdsByShopType(shopTypeId) {
        assert.equal(shopTypeId, ids.shopType);
        return [{ _id: "category-id" }];
      },
    },
  });

  const result = await service.listAvailableMasterProducts(ids.shop, ids.seller, {
    page: 2,
    limit: 10,
    search: "  Rice+Co  ",
  });

  assert.deepEqual(received, {
    shopId: ids.shop,
    categoryIds: ["category-id"],
    search: "Rice\\+Co",
    skip: 10,
    limit: 10,
  });
  assert.deepEqual(result, {
    items: [{ product_id: "product-id" }],
    pagination: { page: 2, limit: 10, total: 21, total_pages: 3 },
  });
});

test("available master products rejects inactive or unowned shops", async () => {
  const service = createAvailableMasterProductService({
    repository: {
      async findOwnedShop() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.listAvailableMasterProducts(ids.shop, ids.seller, {}),
    (error) => error.statusCode === 404 && error.details.field === "shop_id",
  );
});
