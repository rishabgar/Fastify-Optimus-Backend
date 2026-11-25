import { HttpError } from "../../shared/http/http-error.js";
import { shopTypeRepository } from "./shop-type.repository.js";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function duplicateNameError() {
  return new HttpError(409, "Shop type name already exists", {
    field: "shop_type_name",
  });
}

function requiredFieldError(field, message) {
  return new HttpError(400, message, { field });
}

function toPublicShopType(shopType) {
  const shopTypeData = shopType.toObject?.() ?? shopType;
  return {
    _id: shopTypeData._id,
    shop_type_name: shopTypeData.shop_type_name,
    shop_type_image: shopTypeData.shop_type_image,
  };
}

export function createShopTypeService({ repository = shopTypeRepository } = {}) {
  return {
    async create(input) {
      const shopTypeName = input.shop_type_name.trim();
      const shopTypeImage = input.shop_type_image.trim();
      if (!shopTypeName) {
        throw requiredFieldError("shop_type_name", "Shop type name is required");
      }
      if (!shopTypeImage) {
        throw requiredFieldError("shop_type_image", "Shop type image is required");
      }
      if (await repository.findByName(shopTypeName)) throw duplicateNameError();

      try {
        const shopType = await repository.create({
          shop_type_name: shopTypeName,
          shop_type_image: shopTypeImage,
        });
        return toPublicShopType(shopType);
      } catch (error) {
        if (error?.code === 11000) throw duplicateNameError();
        throw error;
      }
    },

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
