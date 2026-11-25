import shopTypeModel from "./shop-type.model.js";

const PUBLIC_FIELDS = ["_id", "shop_type_name", "shop_type_image"].join(" ");
const NAME_COLLATION = { locale: "en", strength: 2 };

export const shopTypeRepository = {
  create(input) {
    return shopTypeModel.create(input);
  },

  findByName(name) {
    return shopTypeModel
      .findOne({ shop_type_name: name })
      .collation(NAME_COLLATION)
      .select("_id")
      .lean();
  },

  listPublic(filter, sort) {
    return shopTypeModel
      .find(filter)
      .select(PUBLIC_FIELDS)
      .sort(sort)
      .collation(NAME_COLLATION)
      .lean();
  },

};
