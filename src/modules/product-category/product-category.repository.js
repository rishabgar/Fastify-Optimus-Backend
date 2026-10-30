import { Types } from "mongoose";
import productModel from "../product/product.model.js";
import sellerProductModel from "../seller-product/seller-product.model.js";
import shopModel from "../shop/shop.model.js";
import shopTypeModel from "../shop-type/shop-type.model.js";
import productCategoryModel from "./product-category.model.js";

const ADMIN_FIELDS = [
  "_id",
  "product_category_name",
  "product_category_description",
  "product_category_image",
  "shop_type_ids",
  "is_active",
  "is_deleted",
  "sort_order",
  "created_by",
  "updated_by",
  "createdAt",
  "updatedAt",
].join(" ");

const PUBLIC_FIELDS = [
  "_id",
  "product_category_name",
  "product_category_description",
  "product_category_image",
  "sort_order",
].join(" ");

const NAME_COLLATION = { locale: "en", strength: 2 };

const categoryResolutionStages = [
  {
    $lookup: {
      from: productModel.collection.name,
      let: { productId: "$product_id", productType: "$product_type" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$$productType", "common"] },
                { $eq: ["$_id", "$$productId"] },
                { $eq: ["$is_active", true] },
                { $eq: ["$is_deleted", false] },
              ],
            },
          },
        },
        { $project: { _id: 0, product_category_id: 1 } },
      ],
      as: "master_product",
    },
  },
  {
    $set: {
      resolved_category_id: {
        $cond: [
          { $eq: ["$product_type", "common"] },
          { $arrayElemAt: ["$master_product.product_category_id", 0] },
          "$product_category_id",
        ],
      },
    },
  },
  { $match: { resolved_category_id: { $type: "objectId" } } },
  {
    $lookup: {
      from: productCategoryModel.collection.name,
      let: { categoryId: "$resolved_category_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$_id", "$$categoryId"] },
                { $eq: ["$is_active", true] },
                { $eq: ["$is_deleted", false] },
              ],
            },
          },
        },
        {
          $project: {
            product_category_name: 1,
            product_category_image: 1,
            product_category_description: 1,
            sort_order: 1,
          },
        },
      ],
      as: "category",
    },
  },
  { $unwind: "$category" },
  { $replaceWith: "$category" },
  {
    $group: {
      _id: "$_id",
      product_category_name: { $first: "$product_category_name" },
      product_category_image: { $first: "$product_category_image" },
      product_category_description: {
        $first: "$product_category_description",
      },
      sort_order: { $first: "$sort_order" },
    },
  },
  { $sort: { sort_order: 1, product_category_name: 1 } },
];

function categoriesForShopMatch(shopMatch) {
  return shopModel.aggregate([
    {
      $match: {
        ...shopMatch,
        is_active: true,
        is_deleted: false,
      },
    },
    {
      $lookup: {
        from: sellerProductModel.collection.name,
        let: { shopId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$shop_id", "$$shopId"] },
                  { $eq: ["$is_active", true] },
                  { $eq: ["$is_deleted", false] },
                ],
              },
            },
          },
        ],
        as: "seller_product",
      },
    },
    { $unwind: "$seller_product" },
    { $replaceWith: "$seller_product" },
    ...categoryResolutionStages,
  ]);
}

export const productCategoryRepository = {
  create(input) {
    return productCategoryModel.create(input);
  },

  findByName(name, excludeId) {
    const filter = { product_category_name: name };
    if (excludeId) filter._id = { $ne: excludeId };

    return productCategoryModel
      .findOne(filter)
      .collation(NAME_COLLATION)
      .lean();
  },

  findById(categoryId, { includeDeleted = false } = {}) {
    const filter = { _id: categoryId };
    if (!includeDeleted) filter.is_deleted = false;

    return productCategoryModel.findOne(filter).select(ADMIN_FIELDS).lean();
  },

  async listAdmin({ filter, sort, skip, limit }) {
    const [items, total] = await Promise.all([
      productCategoryModel
        .find(filter)
        .select(ADMIN_FIELDS)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .collation(NAME_COLLATION)
        .lean(),
      productCategoryModel.countDocuments(filter),
    ]);

    return { items, total };
  },

  listPublic(filter) {
    return productCategoryModel
      .find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ sort_order: 1, product_category_name: 1 })
      .collation(NAME_COLLATION)
      .lean();
  },

  findAvailableShop(shopId) {
    return shopModel
      .findOne({ _id: shopId, is_active: true, is_deleted: false })
      .select("_id")
      .lean();
  },

  findAvailableShopType(shopTypeId) {
    return shopTypeModel
      .findOne({ _id: shopTypeId, is_active: true, is_deleted: false })
      .select("_id")
      .lean();
  },

  countAvailableShopTypes(shopTypeIds) {
    return shopTypeModel.countDocuments({
      _id: { $in: shopTypeIds },
      is_active: true,
      is_deleted: false,
    });
  },

  listByShop(shopId) {
    return categoriesForShopMatch({ _id: new Types.ObjectId(shopId) });
  },

  listByShopType(shopTypeId) {
    return productCategoryModel
      .find({
        shop_type_ids: shopTypeId,
        is_active: true,
        is_deleted: false,
      })
      .select(PUBLIC_FIELDS)
      .sort({ sort_order: 1, product_category_name: 1 })
      .collation(NAME_COLLATION)
      .lean();
  },

  update(categoryId, updates) {
    return productCategoryModel
      .findOneAndUpdate({ _id: categoryId, is_deleted: false }, updates, {
        returnDocument: "after",
        runValidators: true,
      })
      .select(ADMIN_FIELDS)
      .lean();
  },

  softDelete(categoryId, adminId) {
    return productCategoryModel
      .findOneAndUpdate(
        { _id: categoryId, is_deleted: false },
        {
          $set: {
            is_deleted: true,
            is_active: false,
            updated_by: adminId,
          },
        },
        { returnDocument: "after", runValidators: true },
      )
      .select(ADMIN_FIELDS)
      .lean();
  },

  restore(categoryId, adminId) {
    return productCategoryModel
      .findOneAndUpdate(
        { _id: categoryId, is_deleted: true },
        { $set: { is_deleted: false, updated_by: adminId } },
        { returnDocument: "after", runValidators: true },
      )
      .select(ADMIN_FIELDS)
      .lean();
  },

  hasActiveProducts(categoryId) {
    return productModel.exists({
      product_category_id: categoryId,
      is_active: true,
      is_deleted: false,
    });
  },
};
