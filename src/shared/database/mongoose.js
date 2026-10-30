import mongoose from "mongoose";

export default async function mongoosePlugin(app, { uri }) {
  if (!uri) {
    throw new Error(
      "Database connection failed: MONGODB_URI is missing. Add MONGODB_URI to your .env file and make sure the environment file is loaded before starting the server.",
    );
  }

  await mongoose.connect(uri);

  app.addHook("onClose", async () => {
    await mongoose.disconnect();
  });
}
