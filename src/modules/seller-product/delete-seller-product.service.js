import { HttpError } from "../../shared/http/http-error.js";
import { sellerProductRepository } from "./seller-product.repository.js";

function notFoundError() {
  return new HttpError(404, "Seller product not found", {
    field: "product_id",
  });
}

export function createDeleteSellerProductService({
  repository = sellerProductRepository,
} = {}) {
  return {
    async deleteSellerProduct(productId, sellerId) {
      const deleted = await repository.softDeleteOwnedProduct(
        productId,
        sellerId,
      );
      if (deleted) return;

      const existing = await repository.findOwnedProductIncludingDeleted(
        productId,
        sellerId,
      );
      if (existing?.is_deleted) {
        throw new HttpError(409, "Seller product is already deleted", {
          field: "product_id",
        });
      }
      throw notFoundError();
    },
  };
}
