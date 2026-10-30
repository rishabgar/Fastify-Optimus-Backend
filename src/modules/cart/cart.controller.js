import { success } from "../../shared/http/response.js";

export function createCartController(cartService) {
  return {
    async addItem(request, reply) {
      await cartService.addItem(
        request.user.user_id,
        request.body,
      );

      return success(reply, {
        statusCode: 201,
        message: "Item added to cart successfully",
        data: null,
      });
    },

    async updateItem(request, reply) {
      await cartService.updateItem(
        request.user.user_id,
        request.body,
      );

      return success(reply, {
        message: "Cart item updated successfully",
        data: null,
      });
    },

    async removeItem(request, reply) {
      const cart = await cartService.removeItem(request.query.user_id, request.params);

      return success(reply, {
        message: "Cart item removed successfully",
        data: cart,
      });
    },

    async getCart(request, reply) {
      const cart = await cartService.getCart(request.user.user_id);

      return success(reply, {
        message: "Cart fetched successfully",
        data: cart,
      });
    },
  };
}
