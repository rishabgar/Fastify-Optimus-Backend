import { HttpError } from "../../shared/http/http-error.js";
import { runInTransaction } from "../../shared/database/transaction.js";
import orderModel from "../order/order.model.js";
import paymentModel from "./payment.model.js";
import { createCashfreeClient } from "./cashfree.client.js";

function fail(statusCode, message) { throw new HttpError(statusCode, message); }
function terminal(status) { return ["delivered", "cancelled"].includes(status); }

export function createPaymentService({ cashfreeClient = createCashfreeClient() } = {}) {
  return {
    async status(customerId, orderId) {
      const order = await orderModel.findOne({ _id: orderId, customer_id: customerId }).select("payment_status payment_method payment_id status").lean();
      if (!order) fail(404, "Order not found");
      const payment = order.payment_id ? await paymentModel.findById(order.payment_id).select("status paid_via paid_at").lean() : null;
      return { order_status: order.status, payment_method: order.payment_method, payment_status: order.payment_status, ...(payment ? { paid_via: payment.paid_via, paid_at: payment.paid_at } : {}) };
    },

    async createOnlineLink(customerId, orderId) {
      const order = await orderModel.findOne({ _id: orderId, customer_id: customerId });
      if (!order) fail(404, "Order not found");
      if (terminal(order.status) || order.status !== "out_for_delivery" || order.payment_method !== "online" || order.payment_status !== "pending") fail(409, "Online payment is not available");
      let payment = await paymentModel.findOne({ order_id: order._id, status: "created" });
      if (payment?.gateway?.gateway_order_id) return { payment_id: payment._id, gateway_order_id: payment.gateway.gateway_order_id };
      const gateway = await cashfreeClient.createOrder({ orderId: order.order_number, amount: order.pricing.payable_amount, customer: { id: order.customer_id, name: order.customer_snapshot.name, phone: order.customer_snapshot.phone } });
      payment = await paymentModel.findOneAndUpdate(
        { order_id: order._id, status: "created" },
        { $set: { "gateway.provider": "cashfree", "gateway.gateway_order_id": gateway.cf_order_id ?? gateway.order_id, payment_link_expires_at: new Date(Date.now() + 30 * 60 * 1000) }, $setOnInsert: { order_id: order._id, customer_id: order.customer_id, method: order.payment_method, amount: order.pricing.payable_amount } },
        { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
      );
      if (!order.payment_id) { order.payment_id = payment._id; await order.save(); }
      return { payment_id: payment._id, gateway_order_id: payment.gateway.gateway_order_id, payment_session_id: gateway.payment_session_id };
    },

    async confirmCash(partnerId, orderId) {
      return runInTransaction(async (session) => {
        const order = await orderModel.findOne({ _id: orderId, "delivery.partner_id": partnerId, status: "out_for_delivery", payment_status: "pending" }).session(session);
        if (!order || terminal(order.status) || !order.delivery?.customer_otp?.verified_at) fail(409, "Cash collection is not allowed");
        const payment = await paymentModel.findOneAndUpdate(
          { order_id: order._id, status: "created" },
          { $set: { status: "paid", paid_via: "delivery_partner_cash", confirmed_by: partnerId, confirmed_via: "delivery_partner", paid_at: new Date() }, $setOnInsert: { order_id: order._id, customer_id: order.customer_id, method: order.payment_method, amount: order.pricing.payable_amount } },
          { returnDocument: "after", upsert: true, setDefaultsOnInsert: true, session },
        );
        const updated = await orderModel.updateOne({ _id: order._id, payment_status: "pending", status: "out_for_delivery" }, { $set: { payment_status: "paid", paid_at: new Date(), payment_id: payment._id } }, { session });
        if (updated.modifiedCount !== 1) fail(409, "Payment changed during collection");
        return payment.toObject();
      });
    },

    async handleCashfreeWebhook(payload, headers) {
      const signature = headers["x-webhook-signature"];
      const timestamp = headers["x-webhook-timestamp"];
      if (!cashfreeClient.verifySignature({ payload, signature, timestamp })) fail(401, "Invalid payment webhook signature");
      const orderNumber = payload?.data?.order?.order_id ?? payload?.order?.order_id;
      const paymentId = payload?.data?.payment?.cf_payment_id ?? payload?.payment?.cf_payment_id;
      const status = payload?.data?.payment?.payment_status ?? payload?.payment?.payment_status;
      if (!orderNumber || !paymentId || status !== "SUCCESS") return { ignored: true };
      return runInTransaction(async (session) => {
        const order = await orderModel.findOne({ order_number: orderNumber }).session(session);
        if (!order || terminal(order.status) || order.status !== "out_for_delivery" || order.payment_status !== "pending") return { ignored: true };
        const payment = await paymentModel.findOneAndUpdate(
          { order_id: order._id, status: "created", provider_event_ids: { $ne: String(paymentId) } },
          { $set: { status: "paid", paid_via: "cashfree", "gateway.provider": "cashfree", "gateway.gateway_payment_id": String(paymentId), "gateway.signature_verified": true, confirmed_via: "gateway_webhook", paid_at: new Date() }, $setOnInsert: { order_id: order._id, customer_id: order.customer_id, method: order.payment_method, amount: order.pricing.payable_amount }, $addToSet: { provider_event_ids: String(paymentId) } },
          { returnDocument: "after", upsert: true, setDefaultsOnInsert: true, session },
        );
        const updated = await orderModel.updateOne({ _id: order._id, payment_status: "pending", status: "out_for_delivery" }, { $set: { payment_status: "paid", paid_at: new Date(), payment_id: payment._id } }, { session });
        return { ignored: updated.modifiedCount !== 1 };
      });
    },
  };
}
