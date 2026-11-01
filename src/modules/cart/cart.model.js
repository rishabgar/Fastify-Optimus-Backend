import { Types } from "mongoose";
import { schemaFactory } from "../../shared/database/schema-factory.js";

export const cartModel = schemaFactory(
  "cart",
  {
    user_id: {
      type: Types.ObjectId,
      required: [true, "User id is required"],
    },

    items: [
      {
        _id: false,

        seller_product_id: {
          type: Types.ObjectId,
          ref: "seller_product",
          required: true,
        },

        shop_id: {
          type: Types.ObjectId,
          ref: "shop",
          required: true,
        },

        product_category_id: {
          type: Types.ObjectId,
          default: null,
        },

        variant_id: {
          type: Types.ObjectId,
          required: true,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
          max: 20,
          default: 1,
        },
      },
    ],
  },
  {},
  (schema) => {
    schema.index(
      { user_id: 1 },
      {
        unique: true,
        name: "cart_user_id_unique_idx",
      },
    );
  },
);

export default cartModel;
