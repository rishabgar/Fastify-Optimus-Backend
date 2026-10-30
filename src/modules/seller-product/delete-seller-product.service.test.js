import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeleteSellerProductService } from "./delete-seller-product.service.js";

const productId = "64b000000000000000000001";
const sellerId = "64b000000000000000000002";

test("seller product deletion uses one ownership-scoped soft delete", async () => {
  const service = createDeleteSellerProductService({
    repository: {
      async softDeleteOwnedProduct(receivedProductId, receivedSellerId) {
        assert.equal(receivedProductId, productId);
        assert.equal(receivedSellerId, sellerId);
        return { _id: productId };
      },
      async findOwnedProductIncludingDeleted() {
        assert.fail("successful deletion must not need another query");
      },
    },
  });

  assert.equal(await service.deleteSellerProduct(productId, sellerId), undefined);
});

test("seller product deletion rejects an already deleted product", async () => {
  const service = createDeleteSellerProductService({
    repository: {
      async softDeleteOwnedProduct() {
        return null;
      },
      async findOwnedProductIncludingDeleted() {
        return { _id: productId, is_deleted: true };
      },
    },
  });

  await assert.rejects(
    service.deleteSellerProduct(productId, sellerId),
    (error) => error.statusCode === 409,
  );
});

test("seller product deletion hides missing and unowned products", async () => {
  const service = createDeleteSellerProductService({
    repository: {
      async softDeleteOwnedProduct() {
        return null;
      },
      async findOwnedProductIncludingDeleted() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.deleteSellerProduct(productId, sellerId),
    (error) =>
      error.statusCode === 404 && error.details.field === "product_id",
  );
});
