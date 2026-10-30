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

        product_id: {
          type: Types.ObjectId,
          required: true,
        },

        shop_id: {
          type: Types.ObjectId,
          required: true,
        },

        product_category_id: {
          type: Types.ObjectId,
          required: true,
        },

        variant_id: {
          type: Types.ObjectId,
          required: true,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
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
