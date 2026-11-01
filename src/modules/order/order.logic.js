export function activeShopOrders(order) {
  return order.shop_orders.filter((shop) => !["rejected", "cancelled"].includes(shop.status));
}

export function deriveParentStatus(order) {
  const active = activeShopOrders(order);
  if (!active.length) return "cancelled";
  if (active.every((shop) => shop.status === "delivered")) return "delivered";
  if (active.every((shop) => ["out_for_delivery", "delivered"].includes(shop.status))) return "out_for_delivery";
  if (active.every((shop) => ["packed", "out_for_delivery", "delivered"].includes(shop.status))) return "packed";
  if (active.every((shop) => ["accepted", "packed", "out_for_delivery", "delivered"].includes(shop.status))) return "accepted";
  return "processing";
}

export function otp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function orderNumber() {
  return `OK${Date.now()}${Math.floor(Math.random() * 10000)}`;
}
