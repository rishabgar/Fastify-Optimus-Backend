export const publicShopTypeListSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", minLength: 1, maxLength: 150 },
    sort_by: { type: "string", enum: ["name", "created_at"], default: "name" },
    sort_direction: { type: "string", enum: ["asc", "desc"], default: "asc" },
  },
};
