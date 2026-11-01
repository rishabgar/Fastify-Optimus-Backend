import { requireCustomer } from "../../shared/http/auth-guards.js";
import { createCartController } from "./cart.controller.js";
import {
  addCartItemSchema,
  addCartItemResponseSchema,
  cartResponseSchema,
  getCartResponseSchema,
  cartUserQuerySchema,
  removeCartItemResponseSchema,
  removeCartItemParamsSchema,
  updateCartItemSchema,
  updateCartItemResponseSchema,
} from "./cart.schema.js";

export default async function cartRoutes(app, { cartService }) {
  const controller = createCartController(cartService);

  app.post(
    "/",
    {
      onRequest: requireCustomer,
      schema: {
        body: addCartItemSchema,
        response: { 201: addCartItemResponseSchema },
      },
    },
    controller.addItem,
  );

  app.patch(
    "/",
    {
      onRequest: requireCustomer,
      schema: {
        body: updateCartItemSchema,
        response: { 200: updateCartItemResponseSchema },
      },
    },
    controller.updateItem,
  );

  app.delete(
    "/seller_product_id/:seller_product_id/shop_id/:shop_id/product_category_id/:product_category_id",
    {
      schema: {
        params: removeCartItemParamsSchema,
        querystring: cartUserQuerySchema,
        response: { 200: removeCartItemResponseSchema },
      },
    },
    controller.removeItem,
  );

  app.get(
    "/",
    {
      onRequest: requireCustomer,
      schema: {
        response: { 200: getCartResponseSchema },
      },
    },
    controller.getCart,
  );
}
