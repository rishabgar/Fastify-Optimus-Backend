import { requireAuthenticated } from "../../shared/http/auth-guards.js";
import { createUserController } from "./user.controller.js";
import {
  getUserProfileResponseSchema,
  softDeleteUserResponseSchema,
} from "./user.schema.js";

export default async function userRoutes(app, { service }) {
  const controller = createUserController(service);

  app.get(
    "/users/me",
    {
      onRequest: requireAuthenticated,
      schema: { response: { 200: getUserProfileResponseSchema } },
    },
    controller.getProfile,
  );

  app.delete(
    "/users/me",
    {
      onRequest: requireAuthenticated,
      schema: { response: { 200: softDeleteUserResponseSchema } },
    },
    controller.softDelete,
  );
}
