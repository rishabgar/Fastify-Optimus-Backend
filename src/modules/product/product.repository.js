import { Types } from "mongoose";
import productCategoryModel from "../product-category/product-category.model.js";
import sellerProductModel from "../seller-product/seller-product.model.js";
import shopModel from "../shop/shop.model.js";
import shopTypeModel from "../shop-type/shop-type.model.js";
import { listNearbyProducts } from "./nearby-product.repository.js";
import { getPublicProductDetail } from "./product-detail.repository.js";
import productModel from "./product.model.js";

const activeMasterVariant = {
  $arrayElemAt: [
    {
      $filter: {
        input: { $ifNull: ["$master_product.variants", []] },
        as: "masterVariant",
        cond: {
          $and: [
            { $eq: ["$$masterVariant._id", "$variants.product_variant_id"] },
            { $eq: ["$$masterVariant.is_active", true] },
          ],
        },
      },
    },
    0,
  ],
};

const SORT_FIELDS = {
  created_at: "createdAt",
  name: "product_name",
  price: "minimum_price",
};

async function listSellerProducts({
  shopId,
  categoryId,
  skip,
  limit,
  search,
  productType,
  inStock,
  sortBy = "created_at",
  sortDirection = "desc",
}) {
  const shopObjectId = new Types.ObjectId(shopId);
  const categoryObjectId = categoryId
    ? new Types.ObjectId(categoryId)
    : null;
  const initialMatch = {
    shop_id: shopObjectId,
    is_active: true,
    is_deleted: false,
  };
  if (productType) initialMatch.product_type = productType;
  if (inStock === true) {
    initialMatch.variants = {
      $elemMatch: {
        is_active: true,
        available_quantity: { $gt: 0 },
      },
    };
  } else if (inStock === false) {
    initialMatch.variants = {
      $not: {
        $elemMatch: {
          is_active: true,
          available_quantity: { $gt: 0 },
        },
      },
    };
  }

  const masterConditions = [
    { $eq: ["$_id", "$$masterProductId"] },
    { $eq: ["$is_active", true] },
    { $eq: ["$is_deleted", false] },
  ];
  if (categoryObjectId) {
    masterConditions.push({
      $eq: ["$product_category_id", categoryObjectId],
    });
  }

  const individualConditions = [
    { $eq: ["$product_type", "individual"] },
  ];
  if (categoryObjectId) {
    individualConditions.push({
      $eq: ["$product_category_id", categoryObjectId],
    });
  }

  const pipeline = [
    { $match: initialMatch },
    { $unwind: "$variants" },
    { $match: { "variants.is_active": true } },
    {
      $lookup: {
        from: productModel.collection.name,
        let: { masterProductId: "$product_id" },
        pipeline: [{ $match: { $expr: { $and: masterConditions } } }],
        as: "master_product",
      },
    },
    { $set: { master_product: { $arrayElemAt: ["$master_product", 0] } } },
    { $set: { master_variant: activeMasterVariant } },
    {
      $match: {
        $expr: {
          $or: [
            { $and: individualConditions },
            {
              $and: [
                { $eq: ["$product_type", "common"] },
                { $ne: [{ $type: "$master_product" }, "missing"] },
                { $ne: [{ $type: "$master_variant" }, "missing"] },
              ],
            },
          ],
        },
      },
    },
    {
      $project: {
        product_id: "$_id",
        product_type: 1,
        product_name: {
          $cond: [
            { $eq: ["$product_type", "common"] },
            { $ifNull: ["$product_name_override", "$master_product.product_name"] },
            "$product_name",
          ],
        },
        brand_name: {
          $cond: [
            { $eq: ["$product_type", "common"] },
            "$master_product.brand_name",
            "$brand_name",
          ],
        },
        product_description: {
          $ifNull: [
            {
              $cond: [
                { $eq: ["$product_type", "common"] },
                {
                  $ifNull: [
                    "$product_description_override",
                    "$master_product.product_description",
                  ],
                },
                "$product_description",
              ],
            },
            null,
          ],
        },
        product_images: {
          $cond: [
            { $eq: ["$product_type", "common"] },
            {
              $cond: [
                {
                  $gt: [
                    { $size: { $ifNull: ["$product_images_override", []] } },
                    0,
                  ],
                },
                "$product_images_override",
                { $ifNull: ["$master_product.product_images", []] },
              ],
            },
            { $ifNull: ["$product_images", []] },
          ],
        },
        product_category_id: {
          $cond: [
            { $eq: ["$product_type", "common"] },
            "$master_product.product_category_id",
            "$product_category_id",
          ],
        },
        shop_id: 1,
        createdAt: 1,
        variant: {
          product_variant_id: {
            $cond: [
              { $eq: ["$product_type", "common"] },
              "$master_variant._id",
              "$variants._id",
            ],
          },
          label: {
            $cond: [
              { $eq: ["$product_type", "common"] },
              "$master_variant.label",
              "$variants.label",
            ],
          },
          quantity_value: {
            $cond: [
              { $eq: ["$product_type", "common"] },
              "$master_variant.quantity_value",
              "$variants.quantity_value",
            ],
          },
          quantity_unit: {
            $cond: [
              { $eq: ["$product_type", "common"] },
              "$master_variant.quantity_unit",
              "$variants.quantity_unit",
            ],
          },
          normalized_value: {
            $cond: [
              { $eq: ["$product_type", "common"] },
              "$master_variant.normalized_value",
              "$variants.normalized_value",
            ],
          },
          normalized_unit: {
            $cond: [
              { $eq: ["$product_type", "common"] },
              "$master_variant.normalized_unit",
              "$variants.normalized_unit",
            ],
          },
          sku: "$variants.seller_sku",
          price: "$variants.price",
          mrp: { $ifNull: ["$variants.mrp", null] },
          discount_percent: "$variants.discount_percent",
          available_quantity: "$variants.available_quantity",
          in_stock: { $gt: ["$variants.available_quantity", 0] },
        },
      },
    },
  ];

  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { product_name: { $regex: search, $options: "i" } },
          { brand_name: { $regex: search, $options: "i" } },
          { product_description: { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  pipeline.push(
    {
      $group: {
        _id: "$product_id",
        product_type: { $first: "$product_type" },
        product_name: { $first: "$product_name" },
        brand_name: { $first: "$brand_name" },
        product_description: { $first: "$product_description" },
        product_images: { $first: "$product_images" },
        product_category_id: { $first: "$product_category_id" },
        shop_id: { $first: "$shop_id" },
        createdAt: { $first: "$createdAt" },
        minimum_price: { $min: "$variant.price" },
        variants: { $push: "$variant" },
      },
    },
    {
      $sort: {
        [SORT_FIELDS[sortBy]]: sortDirection === "asc" ? 1 : -1,
        _id: 1,
      },
    },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        product_id: "$_id",
        product_type: 1,
        product_name: 1,
        brand_name: 1,
        product_description: 1,
        product_images: 1,
        product_category_id: 1,
        shop_id: 1,
        variants: 1,
      },
    },
  );

  const items = await sellerProductModel.aggregate(pipeline);
  return { items };
}

export const productRepository = {
  create(input) {
    return productModel.create(input);
  },

  findAvailableShop(shopId) {
    return shopModel
      .findOne({ _id: shopId, is_active: true, is_deleted: false })
      .select("_id")
      .lean();
  },

  findAvailableCategory(categoryId) {
    return productCategoryModel
      .findOne({ _id: categoryId, is_active: true, is_deleted: false })
      .select("_id")
      .lean();
  },

  findAvailableShopType(shopTypeId) {
    return shopTypeModel
      .findOne({ _id: shopTypeId, is_active: true, is_deleted: false })
      .select("_id")
      .lean();
  },

  listByShopAndCategory({ shopId, categoryId, skip, limit }) {
    return listSellerProducts({ shopId, categoryId, skip, limit });
  },

  listByShop(options) {
    return listSellerProducts(options);
  },

  listNearby(options) {
    return listNearbyProducts(options);
  },

  getPublicDetail(productId) {
    return getPublicProductDetail(productId);
  },
};
