import { shopTypeRepository } from "./shop-type.repository.js";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createShopTypeService({ repository = shopTypeRepository } = {}) {
  return {
    listPublic({ search, sort_by: sortBy = "name", sort_direction: sortDirection = "asc" } = {}) {
      const filter = { is_active: true, is_deleted: false };
      if (search) {
        filter.shop_type_name = {
          $regex: escapeRegExp(search.trim()),
          $options: "i",
        };
      }
      return repository.listPublic(filter, { [sortBy === "created_at" ? "createdAt" : "shop_type_name"]: sortDirection === "desc" ? -1 : 1 });
    },
  };
}
