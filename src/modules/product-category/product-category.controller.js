import { success } from "../../shared/http/response.js";

export function createProductCategoryController(service) {
  return {
    async create(request, reply) {
      const category = await service.create(request.body, request.user.user_id);
      return success(reply, {
        statusCode: 200,
        message: "Product category created successfully",
        data: category,
      });
    },

    async listAdmin(request, reply) {
      const categories = await service.listAdmin(request.query);
      return success(reply, {
        message: "Product categories fetched successfully",
        data: categories,
      });
    },

    async getById(request, reply) {
      const category = await service.getById(request.params.category_id);
      return success(reply, {
        message: "Product category fetched successfully",
        data: category,
      });
    },

    async update(request, reply) {
      const category = await service.update(
        request.params.product_category_id,
        request.body,
        request.user.user_id,
      );
      return success(reply, {
        message: "Product category updated successfully",
        data: category,
      });
    },

    async remove(request, reply) {
      const category = await service.remove(
        request.params.product_category_id,
        request.user.user_id,
      );
      return success(reply, {
        message: "Product category deleted successfully",
        data: category,
      });
    },

    async restore(request, reply) {
      const category = await service.restore(
        request.params.category_id,
        request.user.user_id,
      );
      return success(reply, {
        message: "Product category restored successfully",
        data: category,
      });
    },

    async listPublic(request, reply) {
      const categories = await service.listPublic(request.query);
      return success(reply, {
        message: "Product categories fetched successfully",
        data: categories,
      });
    },

    async listByShop(request, reply) {
      const categories = await service.listByShop(request.params.shop_id);
      return success(reply, {
        message: "Product categories fetched successfully",
        data: categories,
      });
    },

    async listByShopType(request, reply) {
      const categories = await service.listByShopType(
        request.params.shop_type_id,
      );
      return success(reply, {
        message: "Product categories fetched successfully",
        data: categories,
      });
    },
  };
}
