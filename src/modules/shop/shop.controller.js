import { success } from "../../shared/http/response.js";

export function createShopController(service) {
  return {
    async create(request, reply) {
      const shop = await service.create(request.body, request.user.user_id);
      return success(reply, {
        statusCode: 201,
        message: "Shop created successfully",
        data: shop,
      });
    },

    async listSeller(request, reply) {
      const shops = await service.listSeller(
        request.user.user_id,
        request.query,
      );
      return success(reply, {
        message: "Seller shops fetched successfully",
        data: shops,
      });
    },

    async update(request, reply) {
      const shop = await service.update(
        request.params.shop_id,
        request.user.user_id,
        request.body,
      );
      return success(reply, {
        message: "Shop updated successfully",
        data: shop,
      });
    },

    async remove(request, reply) {
      const shop = await service.remove(
        request.params.shop_id,
        request.user.user_id,
      );
      return success(reply, {
        message: "Shop deleted successfully",
        data: shop,
      });
    },

    async listCustomer(request, reply) {
      const shops = await service.listCustomer(request.query);
      return success(reply, {
        message: "Shops fetched successfully",
        data: shops,
      });
    },

    async listNearby(request, reply) {
      const shops = await service.listNearby(request.query);
      return success(reply, {
        message: "Nearby shops fetched successfully",
        data: shops,
      });
    },

    async getDetail(request, reply) {
      const shop = await service.getDetail(
        request.params.shop_id,
        request.user.user_id,
      );
      return success(reply, {
        message: "Shop fetched successfully",
        data: shop,
      });
    },

    async updateForDevelopment(request, reply) {
      const shop = await service.updateForDevelopment(
        request.params.shop_id,
        request.body,
      );
      return success(reply, {
        message: "Shop updated successfully",
        data: shop,
      });
    },
  };
}
