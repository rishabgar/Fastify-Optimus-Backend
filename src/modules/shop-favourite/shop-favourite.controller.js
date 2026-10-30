import { success } from "../../shared/http/response.js";

export function createShopFavouriteController(service) {
  return {
    async add(request, reply) {
      const result = await service.add(
        request.user.user_id,
        request.params.shop_id,
        request.body,
      );
      return success(reply, {
        statusCode: result.created ? 201 : 200,
        message: result.created
          ? "Shop added to favourites successfully"
          : "Shop already added to favourites",
        data: result.data,
      });
    },

    async remove(request, reply) {
      await service.remove(
        request.user.user_id,
        request.params.favourite_id,
      );
      return success(reply, {
        message: "Shop favourite removed successfully",
        data: null,
      });
    },

    async list(request, reply) {
      const favourites = await service.list(
        request.user.user_id,
        request.query,
      );
      return success(reply, {
        message: "Shop favourites fetched successfully",
        data: favourites,
      });
    },

    async updateNote(request, reply) {
      const favourite = await service.updateNote(
        request.user.user_id,
        request.params.favourite_id,
        request.body.note,
      );
      return success(reply, {
        message: "Favourite note updated successfully",
        data: favourite,
      });
    },

  };
}
