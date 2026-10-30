import { Schema, Types } from "mongoose";
import { schemaFactory } from "../../shared/database/schema-factory.js";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const operatingHoursSchema = new Schema(
  {
    open: {
      type: String,
      required: [true, "Opening time is required"],
      match: [timePattern, "Opening time must use HH:mm format"],
    },
    close: {
      type: String,
      required: [true, "Closing time is required"],
      match: [timePattern, "Closing time must use HH:mm format"],
    },
  },
  { _id: false },
);

const sellerLocationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      required: [true, "Seller coordinates are required"],
      validate: {
        validator(coordinates) {
          return (
            Array.isArray(coordinates) &&
            coordinates.length === 2 &&
            coordinates.every(Number.isFinite) &&
            coordinates[0] >= -180 &&
            coordinates[0] <= 180 &&
            coordinates[1] >= -90 &&
            coordinates[1] <= 90
          );
        },
        message:
          "Seller coordinates must be [longitude, latitude] within valid ranges",
      },
    },
  },
  { _id: false },
);

export const shopModel = schemaFactory(
  "shop",
  {
    shop_name: {
      type: String,
      required: [true, "Shop name is required"],
      trim: true,
    },
    shop_address: {
      type: String,
      required: [true, "Shop address is required"],
      trim: true,
    },
    shop_image: {
      type: String,
      trim: true,
    },
    seller_id: {
      type: Types.ObjectId,
      ref: "user",
      required: [true, "Seller id is required"],
      index: true,
    },
    is_closed: {
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    operating_hours: {
      type: operatingHoursSchema,
      required: [true, "Operating hours are required"],
    },
    gst_number: {
      type: String,
      trim: true,
      minlength: [15, "GST number must be exactly 15 characters"],
      maxlength: [15, "GST number must be exactly 15 characters"],
    },
    shop_type_id: {
      type: Types.ObjectId,
      ref: "shop_type",
      required: [true, "Shop type id is required"],
      index: true,
    },
    seller_location: {
      type: sellerLocationSchema,
      required: [true, "Seller location is required"],
    },
  },
  {},
  (schema) => {
    schema.index(
      { seller_location: "2dsphere" },
      { name: "shop_seller_location_2dsphere_idx" },
    );
    schema.index(
      { seller_id: 1, is_active: 1, is_deleted: 1 },
      { name: "shop_seller_status_idx" },
    );
    schema.index(
      { shop_type_id: 1, is_active: 1, is_deleted: 1 },
      { name: "shop_type_status_idx" },
    );
  },
);

export default shopModel;
