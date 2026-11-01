import { createShopTypeController } from "./shop-type.controller.js";
import {
  publicShopTypeListSchema,
} from "./shop-type.schema.js";

export default async function shopTypeRoutes(app, { service }) {
  const controller = createShopTypeController(service);
  app.get(
    "/shop-types",
    { schema: { querystring: publicShopTypeListSchema } },
    controller.listPublic,
  );
}
