import { success } from "../../shared/http/response.js";

export function createSellerProductController(service) {
  return {
    async createSellerProduct(request, reply) {
      const product = await service.createSellerProduct(
        request.body,
        request.user.user_id,
      );
      return success(reply, {
        statusCode: 201,
        message: "Seller product created successfully",
        data: product,
      });
    },

    async updateSellerProduct(request, reply) {
      await service.updateSellerProduct(
        request.body,
        request.user.user_id,
      );
      return success(reply, {
        message: "Seller product updated successfully",
      });
    },

    async deleteSellerProduct(request, reply) {
      await service.deleteSellerProduct(
        request.params.product_id,
        request.user.user_id,
      );
      return success(reply, {
        message: "Seller product deleted successfully",
      });
    },
  };
}
