import { Types } from "mongoose";
import { HttpError } from "../../shared/http/http-error.js";
import { runInTransaction } from "../../shared/database/transaction.js";
import cartModel from "../cart/cart.model.js";
import couponModel from "../coupon/coupon.model.js";
import userCouponModel from "../coupon/user-coupon.model.js";
import productModel from "../product/product.model.js";
import sellerProductModel from "../seller-product/seller-product.model.js";
import shopModel from "../shop/shop.model.js";
import { userModel } from "../user/user.model.js";
import { createRewardService } from "../reward/reward.service.js";
import { activeShopOrders, deriveParentStatus, orderNumber, otp } from "./order.logic.js";
import orderHistoryModel from "./order-history.model.js";
import orderModel from "./order.model.js";
import deliveryEarningModel from "./delivery-earning.model.js";

const terminalShopStatuses = new Set(["rejected", "cancelled", "delivered"]);
const r2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const commissionPct = () => Math.min(Math.max(Number(process.env.PLATFORM_COMMISSION_PCT) || 10, 0), 100);
const deliveryFee = () => Math.max(Number(process.env.DELIVERY_FEE) || 0, 0);

function fail(statusCode, message) { throw new HttpError(statusCode, message); }
function ensureId(value, label) { if (!Types.ObjectId.isValid(value)) fail(400, `Invalid ${label}`); }

async function resolveAddress(customer, input, session) {
  let value;
  if (input.saved_address_id) {
    value = customer.saved_addresses.id(input.saved_address_id);
    if (!value) fail(404, "Saved address not found");
  } else {
    value = input;
    if (input.save_address) customer.saved_addresses.push({
      recipient_name: input.recipient_name,
      phone: input.phone,
      address: input.address,
      coordinates: input.coordinates,
    });
    if (input.save_address) await customer.save({ session });
  }
  const recipientName = input.recipient_name ?? value.recipient_name;
  const phone = input.phone ?? value.phone ?? customer.user_phone_no;
  if (!recipientName || !phone || !value.address || !Array.isArray(value.coordinates)) {
    fail(400, "Recipient name, phone, address, and coordinates are required");
  }
  return {
    ...(input.saved_address_id ? { saved_address_id: value._id } : {}),
    recipient_name: recipientName,
    phone,
    address: value.address,
    location: { type: "Point", coordinates: value.coordinates },
  };
}

async function resolveLine(line, session) {
  const sellerProduct = await sellerProductModel.findOne({ _id: line.seller_product_id, is_active: true, is_deleted: false }).session(session);
  if (!sellerProduct) fail(409, "A cart product is unavailable");
  const variant = sellerProduct.variants.id(line.variant_id) ?? sellerProduct.variants.find((row) => row.product_variant_id?.toString() === String(line.variant_id));
  if (!variant?.is_active || variant.available_quantity < line.quantity) fail(409, "A cart product variant is unavailable");
  const shop = await shopModel.findOne({ _id: sellerProduct.shop_id, is_active: true, is_deleted: false }).session(session).lean();
  if (!shop || shop.is_closed) fail(409, "A shop is unavailable");
  const master = sellerProduct.product_type === "common"
    ? await productModel.findOne({ _id: sellerProduct.product_id, is_active: true, is_deleted: false }).session(session).lean()
    : null;
  if (sellerProduct.product_type === "common" && !master) fail(409, "A cart product is unavailable");
  const masterVariant = master?.variants?.find((row) => String(row._id) === String(variant.product_variant_id));
  if (master && (!masterVariant || !masterVariant.is_active)) fail(409, "A cart product variant is unavailable");
  return {
    sellerProduct,
    variant,
    shop,
    snapshot: {
      seller_product_id: sellerProduct._id,
      variant_id: variant._id,
      product_type: sellerProduct.product_type,
      ...(sellerProduct.product_id ? { product_id: sellerProduct.product_id } : {}),
      ...(variant.product_variant_id ? { product_variant_id: variant.product_variant_id } : {}),
      product_category_id: sellerProduct.product_type === "common" ? master.product_category_id : sellerProduct.product_category_id,
      product_name: sellerProduct.product_type === "common" ? (sellerProduct.product_name_override || master.product_name) : sellerProduct.product_name,
      ...(sellerProduct.product_type === "common" ? { brand_name: master.brand_name } : { brand_name: sellerProduct.brand_name }),
      variant_label: sellerProduct.product_type === "common" ? masterVariant.label : variant.label,
      ...(sellerProduct.product_type === "common" ? { quantity_value: masterVariant.quantity_value, quantity_unit: masterVariant.quantity_unit } : { quantity_value: variant.quantity_value, quantity_unit: variant.quantity_unit }),
      image_url: (sellerProduct.product_type === "common" ? sellerProduct.product_images_override?.[0]?.url || master.product_images?.[0]?.url : sellerProduct.product_images?.[0]?.url),
      seller_sku: variant.seller_sku,
      unit_price: variant.price,
      ...(variant.mrp != null ? { mrp: variant.mrp } : {}),
      quantity: line.quantity,
      line_total: r2(variant.price * line.quantity),
    },
  };
}

