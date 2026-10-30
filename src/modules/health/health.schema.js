export const healthResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["status"],
      properties: {
        status: { type: "string", const: "ok" },
      },
    },
  },
};
