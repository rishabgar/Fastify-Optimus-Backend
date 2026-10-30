import { Types } from "mongoose";
import { HttpError } from "../../shared/http/http-error.js";
import {
  DEV_EDITABLE_SHOP_FIELDS,
  SELLER_EDITABLE_SHOP_FIELDS,
} from "./shop.constants.js";
import { shopRepository } from "./shop.repository.js";

const SELLER_SORT_FIELDS = {
  created_at: "createdAt",
  name: "shop_name",
  updated_at: "updatedAt",
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function notFoundError() {
  return new HttpError(404, "Shop not found", { field: "shop_id" });
}

function pick(input, fields) {
  return Object.fromEntries(
    fields
      .filter((field) => input[field] !== undefined)
      .map((field) => [field, input[field]]),
  );
}

function omitMongooseTimestamps(value) {
  const { createdAt, updatedAt, ...response } = value;
  return response;
}

function pageResult(items, total, page, limit) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function currentMinutesInKolkata(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function isOutsideOperatingHours(operatingHours, date) {
  const open = timeToMinutes(operatingHours.open);
  const close = timeToMinutes(operatingHours.close);
  const current = currentMinutesInKolkata(date);

  if (open < close) return current < open || current >= close;
  if (open > close) return current >= close && current < open;
  return true;
}

function nearbyShopResponse(shop, date) {
  return {
    shop_name: shop.shop_name,
    shop_address: shop.shop_address,
    seller_id: shop.seller_id,
    is_closed:
      shop.is_closed || isOutsideOperatingHours(shop.operating_hours, date),
    operating_hours: shop.operating_hours,
    shop_type_id: shop.shop_type_id,
    ...(shop.shop_image ? { shop_image: shop.shop_image } : {}),
    distance: shop.distance,
    shop_id: shop._id,
    shop_type_name: shop.shop_type_name,
  };
}

export function createShopService({
  repository = shopRepository,
  now = () => new Date(),
} = {}) {
  async function validateShopType(shopTypeId) {
    const shopType = await repository.findActiveShopType(shopTypeId);
    if (!shopType) {
      throw new HttpError(400, "Active shop type not found", {
        field: "shop_type_id",
      });
    }
    return shopType;
  }

  async function verifyOwnership(shopId, sellerId) {
    const shop = await repository.findOwned(shopId, sellerId);
    if (!shop) throw notFoundError();
    return shop;
  }

  return {
    validateShopType,
    verifyOwnership,

    async create(input, sellerId) {
      await validateShopType(input.shop_type_id);
      return repository.create({ ...input, seller_id: sellerId });
    },

    async listSeller(sellerId, query) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const filter = { seller_id: sellerId, is_deleted: false };
      if (query.search) {
        filter.shop_name = {
          $regex: escapeRegExp(query.search.trim()),
          $options: "i",
        };
      }
      if (query.is_active !== undefined) filter.is_active = query.is_active;
      if (query.is_closed !== undefined) filter.is_closed = query.is_closed;
      if (query.shop_type_id) filter.shop_type_id = query.shop_type_id;

      const direction = query.sort_direction === "asc" ? 1 : -1;
      const sort = {
        [SELLER_SORT_FIELDS[query.sort_by ?? "created_at"]]: direction,
      };
      const result = await repository.listSeller({
        filter,
        sort,
        skip: (page - 1) * limit,
        limit,
      });
      return pageResult(result.items, result.total, page, limit);
    },

    async update(shopId, sellerId, input) {
      await verifyOwnership(shopId, sellerId);
      const updates = pick(input, SELLER_EDITABLE_SHOP_FIELDS);
      if (updates.shop_type_id) await validateShopType(updates.shop_type_id);
      const shop = await repository.updateOwned(shopId, sellerId, updates);
      if (!shop) throw notFoundError();
      return omitMongooseTimestamps(shop);
    },

    async remove(shopId, sellerId) {
      await verifyOwnership(shopId, sellerId);
      if (await repository.hasBlockingOrders(shopId)) {
        throw new HttpError(
          409,
          "Shop cannot be deleted while it has active orders",
          { field: "shop_id" },
        );
      }
      const shop = await repository.softDeleteOwned(shopId, sellerId);
      if (!shop) throw notFoundError();
      return shop;
    },

    async listCustomer(query) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const match = { is_active: true, is_deleted: false };
      if (query.search) {
        match.shop_name = {
          $regex: escapeRegExp(query.search.trim()),
          $options: "i",
        };
      }
      if (query.shop_type_id) match.shop_type_id = query.shop_type_id;
      if (query.is_closed !== undefined) match.is_closed = query.is_closed;

      let result;
      if (query.longitude !== undefined || query.latitude !== undefined) {
        if (query.longitude === undefined || query.latitude === undefined) {
          throw new HttpError(
            400,
            "Longitude and latitude must be provided together",
          );
        }
        result = await repository.listCustomerNearby({
          coordinates: [query.longitude, query.latitude],
          maxDistance: (query.radius ?? 10) * 1000,
          match,
          skip: (page - 1) * limit,
          limit,
        });
      } else {
        const direction = query.sort_direction === "desc" ? -1 : 1;
        result = await repository.listCustomer({
          match,
          sort: {
            [query.sort_by === "created_at" ? "createdAt" : "shop_name"]:
              direction,
          },
          skip: (page - 1) * limit,
          limit,
        });
      }
      return pageResult(result.items, result.total, page, limit);
    },

    async listNearby(query) {
      const match = { is_active: true, is_deleted: false };
      if (query.search) {
        match.shop_name = {
          $regex: escapeRegExp(query.search.trim()),
          $options: "i",
        };
      }
      if (query.shop_type_id) match.shop_type_id = query.shop_type_id;

      const shops = await repository.listNearby({
        coordinates: [query.longitude, query.latitude],
        maxDistance: query.distance ?? 1000,
        match,
      });
      const currentTime = now();
      return shops.map((shop) => nearbyShopResponse(shop, currentTime));
    },

    async getDetail(shopId, sellerId) {
      if (!Types.ObjectId.isValid(sellerId)) {
        throw new HttpError(401, "Invalid authentication credentials");
      }
      if (!Types.ObjectId.isValid(shopId)) {
        throw new HttpError(400, "Invalid shop id");
      }

      const shop = await repository.findOwnedDetail(shopId, sellerId);
      if (!shop) throw notFoundError();
      return {
        shop_id: shop._id,
        shop_name: shop.shop_name,
        shop_address: shop.shop_address,
        shop_image: shop.shop_image,
        is_closed: shop.is_closed,
        operating_hours: shop.operating_hours,
        seller_location: shop.seller_location,
      };
    },

    async updateForDevelopment(shopId, input) {
      const updates = pick(input, DEV_EDITABLE_SHOP_FIELDS);
      if (updates.shop_type_id) await validateShopType(updates.shop_type_id);
      const shop = await repository.updateForDevelopment(shopId, updates);
      if (!shop) throw notFoundError();
      return shop;
    },
  };
}
