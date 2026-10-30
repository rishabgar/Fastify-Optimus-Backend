import { HttpError } from "../../shared/http/http-error.js";
import { productCategoryRepository } from "./product-category.repository.js";

const SORT_FIELDS = {
  sort_order: "sort_order",
  name: "product_category_name",
  created_at: "createdAt",
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function categoryNotFoundError() {
  return new HttpError(404, "Product category not found", {
    field: "category_id",
  });
}

function duplicateNameError() {
  return new HttpError(409, "Product category name already exists", {
    field: "product_category_name",
  });
}

function unavailableResourceError(resource, field) {
  return new HttpError(404, `${resource} not found`, { field });
}

async function validateShopTypes(repository, shopTypeIds) {
  const uniqueShopTypeIds = [...new Set(shopTypeIds)];
  const availableCount = await repository.countAvailableShopTypes(
    uniqueShopTypeIds,
  );
  if (availableCount !== uniqueShopTypeIds.length) {
    throw new HttpError(400, "One or more shop types are unavailable", {
      field: "shop_type_ids",
    });
  }
}

function throwDuplicateKey(error) {
  if (error?.code === 11000) throw duplicateNameError();
  throw error;
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

export function createProductCategoryService({
  repository = productCategoryRepository,
} = {}) {
  return {
    async create(input, adminId) {
      const name = input.product_category_name.trim();
      if (await repository.findByName(name)) throw duplicateNameError();
      await validateShopTypes(repository, input.shop_type_ids);

      try {
        const category = await repository.create({
          ...input,
          product_category_name: name,
          created_by: adminId,
        });
        const categoryData = category.toObject?.() ?? category;
        const {
          _id: productCategoryId,
          created_by,
          createdAt,
          updatedAt,
          ...publicCategoryData
        } = categoryData;
        return {
          ...publicCategoryData,
          product_category_id: productCategoryId,
        };
      } catch (error) {
        throwDuplicateKey(error);
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
        filter.product_category_name = {
          $regex: escapeRegExp(query.search.trim()),
          $options: "i",
        };
      }

      const direction = query.sort_direction === "desc" ? -1 : 1;
      const sortField = SORT_FIELDS[query.sort_by ?? "sort_order"];
      const sort = { [sortField]: direction };
      if (sortField !== "product_category_name") {
        sort.product_category_name = 1;
      }

      const result = await repository.listAdmin({
        filter,
        sort,
        skip: (page - 1) * limit,
        limit,
      });

      return pageData(result.items, result.total, page, limit);
    },

    async getById(categoryId) {
      const category = await repository.findById(categoryId, {
        includeDeleted: true,
      });
      if (!category) throw categoryNotFoundError();
      return category;
    },

    async update(categoryId, input, adminId) {
      const updates = { ...input, updated_by: adminId };
      if (input.product_category_name !== undefined) {
        updates.product_category_name = input.product_category_name.trim();
        if (
          await repository.findByName(
            updates.product_category_name,
            categoryId,
          )
        ) {
          throw duplicateNameError();
        }
      }
      if (input.shop_type_ids !== undefined) {
        await validateShopTypes(repository, input.shop_type_ids);
      }

      try {
        const category = await repository.update(categoryId, updates);
        if (!category) throw categoryNotFoundError();
        return category;
      } catch (error) {
        throwDuplicateKey(error);
      }
    },

    async remove(categoryId, adminId) {
      const category = await repository.findById(categoryId);
      if (!category) throw categoryNotFoundError();
      if (await repository.hasActiveProducts(categoryId)) {
        throw new HttpError(
          409,
          "Cannot delete a category referenced by active products",
          { field: "category_id" },
        );
      }

      return repository.softDelete(categoryId, adminId);
    },

    async restore(categoryId, adminId) {
      const category = await repository.restore(categoryId, adminId);
      if (!category) throw categoryNotFoundError();
      return category;
    },

    listPublic({ search } = {}) {
      const filter = { is_active: true, is_deleted: false };
      if (search) {
        filter.product_category_name = {
          $regex: escapeRegExp(search.trim()),
          $options: "i",
        };
      }
      return repository.listPublic(filter);
    },

    async listByShop(shopId) {
      if (!(await repository.findAvailableShop(shopId))) {
        throw unavailableResourceError("Shop", "shop_id");
      }
      return repository.listByShop(shopId);
    },

    async listByShopType(shopTypeId) {
      if (!(await repository.findAvailableShopType(shopTypeId))) {
        throw unavailableResourceError("Shop type", "shop_type_id");
      }
      const categories = await repository.listByShopType(shopTypeId);
      return categories.map((category) => ({
        product_category_id: category._id,
        product_category_name: category.product_category_name,
        product_category_type: "common",
        product_category_image: category.product_category_image,
      }));
    },
  };
}
