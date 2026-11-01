import { success } from "../../shared/http/response.js";

export function createShopTypeController(service) {
  return {
    async listPublic(request, reply) {
      const shopTypes = await service.listPublic(request.query);
      return success(reply, {
        message: "Shop types fetched successfully",
        data: shopTypes,
      });
    },
  };
}
