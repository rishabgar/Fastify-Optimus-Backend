export const createShopTypeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shop_type_name", "shop_type_image"],
  properties: {
    shop_type_name: { type: "string", minLength: 1, maxLength: 150 },
    shop_type_image: { type: "string", minLength: 1, maxLength: 2048 },
  },
};

export const publicShopTypeListSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", minLength: 1, maxLength: 150 },
    sort_by: { type: "string", enum: ["name", "created_at"], default: "name" },
    sort_direction: { type: "string", enum: ["asc", "desc"], default: "asc" },
  },
};
