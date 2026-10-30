import { HttpError } from "../../shared/http/http-error.js";
import { shopTypeRepository } from "./shop-type.repository.js";

const SORT_FIELDS = {
  name: "shop_type_name",
  created_at: "createdAt",
};

const CREATE_FIELDS = ["shop_type_name", "shop_type_image"];
const UPDATE_FIELDS = ["shop_type_name", "shop_type_image", "is_active"];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function notFoundError() {
  return new HttpError(404, "Shop type not found", {
    field: "shop_type_id",
  });
}

function duplicateNameError() {
  return new HttpError(409, "Shop type name already exists", {
    field: "shop_type_name",
  });
}

function normalizeName(name) {
  return name.trim();
}

function pick(input, fields) {
  return Object.fromEntries(
    fields
      .filter((field) => input[field] !== undefined)
      .map((field) => [field, input[field]]),
  );
}

function handleWriteError(error) {
  if (error?.code === 11000) throw duplicateNameError();
  throw error;
}

export function createShopTypeService({ repository = shopTypeRepository } = {}) {
  return {
    async create(input) {
      const createInput = pick(input, CREATE_FIELDS);
      const name = normalizeName(createInput.shop_type_name);
      if (await repository.findByName(name)) throw duplicateNameError();

      try {
        return await repository.create({
          ...createInput,
          shop_type_name: name,
        });
      } catch (error) {
        handleWriteError(error);
      }
    },

    async listAdmin(query) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const filter = {};
      if (query.include_deleted !== true) filter.is_deleted = false;
      if (query.is_deleted !== undefined) filter.is_deleted = query.is_deleted;
      if (query.is_active !== undefined) filter.is_active = query.is_active;
      if (query.search) {
        filter.shop_type_name = {
          $regex: escapeRegExp(query.search.trim()),
          $options: "i",
        };
      }

      const direction = query.sort_direction === "desc" ? -1 : 1;
      const sort = { [SORT_FIELDS[query.sort_by ?? "name"]]: direction };
      const { items, total } = await repository.listAdmin({
        filter,
        sort,
        skip: (page - 1) * limit,
        limit,
      });
      return {
        items,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      };
    },

    async getById(shopTypeId, { include_deleted: includeDeleted = false } = {}) {
      const shopType = await repository.findById(shopTypeId, {
        includeDeleted,
      });
      if (!shopType) throw notFoundError();
      return shopType;
    },

    async update(shopTypeId, input) {
      const updates = pick(input, UPDATE_FIELDS);
      if (updates.shop_type_name !== undefined) {
        updates.shop_type_name = normalizeName(updates.shop_type_name);
        if (await repository.findByName(updates.shop_type_name, shopTypeId)) {
          throw duplicateNameError();
        }
      }

      try {
        const shopType = await repository.update(shopTypeId, updates);
        if (!shopType) throw notFoundError();
        return shopType;
      } catch (error) {
        handleWriteError(error);
      }
    },

    async remove(shopTypeId) {
      const shopType = await repository.findById(shopTypeId);
      if (!shopType) throw notFoundError();
      if (await repository.hasReferencingShops(shopTypeId)) {
        throw new HttpError(
          409,
          "Cannot delete a shop type referenced by non-deleted shops",
          { field: "shop_type_id" },
        );
      }
      if (await repository.hasReferencingCategories(shopTypeId)) {
        throw new HttpError(
          409,
          "Cannot delete a shop type referenced by non-deleted categories",
          { field: "shop_type_id" },
        );
      }
      return repository.softDelete(shopTypeId);
    },

    async restore(shopTypeId) {
      const shopType = await repository.restore(shopTypeId);
      if (!shopType) throw notFoundError();
      return shopType;
    },

    listPublic({ search } = {}) {
      const filter = { is_active: true, is_deleted: false };
      if (search) {
        filter.shop_type_name = {
          $regex: escapeRegExp(search.trim()),
          $options: "i",
        };
      }
      return repository.listPublic(filter);
    },
  };
}
