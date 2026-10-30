import { Types } from "mongoose";
import cartModel from "./cart.model.js";
import productModel from "../product/product.model.js";
import sellerProductModel from "../seller-product/seller-product.model.js";
import shopModel from "../shop/shop.model.js";

const CART_FIELDS = [
  "_id",
  "user_id",
  "items.product_id",
  "items.shop_id",
  "items.product_category_id",
  "items.variant_id",
  "items.quantity",
].join(" ");

export const cartRepository = {
  async findSellableItem(productId, variantId) {
    const sellerProduct = await sellerProductModel
      .findOne({
        _id: productId,
        is_active: true,
        is_deleted: false,
        variants: {
          $elemMatch: {
            $or: [
              { _id: variantId },
              { product_variant_id: variantId },
            ],
            is_active: true,
            available_quantity: { $gt: 0 },
          },
        },
      })
      .select("_id shop_id product_type product_id product_category_id variants.$")
      .lean();

    if (!sellerProduct) return null;

    const [shop, masterProduct] = await Promise.all([
      shopModel
        .findOne({
          _id: sellerProduct.shop_id,
          is_active: true,
          is_deleted: false,
        })
        .select("_id")
        .lean(),
      sellerProduct.product_type === "common"
        ? productModel
            .findOne({
              _id: sellerProduct.product_id,
              is_active: true,
              is_deleted: false,
            })
            .select("product_category_id variants._id variants.is_active")
            .lean()
        : null,
    ]);

    const masterVariantIsActive =
      sellerProduct.product_type !== "common" ||
      masterProduct?.variants.some(
        (variant) =>
          variant.is_active &&
          variant._id.toString() ===
            sellerProduct.variants[0].product_variant_id?.toString(),
      );
    const productCategoryId =
      sellerProduct.product_type === "common"
        ? masterProduct?.product_category_id
        : sellerProduct.product_category_id;
    if (!shop || !productCategoryId || !masterVariantIsActive) return null;

    return {
      product_id: sellerProduct._id,
      shop_id: sellerProduct.shop_id,
      product_category_id: productCategoryId,
      variant_id: sellerProduct.variants[0]._id,
      available_quantity: sellerProduct.variants[0].available_quantity,
    };
  },

  findByUserId(userId) {
    return cartModel.findOne({ user_id: userId }).select(CART_FIELDS);
  },

  getItemsByUserId(userId) {
    return cartModel.aggregate([
      { $match: { user_id: new Types.ObjectId(userId) } },
      { $unwind: { path: "$items", includeArrayIndex: "item_order" } },
      {
        $lookup: {
          from: sellerProductModel.collection.name,
          localField: "items.product_id",
          foreignField: "_id",
          as: "seller_product",
        },
      },
      {
        $set: {
          seller_product: { $arrayElemAt: ["$seller_product", 0] },
        },
      },
      { $match: { seller_product: { $type: "object" } } },
      {
        $lookup: {
          from: shopModel.collection.name,
          localField: "seller_product.shop_id",
          foreignField: "_id",
          as: "shop",
        },
      },
      { $set: { shop: { $arrayElemAt: ["$shop", 0] } } },
      { $match: { shop: { $type: "object" } } },
      {
        $lookup: {
          from: productModel.collection.name,
          localField: "seller_product.product_id",
          foreignField: "_id",
          as: "master_product",
        },
      },
      {
        $set: {
          master_product: { $arrayElemAt: ["$master_product", 0] },
          seller_variant: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ["$seller_product.variants", []] },
                  as: "variant",
                  cond: { $eq: ["$$variant._id", "$items.variant_id"] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $set: {
          master_variant: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ["$master_product.variants", []] },
                  as: "variant",
                  cond: {
                    $eq: [
                      "$$variant._id",
                      "$seller_variant.product_variant_id",
                    ],
                  },
                },
              },
              0,
            ],
          },
          resolved_images: {
            $cond: [
              { $eq: ["$seller_product.product_type", "common"] },
              {
                $cond: [
                  {
                    $gt: [
                      {
                        $size: {
                          $ifNull: [
                            "$seller_product.product_images_override",
                            [],
                          ],
                        },
                      },
                      0,
                    ],
                  },
                  "$seller_product.product_images_override",
                  { $ifNull: ["$master_product.product_images", []] },
                ],
              },
              { $ifNull: ["$seller_product.product_images", []] },
            ],
          },
        },
      },
      {
        $set: {
          resolved_image: {
            $ifNull: [
              {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$resolved_images",
                      as: "image",
                      cond: { $eq: ["$$image.is_main", true] },
                    },
                  },
                  0,
                ],
              },
              { $arrayElemAt: ["$resolved_images", 0] },
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          shop_id: { $toString: "$seller_product.shop_id" },
          item_order: 1,
          item: {
            product_id: { $toString: "$seller_product._id" },
            variant_id: { $toString: "$seller_variant._id" },
            variant_sku: "$seller_variant.seller_sku",
            variant_label: {
              $cond: [
                { $eq: ["$seller_product.product_type", "common"] },
                "$master_variant.label",
                "$seller_variant.label",
              ],
            },
            product_name: {
              $cond: [
                { $eq: ["$seller_product.product_type", "common"] },
                {
                  $ifNull: [
                    "$seller_product.product_name_override",
                    "$master_product.product_name",
                  ],
                },
                "$seller_product.product_name",
              ],
            },
            product_price: "$seller_variant.price",
            product_image: "$resolved_image.url",
            product_availability: {
              $and: [
                { $eq: ["$seller_product.is_active", true] },
                { $eq: ["$seller_product.is_deleted", false] },
                { $eq: ["$shop.is_active", true] },
                { $eq: ["$shop.is_deleted", false] },
                { $eq: ["$seller_variant.is_active", true] },
                {
                  $gte: [
                    "$seller_variant.available_quantity",
                    "$items.quantity",
                  ],
                },
                {
                  $or: [
                    { $eq: ["$seller_product.product_type", "individual"] },
                    {
                      $and: [
                        { $eq: ["$master_product.is_active", true] },
                        { $eq: ["$master_product.is_deleted", false] },
                        { $eq: ["$master_variant.is_active", true] },
                      ],
                    },
                  ],
                },
              ],
            },
            available_quantity: "$seller_variant.available_quantity",
            quantity: "$items.quantity",
          },
        },
      },
      { $match: { "item.variant_id": { $type: "string" } } },
      { $sort: { item_order: 1 } },
      {
        $group: {
          _id: "$shop_id",
          shop_order: { $first: "$item_order" },
          items: { $push: "$item" },
        },
      },
      { $sort: { shop_order: 1 } },
      { $project: { _id: 0, shop_id: "$_id", items: 1 } },
    ]);
  },

  async create(cart) {
    const createdCart = await cartModel.create(cart);
    return cartModel.findById(createdCart._id).select(CART_FIELDS);
  },

  async save(cart) {
    await cart.save();
    return cartModel.findById(cart._id).select(CART_FIELDS);
  },

  updateItem(userId, identity, updates) {
    return cartModel
      .findOneAndUpdate(
        {
          user_id: userId,
          items: {
            $elemMatch: {
              product_id: identity.product_id,
              shop_id: identity.shop_id,
              product_category_id: identity.product_category_id,
              variant_id: identity.variant_id,
            },
          },
        },
        {
          $set: {
            "items.$.quantity": updates.quantity,
          },
        },
        { returnDocument: "after", runValidators: true },
      )
      .select(CART_FIELDS);
  },

  removeItem(userId, identity) {
    return cartModel
      .findOneAndUpdate(
        { user_id: userId },
        {
          $pull: {
            items: {
              product_id: identity.product_id,
              shop_id: identity.shop_id,
              product_category_id: identity.product_category_id,
            },
          },
        },
        { returnDocument: "after", runValidators: true },
      )
      .select(CART_FIELDS);
  },
};
