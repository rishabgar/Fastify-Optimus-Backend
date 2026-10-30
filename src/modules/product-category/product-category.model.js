import { Types } from "mongoose";
import { schemaFactory } from "../../shared/database/schema-factory.js";

export const productCategoryModel = schemaFactory(
  "product_category",
  {
    product_category_name: {
      type: String,
      required: [true, "Product category name is required"],
      trim: true,
    },
    product_category_description: {
      type: String,
      trim: true,
    },
    product_category_image: {
      type: String,
      trim: true,
    },
    shop_type_ids: {
      type: [
        {
          type: Types.ObjectId,
          ref: "shop_type",
        },
      ],
      required: [true, "At least one shop type is required"],
      validate: {
        validator(shopTypeIds) {
          return shopTypeIds.length > 0;
        },
        message: "At least one shop type is required",
      },
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    sort_order: {
      type: Number,
      default: 0,
      min: 0,
    },
    created_by: {
      type: Types.ObjectId,
      ref: "user",
      required: [true, "Creator admin id is required"],
    },
    updated_by: {
      type: Types.ObjectId,
      ref: "user",
    },
  },
  {},
  (schema) => {
    schema.index(
      { product_category_name: 1 },
      {
        unique: true,
        collation: { locale: "en", strength: 2 },
        name: "product_category_name_unique_ci_idx",
      },
    );
    schema.index(
      { shop_type_ids: 1, is_active: 1, is_deleted: 1, sort_order: 1 },
      { name: "product_category_shop_type_status_sort_idx" },
    );
  },
);

export default productCategoryModel;
