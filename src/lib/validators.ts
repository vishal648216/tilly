// Taily - Comprehensive Input Validators (Client & Server Reusable)

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const PHONE_REGEX = /^[6-9]\d{9}$/; // Standard 10-digit Indian Mobile number starting with 6,7,8,9
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/; // 6-digit Indian PIN code
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/; // 11-character Indian Bank IFSC code
export const UPI_REGEX = /^[\w.-]+@[\w.-]+$/; // Standard UPI VPA format (e.g. name@okhdfcbank)
export const HSN_REGEX = /^[0-9]{2,8}$/; // 2 to 8 digit HSN/SAC code

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || !email.trim()) return false;
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone || !phone.trim()) return false;
  const digits = phone.replace(/[^0-9]/g, "");
  return PHONE_REGEX.test(digits);
}

export function isValidGstin(gstin: string | null | undefined): boolean {
  if (!gstin || !gstin.trim()) return false;
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

export function isValidPan(pan: string | null | undefined): boolean {
  if (!pan || !pan.trim()) return false;
  return PAN_REGEX.test(pan.trim().toUpperCase());
}

export function isValidPincode(pincode: string | null | undefined): boolean {
  if (!pincode || !pincode.trim()) return false;
  const digits = pincode.replace(/[^0-9]/g, "");
  return PINCODE_REGEX.test(digits);
}

export function isValidIfsc(ifsc: string | null | undefined): boolean {
  if (!ifsc || !ifsc.trim()) return false;
  return IFSC_REGEX.test(ifsc.trim().toUpperCase());
}

export function isValidUpi(upi: string | null | undefined): boolean {
  if (!upi || !upi.trim()) return false;
  return UPI_REGEX.test(upi.trim());
}

export function isValidHsn(hsn: string | null | undefined): boolean {
  if (!hsn || !hsn.trim()) return false;
  const digits = hsn.replace(/[^0-9]/g, "");
  return HSN_REGEX.test(digits);
}
