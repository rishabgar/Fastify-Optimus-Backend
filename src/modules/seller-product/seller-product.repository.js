import productCategoryModel from "../product-category/product-category.model.js";
import shopModel from "../shop/shop.model.js";
import productModel from "../product/product.model.js";
import sellerProductModel from "./seller-product.model.js";
import { Types } from "mongoose";

export const sellerProductRepository = {
  findOwnedProduct(productId, sellerId) {
    return sellerProductModel
      .findOne({ _id: productId, seller_id: sellerId, is_deleted: false })
      .lean();
  },

  findOwnedProductIncludingDeleted(productId, sellerId) {
    return sellerProductModel
      .findOne({ _id: productId, seller_id: sellerId })
      .select("_id is_deleted")
      .lean();
  },

  findOwnedShop(shopId, sellerId) {
    return shopModel
      .findOne({ _id: shopId, seller_id: sellerId, is_deleted: false })
      .select("_id shop_type_id is_active")
      .lean();
  },

  findAvailableMasterProduct(productId) {
    return productModel
      .findOne({ _id: productId, is_active: true, is_deleted: false })
      .select("_id product_category_id variants._id variants.is_active")
      .lean();
  },

  findAvailableCategory(categoryId, shopTypeId) {
    return productCategoryModel
      .findOne({
        _id: categoryId,
        shop_type_ids: shopTypeId,
        is_active: true,
        is_deleted: false,
      })
      .select("_id")
      .lean();
  },

  listAvailableCategoryIdsByShopType(shopTypeId) {
    return productCategoryModel
      .find({
        shop_type_ids: shopTypeId,
        is_active: true,
        is_deleted: false,
      })
      .select("_id")
      .lean();
  },

  findCommonByShopAndProduct(shopId, productId) {
    return sellerProductModel
      .findOne({ shop_id: shopId, product_id: productId, product_type: "common" })
      .select("_id")
      .lean();
  },

  async listAvailableMasterProducts({ shopId, categoryIds, search, skip, limit }) {
    const masterMatch = {
      product_category_id: { $in: categoryIds },
      is_active: true,
      is_deleted: false,
    };
    if (search) {
      masterMatch.$or = [
        { product_name: { $regex: search, $options: "i" } },
        { brand_name: { $regex: search, $options: "i" } },
      ];
    }

    const [result] = await productModel.aggregate([
      { $match: masterMatch },
      {
        $lookup: {
          from: sellerProductModel.collection.name,
          let: { masterProductId: "$_id" },
          pipeline: [
            {
              $match: {
                product_type: "common",
                $expr: {
                  $and: [
                    { $eq: ["$shop_id", new Types.ObjectId(shopId)] },
                    { $eq: ["$product_id", "$$masterProductId"] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "existing_seller_product",
        },
      },
      { $match: { "existing_seller_product.0": { $exists: false } } },
      { $sort: { product_name: 1, brand_name: 1, _id: 1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                product_id: "$_id",
                product_name: 1,
                brand_name: 1,
                product_images: 1,
                variants: {
                  $map: {
                    input: "$variants",
                    as: "variant",
                    in: {
                      product_variant_id: "$$variant._id",
                      label: "$$variant.label",
                    },
                  },
                },
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
      {
        $project: {
          items: 1,
          total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        },
      },
    ]);

    return result ?? { items: [], total: 0 };
  },

  createSellerProduct(input) {
    return sellerProductModel.create(input);
  },

  updateOwnedProduct(
    productId,
    sellerId,
    { set, unset, arrayFilters },
  ) {
    const update = {};
    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;
    return sellerProductModel
      .findOneAndUpdate(
        { _id: productId, seller_id: sellerId, is_deleted: false },
        update,
        {
          returnDocument: "after",
          runValidators: true,
          ...(arrayFilters.length > 0 ? { arrayFilters } : {}),
        },
      )
      .lean();
  },

  softDeleteOwnedProduct(productId, sellerId) {
    return sellerProductModel
      .findOneAndUpdate(
        { _id: productId, seller_id: sellerId, is_deleted: false },
        { $set: { is_deleted: true, is_active: false } },
        { returnDocument: "after", runValidators: true },
      )
      .select("_id")
      .lean();
  },
};
