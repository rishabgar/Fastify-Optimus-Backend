export function normalizePhoneNumber(phoneNumber) {
  if (typeof phoneNumber !== "string") {
    return null;
  }

  const normalizedPhoneNumber = phoneNumber.trim().replace(/[\s()-]/g, "");

  return /^\+[1-9]\d{7,14}$/.test(normalizedPhoneNumber)
    ? normalizedPhoneNumber
    : null;
}
