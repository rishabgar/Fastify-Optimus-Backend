import mongoose from "mongoose";
import { shopModel } from "../shop/index.js";
import { shopTypeModel } from "../shop-type/index.js";
import { userModel } from "../user/index.js";

export const authRepository = {
  startSession() {
    return mongoose.startSession();
  },

  findByEmail(userEmail, session) {
    return userModel
      .findOne({ user_email: userEmail, is_deleted: false })
      .session(session)
      .lean();
  },

  findByPhone(userPhoneNo, session) {
    return userModel
      .findOne({ user_phone_no: userPhoneNo, is_deleted: false })
      .session(session)
      .lean();
  },

  findAdminByEmail(userEmail) {
    return userModel
      .findOne({
        user_email: userEmail,
        user_type: "admin",
        is_deleted: false,
      })
      .select("+password")
      .lean();
  },

  createAdmin(admin) {
    return userModel.create(admin);
  },

  createDeliveryPartner(deliveryPartner) {
    return userModel.create(deliveryPartner);
  },

  createCustomer(customer) {
    return userModel.create(customer);
  },

  async createSeller(seller, session) {
    const [createdSeller] = await userModel.create([seller], { session });
    return createdSeller;
  },

  async createSellerShop(shop, session) {
    const [createdShop] = await shopModel.create([shop], { session });
    return createdShop;
  },

  findActiveShopType(shopTypeId, session) {
    return shopTypeModel
      .findOne({
        _id: shopTypeId,
        is_active: true,
        is_deleted: false,
      })
      .session(session)
      .select("_id")
      .lean();
  },
};