async function reserveLine(line, session) {
  const result = await sellerProductModel.updateOne(
    { _id: line.sellerProduct._id, variants: { $elemMatch: { _id: line.variant._id, is_active: true, available_quantity: { $gte: line.snapshot.quantity } } } },
    { $inc: { "variants.$.available_quantity": -line.snapshot.quantity, "variants.$.reserved_quantity": line.snapshot.quantity } },
    { session },
  );
  if (result.modifiedCount !== 1) fail(409, "Inventory changed during checkout");
}

function buildShopOrders(lines, customerId) {
  const groups = new Map();
  for (const line of lines) {
    const key = String(line.shop._id);
    const group = groups.get(key) ?? { shop: line.shop, seller_id: line.sellerProduct.seller_id, items: [] };
    group.items.push(line.snapshot);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const itemsTotal = r2(group.items.reduce((sum, item) => sum + item.line_total, 0));
    const commissionAmount = r2(itemsTotal * commissionPct() / 100);
    return {
      shop_id: group.shop._id,
      seller_id: group.seller_id,
      status: "processing",
      shop_snapshot: { shop_name: group.shop.shop_name, shop_address: group.shop.shop_address, location: { type: "Point", coordinates: group.shop.seller_location.coordinates }, ...(group.shop.contact_phone ? { contact_phone: group.shop.contact_phone } : {}) },
      items: group.items,
      items_total: itemsTotal,
      commission_pct: commissionPct(),
      commission_amount: commissionAmount,
      seller_earning: r2(itemsTotal - commissionAmount),
      timeline: [{ status: "processing", by: customerId }],
    };
  });
}

async function reserveCoupon(customerId, couponId, subtotal, session) {
  if (!couponId) return { discount: 0, coupon: {} };
  const [coupon, assignment] = await Promise.all([
    couponModel.findOne({ _id: couponId, is_active: true, is_deleted: false }).session(session).lean(),
    userCouponModel.findOne({ user_id: customerId, coupon_id: couponId, status: "assigned" }).session(session).lean(),
  ]);
  if (!coupon || !assignment || (coupon.start_date && coupon.start_date > new Date()) || (coupon.end_date && coupon.end_date < new Date()) || subtotal < coupon.min_order_value) fail(409, "Coupon is not available");
  if (coupon.is_first_order) {
    const [activeCount, historyCount] = await Promise.all([
      orderModel.countDocuments({ customer_id: customerId, status: { $ne: "cancelled" } }).session(session),
      orderHistoryModel.countDocuments({ customer_id: customerId, status: { $ne: "cancelled" } }).session(session),
    ]);
    if (activeCount || historyCount) fail(409, "Coupon is valid only for a first order");
  }
  const discount = r2(Math.min(subtotal, coupon.type === "percentage" ? Math.min(subtotal * coupon.value / 100, coupon.max_discount ?? Infinity) : coupon.value));
  const reserved = await userCouponModel.updateOne({ _id: assignment._id, status: "assigned" }, { $set: { status: "reserved", reserved_at: new Date() } }, { session });
  if (reserved.modifiedCount !== 1) fail(409, "Coupon is no longer available");
  return { discount, coupon: { coupon_id: coupon._id, code: coupon.code, type: coupon.type, value: coupon.value, discount_at_placement: discount } };
}

