import { requireCustomer } from "../../shared/http/auth-guards.js";
import { createShopFavouriteController } from "./shop-favourite.controller.js";
import {
  shopFavouriteListSchema,
  shopFavouriteIdParamsSchema,
  shopIdParamsSchema,
  updateFavouriteNoteSchema,
} from "./shop-favourite.schema.js";
import { validateAddShopFavouriteBody } from "./shop-favourite.validator.js";

export default async function shopFavouriteRoutes(app, { service }) {
  const controller = createShopFavouriteController(service);
  const customerOnly = { onRequest: requireCustomer };

  app.post(
    "/:shop_id",
    {
      ...customerOnly,
      preValidation: validateAddShopFavouriteBody,
      schema: {
        params: shopIdParamsSchema,
      },
    },
    controller.add,
  );
  app.get(
    "/",
    { ...customerOnly, schema: { querystring: shopFavouriteListSchema } },
    controller.list,
  );
  app.delete(
    "/:favourite_id",
    { ...customerOnly, schema: { params: shopFavouriteIdParamsSchema } },
    controller.remove,
  );
  app.patch(
    "/:favourite_id",
    {
      ...customerOnly,
      schema: {
        params: shopFavouriteIdParamsSchema,
        body: updateFavouriteNoteSchema,
      },
    },
    controller.updateNote,
  );
}
