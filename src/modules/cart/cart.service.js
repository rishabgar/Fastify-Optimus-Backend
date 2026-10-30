import { HttpError } from "../../shared/http/http-error.js";
import { cartRepository } from "./cart.repository.js";

function sameItem(item, identity, { includeVariant = true } = {}) {
  return (
    item.product_id.toString() === identity.product_id.toString() &&
    item.shop_id.toString() === identity.shop_id.toString() &&
    item.product_category_id.toString() ===
      identity.product_category_id.toString() &&
    (!includeVariant ||
      item.variant_id.toString() === identity.variant_id.toString())
  );
}

function itemNotFoundError() {
  return new HttpError(404, "Cart item not found");
}

function unavailableItemError() {
  return new HttpError(404, "Product variant is unavailable");
}

function insufficientStockError(availableQuantity) {
  return new HttpError(409, `Available quantity: ${availableQuantity}`);
}

function toCartResponse(cart) {
  return {
    id: (cart.id ?? cart._id).toString(),
    user_id: cart.user_id.toString(),
    items: cart.items.map((item) => ({
      product_id: item.product_id.toString(),
      shop_id: item.shop_id.toString(),
      product_category_id: item.product_category_id.toString(),
      variant_id: item.variant_id.toString(),
      quantity: item.quantity,
    })),
  };
}

export function createCartService({ repository = cartRepository } = {}) {
  return {
    async addItem(user_id, { product_id, variant_id, quantity = 1 }) {
      const item = await repository.findSellableItem(product_id, variant_id);
      if (!item) throw unavailableItemError();
      if (quantity > item.available_quantity) {
        throw insufficientStockError(item.available_quantity);
      }

      const cartItem = {
        product_id: item.product_id,
        shop_id: item.shop_id,
        product_category_id: item.product_category_id,
        variant_id: item.variant_id,
        quantity,
      };
      let cart = await repository.findByUserId(user_id);

      if (!cart) {
        cart = await repository.create({ user_id, items: [cartItem] });
        return toCartResponse(cart);
      }

      if (cart.items.some((existingItem) => sameItem(existingItem, cartItem))) {
        return toCartResponse(cart);
      }

      cart.items.push(cartItem);
      cart = await repository.save(cart);
      return toCartResponse(cart);
    },

    async updateItem(user_id, { product_id, variant_id, quantity }) {
      const item = await repository.findSellableItem(product_id, variant_id);
      if (!item) throw unavailableItemError();
      if (quantity > item.available_quantity) {
        throw insufficientStockError(item.available_quantity);
      }

      const updatedCart = await repository.updateItem(
        user_id,
        {
          product_id: item.product_id,
          shop_id: item.shop_id,
          product_category_id: item.product_category_id,
          variant_id: item.variant_id,
        },
        { quantity },
      );

      if (!updatedCart) {
        throw itemNotFoundError();
      }

      return toCartResponse(updatedCart);
    },

    async removeItem(userId, identity) {
      const updatedCart = await repository.removeItem(userId, identity);
      return updatedCart ? toCartResponse(updatedCart) : null;
    },

    async getCart(userId) {
      return repository.getItemsByUserId(userId);
    },
  };
}
