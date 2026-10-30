import { success } from "../../shared/http/response.js";

export function createShopTypeController(service) {
  return {
    async create(request, reply) {
      const shopType = await service.create(request.body);
      return success(reply, {
        statusCode: 201,
        message: "Shop type created successfully",
        data: shopType,
      });
    },

    async listAdmin(request, reply) {
      const shopTypes = await service.listAdmin(request.query);
      return success(reply, {
        message: "Shop types fetched successfully",
        data: shopTypes,
      });
    },

    async getById(request, reply) {
      const shopType = await service.getById(
        request.params.shop_type_id,
        request.query,
      );
      return success(reply, {
        message: "Shop type fetched successfully",
        data: shopType,
      });
    },

    async update(request, reply) {
      const shopType = await service.update(
        request.params.shop_type_id,
        request.body,
      );
      return success(reply, {
        message: "Shop type updated successfully",
        data: shopType,
      });
    },

    async remove(request, reply) {
      const shopType = await service.remove(request.params.shop_type_id);
      return success(reply, {
        message: "Shop type deleted successfully",
        data: shopType,
      });
    },

    async restore(request, reply) {
      const shopType = await service.restore(request.params.shop_type_id);
      return success(reply, {
        message: "Shop type restored successfully",
        data: shopType,
      });
    },

    async listPublic(request, reply) {
      const shopTypes = await service.listPublic(request.query);
      return success(reply, {
        message: "Shop types fetched successfully",
        data: shopTypes,
      });
    },
  };
}
