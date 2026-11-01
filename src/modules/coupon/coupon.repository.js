import mongoose from "mongoose";
import couponModel from "./coupon.model.js";
import userCouponModel from "./user-coupon.model.js";

const COUPON_FIELDS = [
  "_id",
  "code",
  "type",
  "value",
  "min_order_value",
  "max_discount",
  "is_first_order",
  "assignment_limit",
  "assigned_count",
  "start_date",
  "end_date",
  "is_active",
  "is_deleted",
  "createdAt",
  "updatedAt",
].join(" ");

export const couponRepository = {
  create(input) {
    return couponModel.create(input);
  },

  findByCode(code, excludeId) {
    const filter = { code };
    if (excludeId) filter._id = { $ne: excludeId };
    return couponModel.findOne(filter).lean();
  },

  findById(couponId, { includeDeleted = false, session } = {}) {
    const filter = { _id: couponId };
    if (!includeDeleted) filter.is_deleted = false;
    return couponModel
      .findOne(filter)
      .select(COUPON_FIELDS)
      .session(session ?? null)
      .lean();
  },

  async list({ filter, sort, skip, limit }) {
    const [items, total] = await Promise.all([
      couponModel
        .find(filter)
        .select(COUPON_FIELDS)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      couponModel.countDocuments(filter),
    ]);
    return { items, total };
  },

  update(couponId, updates) {
    return couponModel
      .findOneAndUpdate({ _id: couponId, is_deleted: false }, updates, {
        returnDocument: "after",
        runValidators: true,
      })
      .select(COUPON_FIELDS)
      .lean();
  },

  softDelete(couponId) {
    return couponModel
      .findOneAndUpdate(
        { _id: couponId, is_deleted: false },
        { $set: { is_deleted: true, is_active: false } },
        { returnDocument: "after", runValidators: true },
      )
      .select(COUPON_FIELDS)
      .lean();
  },

  setActive(couponId, isActive) {
    return couponModel
      .findOneAndUpdate(
        { _id: couponId, is_deleted: false },
        { $set: { is_active: isActive } },
        { returnDocument: "after", runValidators: true },
      )
      .select(COUPON_FIELDS)
      .lean();
  },

  findUserCoupon(userId, couponId, session) {
    return userCouponModel
      .findOne({ user_id: userId, coupon_id: couponId })
      .session(session ?? null)
      .lean();
  },

  startSession() {
    return mongoose.startSession();
  },

  incrementAssignmentIfAvailable(couponId, now, session) {
    return couponModel.findOneAndUpdate(
      {
        _id: couponId,
        is_active: true,
        is_deleted: false,
        $and: [
          { $or: [{ start_date: null }, { start_date: { $lte: now } }] },
          { $or: [{ end_date: null }, { end_date: { $gte: now } }] },
          {
            $or: [
              { assignment_limit: null },
              { $expr: { $lt: ["$assigned_count", "$assignment_limit"] } },
            ],
          },
        ],
      },
      { $inc: { assigned_count: 1 } },
      { returnDocument: "after", session, runValidators: true },
    );
  },

  async createUserCoupon(input, session) {
    const [assignment] = await userCouponModel.create([input], { session });
    return assignment;
  },

  listForUser(userId, { status, now }) {
    const match = { user_id: new mongoose.Types.ObjectId(userId) };
    if (status) match.status = status;

    return userCouponModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: couponModel.collection.name,
          localField: "coupon_id",
          foreignField: "_id",
          as: "coupon",
        },
      },
      { $unwind: "$coupon" },
      {
        $match: {
          "coupon.is_active": true,
          "coupon.is_deleted": false,
          $and: [
            {
              $or: [
                { "coupon.start_date": null },
                { "coupon.start_date": { $lte: now } },
              ],
            },
            {
              $or: [
                { "coupon.end_date": null },
                { "coupon.end_date": { $gte: now } },
              ],
            },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          status: 1,
          assigned_at: 1,
          coupon: {
            _id: "$coupon._id",
            code: "$coupon.code",
            type: "$coupon.type",
            value: "$coupon.value",
            min_order_value: "$coupon.min_order_value",
            max_discount: "$coupon.max_discount",
            is_first_order: "$coupon.is_first_order",
            start_date: "$coupon.start_date",
            end_date: "$coupon.end_date",
          },
        },
      },
      { $sort: { assigned_at: -1 } },
    ]);
  },

};