async function archiveIfTerminal(order, session) {
  if (!order || !["delivered", "cancelled"].includes(order.status)) return false;
  if (!order.shop_orders.every((shop) => terminalShopStatuses.has(shop.status))) return false;
  await orderHistoryModel.collection.replaceOne({ _id: order._id }, { ...order.toObject(), archived_at: new Date(), archive_reason: order.status }, { upsert: true, session });
  const deleted = await orderModel.deleteOne({ _id: order._id, status: order.status }, { session });
  if (deleted.deletedCount !== 1) fail(409, "Order changed during archival");
  return true;
}

async function paymentModelUpdateExpired(orderId, session) {
  const { default: paymentModel } = await import("../payment/payment.model.js");
  await paymentModel.updateMany({ order_id: orderId, status: "created" }, { $set: { status: "failed", failure_reason: "order_cancelled", payment_link_expires_at: new Date() } }, { session });
}

export function createOrderService({ rewardService = createRewardService() } = {}) {
  return {
    async place(customerId, input) {
      let created;
      await runInTransaction(async (session) => {
        const [customer, cart] = await Promise.all([userModel.findOne({ _id: customerId, is_deleted: false }).session(session), cartModel.findOne({ user_id: customerId }).session(session)]);
        if (!customer) fail(404, "Customer not found");
        if (!cart?.items?.length) fail(400, "Cart is empty");
        const address = await resolveAddress(customer, input.address, session);
        const lines = [];
        for (const line of cart.items) lines.push(await resolveLine(line, session));
        for (const line of lines) await reserveLine(line, session);
        const shopOrders = buildShopOrders(lines, customerId);
        const subtotal = r2(shopOrders.reduce((sum, shop) => sum + shop.items_total, 0));
        const couponData = await reserveCoupon(customerId, input.coupon_id, subtotal, session);
        const payableAmount = r2(Math.max(0, subtotal + deliveryFee() - couponData.discount));
        [created] = await orderModel.create([{
          order_number: orderNumber(), customer_id: customerId,
          customer_snapshot: { name: [customer.first_name, customer.last_name].filter(Boolean).join(" "), phone: customer.user_phone_no },
          delivery_address: address, shop_orders: shopOrders, status: "processing",
          pricing: { items_total_original: subtotal, items_total: subtotal, delivery_fee: deliveryFee(), coupon_discount: couponData.discount, platform_coupon_cost: couponData.discount, payable_amount: payableAmount },
          coupon: couponData.coupon, payment_method: input.payment_method, payment_status: "pending",
        }], { session });
        if (input.coupon_id) await userCouponModel.updateOne({ user_id: customerId, coupon_id: input.coupon_id, status: "reserved" }, { $set: { status: "used", used_at: new Date(), order_id: created._id } }, { session });
        const cleared = await cartModel.updateOne({ _id: cart._id }, { $set: { items: [] } }, { session });
        if (cleared.modifiedCount !== 1) fail(409, "Cart changed during checkout");
      });
      return created.toObject();
    },

    async preview(customerId) {
      const cart = await cartModel.findOne({ user_id: customerId }).lean();
      if (!cart?.items?.length) fail(400, "Cart is empty");
      const lines = [];
      for (const line of cart.items) lines.push(await resolveLine(line));
      const shopOrders = buildShopOrders(lines, customerId);
      const subtotal = r2(shopOrders.reduce((sum, shop) => sum + shop.items_total, 0));
      return { shops: shopOrders.map((shop) => ({ shop_id: shop.shop_id, items: shop.items, items_total: shop.items_total })), items_total: subtotal, delivery_fee: deliveryFee(), coupon_discount: 0, payable_amount: r2(subtotal + deliveryFee()) };
    },

    async listCustomer(customerId) { return orderModel.find({ customer_id: customerId }).sort({ createdAt: -1 }).lean(); },
    async listHistory(customerId) { return orderHistoryModel.find({ customer_id: customerId }).sort({ createdAt: -1 }).lean(); },
    async customerDetail(customerId, orderId) {
      const order = await orderModel.findOne({ _id: orderId, customer_id: customerId }).lean() ?? await orderHistoryModel.findOne({ _id: orderId, customer_id: customerId }).lean();
      if (!order) fail(404, "Order not found");
      return order;
    },
    async listSeller(sellerId) {
      const orders = await orderModel.find({ "shop_orders.seller_id": sellerId }).sort({ createdAt: -1 }).lean();
      return orders.map((order) => ({ ...order, shop_orders: order.shop_orders.filter((shop) => String(shop.seller_id) === String(sellerId)) }));
    },
    async sellerEarnings(sellerId) {
      const orders = await orderHistoryModel.find({ status: "delivered", "shop_orders.seller_id": sellerId, payment_status: "paid" }).lean();
      const items = orders.flatMap((order) => order.shop_orders.filter((shop) => String(shop.seller_id) === String(sellerId) && shop.status === "delivered").map((shop) => ({ order_id: order._id, order_number: order.order_number, shop_order_id: shop._id, amount: shop.seller_earning })));
      return { items, total: r2(items.reduce((sum, item) => sum + item.amount, 0)) };
    },

    async cancel(customerId, orderId, reason) {
      return runInTransaction(async (session) => {
        const order = await orderModel.findOne({ _id: orderId, customer_id: customerId }).session(session);
        if (!order || ["delivered", "cancelled"].includes(order.status)) fail(404, "Order not found");
        if (order.shop_orders.some((shop) => ["packed", "out_for_delivery", "delivered"].includes(shop.status))) fail(409, "Order can no longer be cancelled");
        for (const shop of order.shop_orders) {
          if (terminalShopStatuses.has(shop.status)) continue;
          for (const item of shop.items) {
            const released = await sellerProductModel.updateOne(
              { _id: item.seller_product_id, variants: { $elemMatch: { _id: item.variant_id, reserved_quantity: { $gte: item.quantity } } } },
              { $inc: { "variants.$.available_quantity": item.quantity, "variants.$.reserved_quantity": -item.quantity } },
              { session },
            );
            if (released.modifiedCount !== 1) fail(409, "Inventory changed during cancellation");
          }
          shop.status = "cancelled";
          shop.timeline.push({ status: "cancelled", by: customerId, ...(reason ? { note: reason } : {}) });
        }
        order.status = "cancelled";
        order.cancellation = { cancelled_by: customerId, reason, cancelled_at: new Date() };
        await order.save({ session });
        await paymentModelUpdateExpired(order._id, session);
        if (order.coupon?.coupon_id) await userCouponModel.updateOne({ user_id: customerId, coupon_id: order.coupon.coupon_id, status: "used", order_id: order._id }, { $set: { status: "assigned", reserved_at: null, used_at: null, order_id: null } }, { session });
        await archiveIfTerminal(order, session);
        return order.toObject();
      });
    },

    async sellerTransition(sellerId, { order_id: orderId, shop_order_id: shopOrderId }, status, reason) {
      ensureId(orderId, "order id"); ensureId(shopOrderId, "shop order id");
      return runInTransaction(async (session) => {
        const order = await orderModel.findOne({ _id: orderId, "shop_orders._id": shopOrderId }).session(session);
        const shopOrder = order?.shop_orders.id(shopOrderId);
        if (!shopOrder || String(shopOrder.seller_id) !== String(sellerId)) fail(404, "Shop order not found");
        const allowed = status === "accepted" ? shopOrder.status === "processing" : status === "packed" ? shopOrder.status === "accepted" : ["processing", "accepted"].includes(shopOrder.status);
        if (!allowed) fail(409, "Shop order cannot transition to this status");
        shopOrder.status = status;
        if (status === "rejected") shopOrder.rejection_reason = reason;
        if (status === "packed") shopOrder.pickup_otp = { code: otp(), generated_at: new Date(), attempts: 0 };
        shopOrder.timeline.push({ status, by: sellerId, ...(reason ? { note: reason } : {}) });
        order.status = deriveParentStatus(order);
        await order.save({ session });
        await archiveIfTerminal(order, session);
        return order.toObject();
      });
    },

    async availableTasks() { return orderModel.find({ "delivery.partner_id": null, "shop_orders.status": "packed" }).select("order_number shop_orders.shop_snapshot shop_orders.items shop_orders.status").lean(); },
    async myTasks(partnerId) { return orderModel.find({ "delivery.partner_id": partnerId }).sort({ createdAt: -1 }).lean(); },
    async deliveryEarnings(partnerId) {
      const rows = await deliveryEarningModel.find({ delivery_partner_id: partnerId }).sort({ createdAt: -1 }).lean();
      return { items: rows, total: r2(rows.reduce((sum, row) => sum + row.amount, 0)) };
    },

    async setDeliveryEarning(orderId, earningAmount) {
      const order = await orderModel.findOneAndUpdate(
        { _id: orderId, status: { $nin: ["delivered", "cancelled"] } },
        { $set: { "delivery.earning_amount": earningAmount } },
        { returnDocument: "after", runValidators: true },
      );
      if (!order) fail(404, "Order not found");
      return order.toObject();
    },

    async acceptTask(partnerId, orderId) {
      return runInTransaction(async (session) => {
        const partner = await userModel.updateOne({ _id: partnerId, user_type: "delivery_partner", is_deleted: false, delivery_partner_status: "available" }, { $inc: { active_orders: 1 }, $set: { delivery_partner_status: "busy" } }, { session });
        if (partner.modifiedCount !== 1) fail(409, "Delivery partner is unavailable");
        const order = await orderModel.findOneAndUpdate({ _id: orderId, "delivery.partner_id": null, "shop_orders.status": "packed" }, { $set: { "delivery.partner_id": partnerId, "delivery.assigned_at": new Date() } }, { returnDocument: "after", session });
        if (!order) fail(409, "Delivery task is unavailable");
        return order.toObject();
      });
    },

    async verifyPickup(partnerId, { order_id: orderId, shop_order_id: shopOrderId }, code) {
      return runInTransaction(async (session) => {
        const order = await orderModel.findOne({ _id: orderId, "delivery.partner_id": partnerId }).session(session);
        const shopOrder = order?.shop_orders.id(shopOrderId);
        if (!shopOrder || shopOrder.status !== "packed") fail(409, "Pickup is unavailable");
        if (shopOrder.pickup_otp?.attempts >= 5) fail(409, "Pickup OTP is locked");
        if (shopOrder.pickup_otp?.code !== code) { shopOrder.pickup_otp.attempts += 1; await order.save({ session }); fail(400, "Invalid pickup OTP"); }
        shopOrder.pickup_otp.verified_at = new Date(); shopOrder.status = "out_for_delivery"; shopOrder.timeline.push({ status: "out_for_delivery", by: partnerId });
        order.status = deriveParentStatus(order);
        if (order.status === "out_for_delivery" && !order.delivery.customer_otp?.code) { order.delivery.customer_otp = { code: otp(), generated_at: new Date(), attempts: 0 }; order.payment_enabled_at = new Date(); }
        await order.save({ session }); return order.toObject();
      });
    },

    async verifyCustomerOtp(partnerId, orderId, code) {
      const order = await orderModel.findOne({ _id: orderId, "delivery.partner_id": partnerId, status: "out_for_delivery" });
      if (!order?.delivery.customer_otp || order.delivery.customer_otp.attempts >= 5) fail(409, "Customer OTP is unavailable");
      if (order.delivery.customer_otp.code !== code) { order.delivery.customer_otp.attempts += 1; await order.save(); fail(400, "Invalid customer OTP"); }
      order.delivery.customer_otp.verified_at = new Date(); await order.save(); return order.toObject();
    },

    async completeDelivery(partnerId, orderId) {
      const delivered = await runInTransaction(async (session) => {
        const order = await orderModel.findOne({ _id: orderId, "delivery.partner_id": partnerId, status: "out_for_delivery", payment_status: "paid" }).session(session);
        if (!order?.delivery.customer_otp?.verified_at) fail(409, "Customer OTP and payment are required");
        for (const shop of activeShopOrders(order)) { if (shop.status !== "out_for_delivery") fail(409, "All shop orders must be out for delivery"); shop.status = "delivered"; shop.timeline.push({ status: "delivered", by: partnerId }); }
        order.status = "delivered"; order.delivery.delivered_at = new Date();
        await order.save({ session });
        await deliveryEarningModel.create([{ delivery_partner_id: partnerId, order_id: order._id, amount: order.delivery.earning_amount ?? 0 }], { session });
        await userModel.updateOne({ _id: partnerId, active_orders: { $gt: 0 } }, { $inc: { active_orders: -1 }, $set: { delivery_partner_status: "available" } }, { session });
        await archiveIfTerminal(order, session); return order.toObject();
      });
      await rewardService.awardForOrder(delivered); return delivered;
    },
  };
}
