import { Types } from "mongoose";
import { schemaFactory } from "../../shared/database/schema-factory.js";

export const shopFavouriteModel = schemaFactory(
  "shop_favourite",
  {
    user_id: {
      type: Types.ObjectId,
      ref: "user",
      required: [true, "User id is required"],
    },
    shop_id: {
      type: Types.ObjectId,
      ref: "shop",
      required: [true, "Shop id is required"],
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {},
  (schema) => {
    schema.index(
      { user_id: 1, shop_id: 1 },
      { unique: true, name: "user_shop_favourite_unique_idx" },
    );
  },
);

export default shopFavouriteModel;
