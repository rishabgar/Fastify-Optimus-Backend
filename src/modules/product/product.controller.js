import { success } from "../../shared/http/response.js";

export function createProductController(service) {
  return {
    async create(request, reply) {
      const product = await service.create(request.body);
      return success(reply, {
        statusCode: 201,
        message: "Product created successfully",
        data: product,
      });
    },

    async listByShopAndCategory(request, reply) {
      const products = await service.listByShopAndCategory(
        request.params.shop_id,
        request.params.product_category_id,
        request.query,
      );
      return success(reply, {
        message: "Products fetched successfully",
        data: products,
      });
    },

    async listByShop(request, reply) {
      const products = await service.listByShop(
        request.params.shop_id,
        request.query,
      );
      return success(reply, {
        message: "Products fetched successfully",
        data: products,
      });
    },

    async listNearby(request, reply) {
      const products = await service.listNearby(request.params, request.query);
      return success(reply, {
        message: "Nearby products fetched successfully",
        data: products,
      });
    },

    async getDetail(request, reply) {
      const product = await service.getDetail(request.params.product_id);
      return success(reply, {
        message: "Product fetched successfully",
        data: product,
      });
    },
  };
}
