import { createShopTypeController } from "./shop-type.controller.js";
import {
  createShopTypeSchema,
  publicShopTypeListSchema,
} from "./shop-type.schema.js";

export default async function shopTypeRoutes(app, { service }) {
  const controller = createShopTypeController(service);
  app.post(
    "/shop-types",
    { schema: { body: createShopTypeSchema } },
    controller.create,
  );

  app.get(
    "/shop-types",
    { schema: { querystring: publicShopTypeListSchema } },
    controller.listPublic,
  );
}
