import fastifyJwt from "@fastify/jwt";
import uploadRoutes from "./upload.routes.js";
import { createUploadService } from "./upload.service.js";

export default async function uploadModule(app, options) {
  if (!options.jwtSecret) throw new Error("JWT_SECRET is required");
  await app.register(fastifyJwt, { secret: options.jwtSecret });
  await app.register(uploadRoutes, { service: options.uploadService ?? createUploadService() });
}
