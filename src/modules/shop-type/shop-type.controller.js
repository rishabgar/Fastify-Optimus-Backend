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

    async listPublic(request, reply) {
      const shopTypes = await service.listPublic(request.query);
      return success(reply, {
        message: "Shop types fetched successfully",
        data: shopTypes,
      });
    },
  };
}
