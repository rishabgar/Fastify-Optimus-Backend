import { HttpError } from "../../shared/http/http-error.js";
import { sellerProductRepository } from "./seller-product.repository.js";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pageData(items, total, page, limit) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

export function createAvailableMasterProductService({
  repository = sellerProductRepository,
} = {}) {
  return {
    async listAvailableMasterProducts(shopId, sellerId, query) {
      const shop = await repository.findOwnedShop(shopId, sellerId);
      if (!shop) {
        throw new HttpError(404, "Shop not found", { field: "shop_id" });
      }
      if (!shop.is_active) {
        throw new HttpError(409, "Shop is inactive", { field: "shop_id" });
      }

      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const categories = await repository.listAvailableCategoryIdsByShopType(
        shop.shop_type_id,
      );
      if (categories.length === 0) return pageData([], 0, page, limit);

      const result = await repository.listAvailableMasterProducts({
        shopId,
        categoryIds: categories.map((category) => category._id),
        ...(query.search
          ? { search: escapeRegExp(query.search.trim()) }
          : {}),
        skip: (page - 1) * limit,
        limit,
      });

      return pageData(result.items, result.total, page, limit);
    },
  };
}
