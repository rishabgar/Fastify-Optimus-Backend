import productCategoryModel from "../product-category/product-category.model.js";
import shopModel from "../shop/shop.model.js";
import productModel from "../product/product.model.js";
import sellerProductModel from "./seller-product.model.js";

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

  findCommonByShopAndProduct(shopId, productId) {
    return sellerProductModel
      .findOne({ shop_id: shopId, product_id: productId, product_type: "common" })
      .select("_id")
      .lean();
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
