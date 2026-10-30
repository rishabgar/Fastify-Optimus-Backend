import productCategoryModel from "../product-category/product-category.model.js";
import shopModel from "../shop/shop.model.js";
import shopTypeModel from "./shop-type.model.js";

const ADMIN_FIELDS = [
  "_id",
  "shop_type_name",
  "shop_type_image",
  "is_active",
  "is_deleted",
  "createdAt",
  "updatedAt",
].join(" ");

const PUBLIC_FIELDS = ["_id", "shop_type_name", "shop_type_image"].join(" ");
const NAME_COLLATION = { locale: "en", strength: 2 };

export const shopTypeRepository = {
  create(input) {
    return shopTypeModel.create(input);
  },

  findByName(name, excludeId) {
    const filter = { shop_type_name: name };
    if (excludeId) filter._id = { $ne: excludeId };
    return shopTypeModel.findOne(filter).collation(NAME_COLLATION).lean();
  },

  findById(shopTypeId, { includeDeleted = false } = {}) {
    const filter = { _id: shopTypeId };
    if (!includeDeleted) filter.is_deleted = false;
    return shopTypeModel.findOne(filter).select(ADMIN_FIELDS).lean();
  },

  async listAdmin({ filter, sort, skip, limit }) {
    const [items, total] = await Promise.all([
      shopTypeModel
        .find(filter)
        .select(ADMIN_FIELDS)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .collation(NAME_COLLATION)
        .lean(),
      shopTypeModel.countDocuments(filter),
    ]);
    return { items, total };
  },

  listPublic(filter) {
    return shopTypeModel
      .find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ shop_type_name: 1 })
      .collation(NAME_COLLATION)
      .lean();
  },

  update(shopTypeId, updates) {
    return shopTypeModel
      .findOneAndUpdate(
        { _id: shopTypeId, is_deleted: false },
        { $set: updates },
        { returnDocument: "after", runValidators: true },
      )
      .select(ADMIN_FIELDS)
      .lean();
  },

  softDelete(shopTypeId) {
    return shopTypeModel
      .findOneAndUpdate(
        { _id: shopTypeId, is_deleted: false },
        { $set: { is_deleted: true, is_active: false } },
        { returnDocument: "after", runValidators: true },
      )
      .select(ADMIN_FIELDS)
      .lean();
  },

  restore(shopTypeId) {
    return shopTypeModel
      .findOneAndUpdate(
        { _id: shopTypeId, is_deleted: true },
        { $set: { is_deleted: false, is_active: false } },
        { returnDocument: "after", runValidators: true },
      )
      .select(ADMIN_FIELDS)
      .lean();
  },

  hasReferencingShops(shopTypeId) {
    return shopModel.exists({
      shop_type_id: shopTypeId,
      is_deleted: false,
    });
  },

  hasReferencingCategories(shopTypeId) {
    return productCategoryModel.exists({
      shop_type_ids: shopTypeId,
      is_deleted: false,
    });
  },
};
