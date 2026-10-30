import { getHealth } from "./health.controller.js";
import { healthResponseSchema } from "./health.schema.js";

export default async function healthRoutes(app) {
  app.get(
    "/",
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    getHealth,
  );
}
