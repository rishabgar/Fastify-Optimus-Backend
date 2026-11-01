import crypto from "node:crypto";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Cashfree payments`);
  return value;
}

export function createCashfreeClient({ fetcher = fetch } = {}) {
  const baseUrl = process.env.CASHFREE_API_BASE_URL ?? "https://sandbox.cashfree.com/pg";
  return {
    async createOrder({ orderId, amount, customer }) {
      const response = await fetcher(`${baseUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-version": process.env.CASHFREE_API_VERSION ?? "2023-08-01",
          "x-client-id": required("CASHFREE_CLIENT_ID"),
          "x-client-secret": required("CASHFREE_CLIENT_SECRET"),
        },
        body: JSON.stringify({ order_id: orderId, order_amount: amount, order_currency: "INR", customer_details: { customer_id: String(customer.id), customer_phone: customer.phone, customer_name: customer.name } }),
      });
      if (!response.ok) throw new Error("Cashfree payment order creation failed");
      return response.json();
    },

    verifySignature({ payload, signature, timestamp }) {
      const secret = required("CASHFREE_WEBHOOK_SECRET");
      const expected = crypto.createHmac("sha256", secret).update(`${timestamp ?? ""}${JSON.stringify(payload)}`).digest("base64");
      if (!signature) return false;
      const expectedBuffer = Buffer.from(expected);
      const receivedBuffer = Buffer.from(signature);
      return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    },
  };
}
