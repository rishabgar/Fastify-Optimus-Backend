import { schemaFactory } from "../../shared/database/schema-factory.js";

export const shopTypeModel = schemaFactory(
  "shop_type",
  {
    shop_type_name: {
      type: String,
      required: [true, "Shop type name is required"],
      trim: true,
    },
    shop_type_image: {
      type: String,
      required: [true, "Shop type image is required"],
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  {},
  (schema) => {
    schema.index(
      { shop_type_name: 1 },
      {
        unique: true,
        collation: { locale: "en", strength: 2 },
        name: "shop_type_name_unique_ci_idx",
      },
    );
  },
);

export default shopTypeModel;
