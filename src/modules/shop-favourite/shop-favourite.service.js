import { Types } from "mongoose";
import { HttpError } from "../../shared/http/http-error.js";
import { shopFavouriteRepository } from "./shop-favourite.repository.js";

function favouriteNotFoundError() {
  return new HttpError(404, "Shop favourite not found", {
    field: "favourite_id",
  });
}

function favouriteData(favourite) {
  return {
    user_id: favourite.user_id,
    shop_id: favourite.shop_id,
  };
}

export function createShopFavouriteService({
  repository = shopFavouriteRepository,
} = {}) {
  return {
    async add(userId, shopId, input = {}) {
      if (!Types.ObjectId.isValid(userId)) {
        throw new HttpError(401, "Invalid authentication credentials");
      }
      if (!Types.ObjectId.isValid(shopId)) {
        throw new HttpError(400, "Invalid shop id");
      }

      const customer = await repository.findAvailableCustomer(userId);
      if (!customer) {
        throw new HttpError(403, "Active customer access is required");
      }

      const shop = await repository.findAvailableShop(shopId);
      if (!shop) {
        throw new HttpError(404, "Active shop not found", {
          field: "shop_id",
        });
      }
      if (await repository.findByUserAndShop(userId, shopId)) {
        return {
          created: false,
          data: { user_id: userId, shop_id: shopId },
        };
      }

      try {
        const favourite = await repository.create({
          user_id: userId,
          shop_id: shopId,
          note: input?.note,
        });
        return { created: true, data: favouriteData(favourite) };
      } catch (error) {
        if (error?.code === 11000) {
          const favourite = await repository.findByUserAndShop(userId, shopId);
          if (favourite) {
            return { created: false, data: favouriteData(favourite) };
          }
        }
        throw error;
      }
    },

    async remove(userId, favouriteId) {
      if (!Types.ObjectId.isValid(userId)) {
        throw new HttpError(401, "Invalid authentication credentials");
      }
      if (!Types.ObjectId.isValid(favouriteId)) {
        throw new HttpError(400, "Invalid favourite id");
      }

      const favourite = await repository.removeOwned(userId, favouriteId);
      if (!favourite) throw favouriteNotFoundError();
    },

    async updateNote(userId, favouriteId, note) {
      if (!Types.ObjectId.isValid(userId)) {
        throw new HttpError(401, "Invalid authentication credentials");
      }
      if (!Types.ObjectId.isValid(favouriteId)) {
        throw new HttpError(400, "Invalid favourite id");
      }

      const favourite = await repository.updateOwnedNote(
        userId,
        favouriteId,
        note,
      );
      if (!favourite) throw favouriteNotFoundError();
      return {
        _id: favourite._id,
        user_id: favourite.user_id,
        shop_id: favourite.shop_id,
        note: favourite.note ?? null,
      };
    },

    async list(userId, query) {
      if (!Types.ObjectId.isValid(userId)) {
        throw new HttpError(401, "Invalid authentication credentials");
      }

      const favourites = await repository.listForUser(userId);
      if (favourites.length === 0) return [];

      const shopIds = [
        ...new Set(favourites.map(({ shop_id }) => shop_id.toString())),
      ];
      const shops = await repository.findVisibleShopsWithDistance({
        shopIds,
        coordinates: [query.longitude, query.latitude],
      });
      const shopsById = new Map(
        shops.map((shop) => [shop._id.toString(), shop]),
      );
      const maxDistance = query.distance ?? 1000;

      return favourites.flatMap((favourite) => {
        const shop = shopsById.get(favourite.shop_id.toString());
        if (!shop) return [];

        const item = {
          _id: favourite._id,
          user_id: favourite.user_id,
          shop_id: favourite.shop_id,
          is_nearby: shop.distance <= maxDistance,
          shop: {
            shop_id: shop._id,
            shop_name: shop.shop_name,
            shop_image: shop.shop_image,
            is_closed: shop.is_closed,
            operating_hours: shop.operating_hours,
          },
        };
        if (
          typeof favourite.note === "string" &&
          favourite.note.trim().length > 0
        ) {
          item.note = favourite.note;
        }
        return [item];
      });
    },
  };
}
