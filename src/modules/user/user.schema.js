export const softDeleteUserResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["user_id", "is_deleted"],
      properties: {
        user_id: { type: "string" },
        is_deleted: { type: "boolean", const: true },
      },
    },
  },
};
