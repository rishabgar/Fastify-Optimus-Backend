const objectIdSchema = {
  type: "string",
  pattern: "^[0-9a-fA-F]{24}$",
};

const noteSchema = {
  anyOf: [
    { type: "null" },
    { type: "string", maxLength: 500 },
  ],
};

export const updateFavouriteNoteSchema = {
  type: "object",
  additionalProperties: false,
  propertyNames: { enum: ["note"] },
  required: ["note"],
  properties: { note: noteSchema },
};

export const shopIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shop_id"],
  properties: { shop_id: objectIdSchema },
};

export const shopFavouriteIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["favourite_id"],
  properties: { favourite_id: objectIdSchema },
};

export const shopFavouriteListSchema = {
  type: "object",
  additionalProperties: false,
  required: ["latitude", "longitude"],
  properties: {
    latitude: { type: "number", minimum: -90, maximum: 90 },
    longitude: { type: "number", minimum: -180, maximum: 180 },
    distance: {
      type: "number",
      exclusiveMinimum: 0,
      maximum: Number.MAX_VALUE,
      default: 1000,
    },
  },
};
