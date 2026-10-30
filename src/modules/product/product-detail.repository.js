import { Types } from "mongoose";
import sellerProductModel from "../seller-product/seller-product.model.js";
import shopModel from "../shop/shop.model.js";
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

export async function getPublicProductDetail(productId) {
  const [product] = await sellerProductModel.aggregate([
    {
      $match: {
        _id: new Types.ObjectId(productId),
        is_active: true,
        is_deleted: false,
      },
    },
    {
      $lookup: {
        from: shopModel.collection.name,
        localField: "shop_id",
        foreignField: "_id",
        pipeline: [
          { $match: { is_active: true, is_deleted: false } },
          {
            $project: {
              _id: 1,
              shop_name: 1,
              shop_image: 1,
              is_closed: 1,
              shop_type_id: 1,
            },
          },
        ],
        as: "shop",
      },
    },
    { $set: { shop: { $arrayElemAt: ["$shop", 0] } } },
    { $match: { shop: { $type: "object" } } },
    { $unwind: "$variants" },
    { $match: { "variants.is_active": true } },
    {
      $lookup: {
        from: productModel.collection.name,
        let: { masterProductId: "$product_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$masterProductId"] },
                  { $eq: ["$is_active", true] },
                  { $eq: ["$is_deleted", false] },
                ],
              },
            },
          },
        ],
        as: "master_product",
      },
    },
    { $set: { master_product: { $arrayElemAt: ["$master_product", 0] } } },
    { $set: { master_variant: activeMasterVariant } },
    {
      $match: {
        $expr: {
          $or: [
            { $eq: ["$product_type", "individual"] },
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
        shop_type_id: "$shop.shop_type_id",
        shop: {
          shop_name: "$shop.shop_name",
          shop_image: { $ifNull: ["$shop.shop_image", null] },
          is_closed: "$shop.is_closed",
        },
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
        shop_type_id: { $first: "$shop_type_id" },
        shop: { $first: "$shop" },
        variants: { $push: "$variant" },
      },
    },
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
        shop_type_id: 1,
        shop: 1,
        variants: 1,
      },
    },
  ]);

  return product ?? null;
}
