import { schemaFactory } from "../../shared/database/schema-factory.js";

export const userModel = schemaFactory(
  "user",
  {
    first_name: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },

    last_name: {
      type: String,
      trim: true,
    },

    user_email: {
      type: String,
    },

    user_phone_no: {
      type: String,
      trim: true,
    },

    password: {
      type: String,
      select: false,
    },

    profile_image: {
      type: String,
    },

    user_type: {
      type: String,
      enum: ["customer", "seller", "admin", "delivery_partner"],
      required: [true, "User type is required"],
    },

    is_deleted: {
      type: Boolean,
      default: false,
    },

    user_location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },

    delivery_partner_status: {
      type: String,
      enum: ["available", "busy", "offline"],
    },

    active_orders: {
      type: Number,
      default: 0,
      min: 0,
    },

    reward_tokens: {
      type: Number,
      default: 0,
      min: 0,
    },

    first_order_discount_used: {
      type: Boolean,
      default: false,
    },

    vehicle_type: {
      type: String,
      enum: ["bike", "scooter", "car", "bicycle", "other", null],
    },

    fcm_tokens: {
      type: [
        {
          token: String,
          device_type: String,
          _id: false,
        },
      ],
      default: [],
    },

    saved_addresses: [
      {
        recipient_name: {
          type: String,
          trim: true,
        },
        phone: {
          type: String,
          trim: true,
        },
        address: {
          type: String,
          required: true,
          trim: true,
        },
        coordinates: {
          type: [Number],
          default: undefined,
        },
        is_default: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {},
  (schema) => {
    schema.index({ user_location: "2dsphere" });
    schema.index({ is_deleted: 1 });
    schema.index(
      { user_email: 1 },
      {
        unique: true,
        partialFilterExpression: {
          user_email: { $type: "string" },
        },
      },
    );
    schema.index(
      { user_phone_no: 1 },
      {
        unique: true,
        partialFilterExpression: {
          user_phone_no: { $type: "string" },
        },
      },
    );
  },
);
