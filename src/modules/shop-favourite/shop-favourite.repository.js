import mongoose from "mongoose";
import shopTypeModel from "../shop-type/shop-type.model.js";
import shopModel from "../shop/shop.model.js";
import { userModel } from "../user/user.model.js";
import shopFavouriteModel from "./shop-favourite.model.js";

const FAVOURITE_FIELDS = ["_id", "user_id", "shop_id", "note", "createdAt"].join(
  " ",
);

export const shopFavouriteRepository = {
  findAvailableCustomer(userId) {
    return userModel
      .findOne({
        _id: userId,
        user_type: "customer",
        is_deleted: false,
      })
      .select("_id")
      .lean();
  },

  findAvailableShop(shopId) {
    return shopModel
      .findOne({ _id: shopId, is_active: true, is_deleted: false })
      .select("_id")
      .lean();
  },

  findByUserAndShop(userId, shopId) {
    return shopFavouriteModel
      .findOne({ user_id: userId, shop_id: shopId })
      .select(FAVOURITE_FIELDS)
      .lean();
  },

  create(input) {
    return shopFavouriteModel.create(input);
  },

  removeOwned(userId, favouriteId) {
    return shopFavouriteModel
      .findOneAndDelete({ _id: favouriteId, user_id: userId })
      .select(FAVOURITE_FIELDS)
      .lean();
  },

  updateOwnedNote(userId, favouriteId, note) {
    return shopFavouriteModel
      .findOneAndUpdate(
        { _id: favouriteId, user_id: userId },
        { $set: { note } },
        { returnDocument: "after", runValidators: true },
      )
      .select(FAVOURITE_FIELDS)
      .lean();
  },

  listForUser(userId) {
    return shopFavouriteModel
      .find({ user_id: userId })
      .select(FAVOURITE_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .lean();
  },

  findVisibleShopsWithDistance({ shopIds, coordinates }) {
    if (shopIds.length === 0) return [];

    return shopModel.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates },
          distanceField: "distance",
          spherical: true,
          query: {
            _id: {
              $in: shopIds.map((shopId) => new mongoose.Types.ObjectId(shopId)),
            },
            is_active: true,
            is_deleted: false,
          },
        },
      },
      {
        $lookup: {
          from: shopTypeModel.collection.name,
          localField: "shop_type_id",
          foreignField: "_id",
          pipeline: [
            { $match: { is_active: true, is_deleted: false } },
            { $project: { _id: 1 } },
          ],
          as: "shop_type",
        },
      },
      { $match: { "shop_type.0": { $exists: true } } },
      {
        $project: {
          _id: 1,
          shop_name: 1,
          shop_image: 1,
          is_closed: 1,
          operating_hours: 1,
          distance: 1,
        },
      },
    ]);
  },
};
