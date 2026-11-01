export const SELLER_EDITABLE_SHOP_FIELDS = Object.freeze([
  "shop_name",
  "shop_address",
  "shop_image",
  "operating_hours",
  "gst_number",
  "shop_type_id",
  "seller_location",
  "is_closed",
]);

export const DEV_EDITABLE_SHOP_FIELDS = Object.freeze([
  ...SELLER_EDITABLE_SHOP_FIELDS,
  "is_active",
]);
