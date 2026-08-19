/**
 * Utility functions for normalizing and matching Indonesian phone numbers.
 * Handles variations like:
 * - "081234567890"
 * - "6281234567890"
 * - "+62 812-3456-7890"
 * - "81234567890"
 * All of the above normalize to "081234567890".
 */

export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("62")) {
    digits = "0" + digits.slice(2);
  } else if (digits.length > 0 && !digits.startsWith("0")) {
    digits = "0" + digits;
  }
  return digits;
}

export function isSamePhoneNumber(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  const norm1 = normalizePhoneNumber(phone1);
  const norm2 = normalizePhoneNumber(phone2);
  if (!norm1 || !norm2) return false;
  return norm1 === norm2;
}

export function formatPhoneForDisplay(phone: string | null | undefined): string {
  const norm = normalizePhoneNumber(phone);
  if (!norm) return "";
  if (norm.length >= 10) {
    return `${norm.slice(0, 4)}-${norm.slice(4, 8)}-${norm.slice(8)}`;
  }
  return norm;
}
