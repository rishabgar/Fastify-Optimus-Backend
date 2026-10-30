import mongoose from "mongoose";

export function schemaFactory(
  modelName,
  definition,
  options = {},
  configureSchema,
) {
  if (mongoose.models[modelName]) {
    return mongoose.models[modelName];
  }

  const schema = new mongoose.Schema(definition, {
    timestamps: true,
    versionKey: false,
    ...options,
  });
  configureSchema?.(schema);

  return mongoose.model(modelName, schema);
}
