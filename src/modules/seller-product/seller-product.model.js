import { Schema, Types } from "mongoose";
import { schemaFactory } from "../../shared/database/schema-factory.js";

const quantityUnits = ["mg", "g", "kg", "ml", "ltr", "pcs"];
const normalizedUnits = ["g", "ml", "pcs"];

function isCommonProduct() {
  return this.product_type === "common";
}

function isIndividualProduct() {
  return this.product_type === "individual";
}

function parentIsCommonProduct() {
  return this.ownerDocument().product_type === "common";
}

function parentIsIndividualProduct() {
  return this.ownerDocument().product_type === "individual";
}

const imageSchema = new Schema(
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

const sellerVariantSchema = new Schema({
  product_variant_id: {
    type: Types.ObjectId,
    required: [parentIsCommonProduct, "Product variant id is required"],
    validate: {
      validator(value) {
        return parentIsCommonProduct.call(this) || value == null;
      },
      message: "Product variant id must be null for an individual product",
    },
  },
  label: {
    type: String,
    required: [parentIsIndividualProduct, "Variant label is required"],
    trim: true,
  },
  quantity_value: {
    type: Number,
    required: [parentIsIndividualProduct, "Variant quantity value is required"],
    min: 0,
  },
  quantity_unit: {
    type: String,
    enum: quantityUnits,
    required: [parentIsIndividualProduct, "Variant quantity unit is required"],
  },
  normalized_value: {
    type: Number,
    required: [parentIsIndividualProduct, "Variant normalized value is required"],
  },
  normalized_unit: {
    type: String,
    enum: normalizedUnits,
    required: [parentIsIndividualProduct, "Variant normalized unit is required"],
  },
  seller_sku: {
    type: String,
    required: [true, "Seller SKU is required"],
    trim: true,
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: 0,
  },
  mrp: {
    type: Number,
    min: 0,
  },
  discount_percent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  product_quantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  available_quantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  reserved_quantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
});

export const sellerProductModel = schemaFactory(
  "seller_product",
  {
    seller_id: {
      type: Types.ObjectId,
      ref: "user",
      required: [true, "Seller id is required"],
      index: true,
    },
    shop_id: {
      type: Types.ObjectId,
      ref: "shop",
      required: [true, "Shop id is required"],
      index: true,
    },
    product_type: {
      type: String,
      enum: ["common", "individual"],
      required: [true, "Product type is required"],
    },
    product_id: {
      type: Types.ObjectId,
      ref: "product",
      required: [isCommonProduct, "Product id is required for a common product"],
      validate: {
        validator(value) {
          return isCommonProduct.call(this) || value == null;
        },
        message: "Product id must be null for an individual product",
      },
    },
    product_name_override: {
      type: String,
      trim: true,
    },
    product_description_override: {
      type: String,
      trim: true,
    },
    product_images_override: {
      type: [imageSchema],
      default: undefined,
    },
    product_name: {
      type: String,
      required: [isIndividualProduct, "Product name is required"],
      trim: true,
    },
    brand_name: {
      type: String,
      required: [isIndividualProduct, "Brand name is required"],
      trim: true,
    },
    product_description: {
      type: String,
      trim: true,
    },
    product_category_id: {
      type: Types.ObjectId,
      ref: "product_category",
      required: [isIndividualProduct, "Product category id is required"],
    },
    product_images: {
      type: [imageSchema],
      default: undefined,
    },
    variants: {
      type: [sellerVariantSchema],
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
      { shop_id: 1, product_id: 1 },
      {
        unique: true,
        partialFilterExpression: { product_type: "common" },
        name: "shop_common_product_unique_idx",
      },
    );
    schema.index(
      { seller_id: 1, shop_id: 1, is_active: 1, is_deleted: 1 },
      { name: "seller_shop_status_idx" },
    );
    schema.index(
      { product_id: 1, is_active: 1, is_deleted: 1 },
      { name: "master_product_status_idx" },
    );
    schema.index(
      { shop_id: 1, is_active: 1, is_deleted: 1 },
      { name: "shop_status_idx" },
    );
    schema.index(
      { "variants.seller_sku": 1 },
      { unique: true, name: "seller_variant_sku_unique_idx" },
    );
  },
);

export default sellerProductModel;
