import { HttpError } from "../../shared/http/http-error.js";
import { couponRepository } from "./coupon.repository.js";

const SORT_FIELDS = {
  created_at: "createdAt",
  code: "code",
  start_date: "start_date",
  end_date: "end_date",
};

function notFoundError() {
  return new HttpError(404, "Coupon not found", { field: "coupon_id" });
}

function duplicateCodeError() {
  return new HttpError(409, "Coupon code already exists", { field: "code" });
}

function normalizeCode(code) {
  return code.trim().toUpperCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateCampaign(input) {
  if (input.type === "percentage" && input.value > 100) {
    throw new HttpError(400, "Percentage coupon value cannot exceed 100", {
      field: "value",
    });
  }
  if (
    input.start_date &&
    input.end_date &&
    new Date(input.start_date) > new Date(input.end_date)
  ) {
    throw new HttpError(400, "Coupon end date must be after start date", {
      field: "end_date",
    });
  }
  if (
    input.assignment_limit != null &&
    input.assigned_count != null &&
    input.assignment_limit < input.assigned_count
  ) {
    throw new HttpError(400, "Assignment limit cannot be below assigned count", {
      field: "assignment_limit",
    });
  }
}

function handleWriteError(error) {
  if (error?.code === 11000) throw duplicateCodeError();
  throw error;
}

export function createCouponCampaignService({
  repository = couponRepository,
} = {}) {
  return {
    async create(input) {
      const code = normalizeCode(input.code);
      validateCampaign(input);
      if (await repository.findByCode(code)) throw duplicateCodeError();

      try {
        return await repository.create({ ...input, code });
      } catch (error) {
        handleWriteError(error);
      }
    },

    async update(couponId, input) {
      const existing = await repository.findById(couponId);
      if (!existing) throw notFoundError();

      const updates = { ...input };
      if (input.code !== undefined) {
        updates.code = normalizeCode(input.code);
        if (await repository.findByCode(updates.code, couponId)) {
          throw duplicateCodeError();
        }
      }
      validateCampaign({ ...existing, ...updates });
      if (
        updates.assignment_limit != null &&
        updates.assignment_limit < existing.assigned_count
      ) {
        throw new HttpError(
          409,
          "Assignment limit cannot be below the number already assigned",
          { field: "assignment_limit" },
        );
      }

      try {
        return await repository.update(couponId, updates);
      } catch (error) {
        handleWriteError(error);
      }
    },

    async list(query) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const filter = {};
      if (query.include_deleted !== true) filter.is_deleted = false;
      if (query.is_deleted !== undefined) filter.is_deleted = query.is_deleted;
      if (query.is_active !== undefined) filter.is_active = query.is_active;
      if (query.type) filter.type = query.type;
      if (query.search) {
        filter.code = {
          $regex: escapeRegExp(query.search.trim()),
          $options: "i",
        };
      }
      const direction = query.sort_direction === "asc" ? 1 : -1;
      const sort = { [SORT_FIELDS[query.sort_by ?? "created_at"]]: direction };
      const { items, total } = await repository.list({
        filter,
        sort,
        skip: (page - 1) * limit,
        limit,
      });
      return {
        items,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      };
    },

    async getById(couponId) {
      const coupon = await repository.findById(couponId, {
        includeDeleted: true,
      });
      if (!coupon) throw notFoundError();
      return coupon;
    },

    async remove(couponId) {
      const coupon = await repository.softDelete(couponId);
      if (!coupon) throw notFoundError();
      return coupon;
    },

    async setActive(couponId, isActive) {
      const coupon = await repository.setActive(couponId, isActive);
      if (!coupon) throw notFoundError();
      return coupon;
    },
  };
}
