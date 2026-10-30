import { Schema, Types } from "mongoose";
import { schemaFactory } from "../../shared/database/schema-factory.js";

const quantityUnits = ["mg", "g", "kg", "ml", "ltr", "pcs"];
const normalizedUnits = ["g", "ml", "pcs"];

const productImageSchema = new Schema(
  {
    url: {
      type: String,
      required: [true, "Product image URL is required"],
      trim: true,
    },
    alt: {
      type: String,
      trim: true,
    },
    is_main: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const productVariantSchema = new Schema({
  label: {
    type: String,
    required: [true, "Variant label is required"],
    trim: true,
  },
  quantity_value: {
    type: Number,
    required: [true, "Variant quantity value is required"],
    min: 0,
  },
  quantity_unit: {
    type: String,
    enum: quantityUnits,
    required: [true, "Variant quantity unit is required"],
  },
  normalized_value: {
    type: Number,
    required: [true, "Variant normalized value is required"],
  },
  normalized_unit: {
    type: String,
    enum: normalizedUnits,
    required: [true, "Variant normalized unit is required"],
  },
  sku: {
    type: String,
    required: [true, "Variant SKU is required"],
    trim: true,
  },
  is_default: {
    type: Boolean,
    default: false,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  sort_order: {
    type: Number,
    default: 0,
    min: 0,
  },
});

export const productModel = schemaFactory(
  "product",
  {
    product_name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    brand_name: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
    },
    product_description: {
      type: String,
      trim: true,
    },
    product_category_id: {
      type: Types.ObjectId,
      ref: "product_category",
      required: [true, "Product category id is required"],
      index: true,
    },
    product_images: {
      type: [productImageSchema],
      default: [],
    },
    variants: {
      type: [productVariantSchema],
      default: [],
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
      { product_category_id: 1, is_active: 1, is_deleted: 1 },
      { name: "product_category_status_idx" },
    );
    schema.index(
      { "variants.sku": 1 },
      { unique: true, name: "product_variant_sku_unique_idx" },
    );
  },
);

export default productModel;
