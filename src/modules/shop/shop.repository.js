import shopTypeModel from "../shop-type/shop-type.model.js";
import shopModel from "./shop.model.js";

const SELLER_FIELDS = [
  "_id",
  "shop_name",
  "shop_address",
  "shop_image",
  "seller_id",
  "is_closed",
  "is_active",
  "is_deleted",
  "operating_hours",
  "gst_number",
  "shop_type_id",
  "seller_location",
  "createdAt",
  "updatedAt",
].join(" ");

const SELLER_DETAIL_FIELDS = [
  "_id",
  "shop_name",
  "shop_address",
  "shop_image",
  "is_closed",
  "operating_hours",
  "seller_location",
].join(" ");

const CUSTOMER_PROJECT = {
  _id: 1,
  shop_name: 1,
  shop_address: 1,
  shop_image: 1,
  operating_hours: 1,
  is_closed: 1,
  is_active: 1,
  seller_location: 1,
  shop_type: { $arrayElemAt: ["$shop_type", 0] },
};

const NEARBY_PROJECT = {
  _id: 1,
  shop_name: 1,
  shop_address: 1,
  shop_image: 1,
  seller_id: 1,
  is_closed: 1,
  operating_hours: 1,
  shop_type_id: 1,
  distance: 1,
  shop_type_name: { $arrayElemAt: ["$shop_type.shop_type_name", 0] },
};

function shopTypeLookup() {
  return {
    $lookup: {
      from: shopTypeModel.collection.name,
      localField: "shop_type_id",
      foreignField: "_id",
      pipeline: [
        { $match: { is_active: true, is_deleted: { $ne: true } } },
        { $project: { _id: 1, shop_type_name: 1 } },
      ],
      as: "shop_type",
    },
  };
}

export const shopRepository = {
  create(input) {
    return shopModel.create(input);
  },

  findActiveShopType(shopTypeId) {
    return shopTypeModel
      .findOne({
        _id: shopTypeId,
        is_active: true,
        is_deleted: false,
      })
      .select("_id shop_type_name")
      .lean();
  },

  async listSeller({ filter, sort, skip, limit }) {
    const [items, total] = await Promise.all([
      shopModel
        .find(filter)
        .select(SELLER_FIELDS)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      shopModel.countDocuments(filter),
    ]);
    return { items, total };
  },

  findOwned(shopId, sellerId) {
    return shopModel
      .findOne({
        _id: shopId,
        seller_id: sellerId,
        is_deleted: false,
      })
      .select(SELLER_FIELDS)
      .lean();
  },

  findOwnedDetail(shopId, sellerId) {
    return shopModel
      .findOne({
        _id: shopId,
        seller_id: sellerId,
        is_deleted: false,
      })
      .select(SELLER_DETAIL_FIELDS)
      .lean();
  },

  updateOwned(shopId, sellerId, updates) {
    return shopModel
      .findOneAndUpdate(
        { _id: shopId, seller_id: sellerId, is_deleted: false },
        { $set: updates },
        { returnDocument: "after", runValidators: true },
      )
      .select(SELLER_FIELDS)
      .lean();
  },

  softDeleteOwned(shopId, sellerId) {
    return shopModel
      .findOneAndUpdate(
        { _id: shopId, seller_id: sellerId, is_deleted: false },
        {
          $set: { is_deleted: true, is_active: false, is_closed: true },
        },
        { returnDocument: "after", runValidators: true },
      )
      .select(SELLER_FIELDS)
      .lean();
  },

  async listCustomer({ match, sort, skip, limit }) {
    const [result] = await shopModel.aggregate([
      { $match: match },
      shopTypeLookup(),
      { $match: { "shop_type.0": { $exists: true } } },
      { $sort: sort },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            { $project: CUSTOMER_PROJECT },
          ],
          metadata: [{ $count: "total" }],
        },
      },
    ]);
    return {
      items: result?.items ?? [],
      total: result?.metadata[0]?.total ?? 0,
    };
  },

  listNearby({ coordinates, maxDistance, match }) {
    return shopModel.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates },
          distanceField: "distance",
          maxDistance,
          spherical: true,
          query: match,
        },
      },
      shopTypeLookup(),
      { $match: { "shop_type.0": { $exists: true } } },
      { $project: NEARBY_PROJECT },
    ]);
  },

  async listCustomerNearby({ coordinates, maxDistance, match, skip, limit }) {
    const [result] = await shopModel.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates },
          distanceField: "distance",
          maxDistance,
          spherical: true,
          query: match,
        },
      },
      shopTypeLookup(),
      { $match: { "shop_type.0": { $exists: true } } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            { $project: NEARBY_PROJECT },
          ],
          metadata: [{ $count: "total" }],
        },
      },
    ]);
    return {
      items: result?.items ?? [],
      total: result?.metadata[0]?.total ?? 0,
    };
  },

  updateForDevelopment(shopId, updates) {
    return shopModel
      .findByIdAndUpdate(
        shopId,
        { $set: updates },
        { returnDocument: "after", runValidators: true },
      )
      .select(SELLER_FIELDS)
      .lean();
  },
};
