import fastifyJwt from "@fastify/jwt";
import { userModel } from "./user.model.js";
import userRoutes from "./user.routes.js";
import { createUserService } from "./user.service.js";

export { userModel } from "./user.model.js";
export { createUserService } from "./user.service.js";

export default async function userModule(app, options) {
  if (!options.jwtSecret) throw new Error("JWT_SECRET is required");

  await app.register(fastifyJwt, { secret: options.jwtSecret });
  app.decorate("userModel", userModel);

  const service = options.userService ?? createUserService();
  await app.register(userRoutes, { service });
}
