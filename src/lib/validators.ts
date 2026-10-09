// Taily - Comprehensive Input Validators (Client & Server Reusable)

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/; // 6-digit Indian PIN code
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/; // 11-character Indian Bank IFSC code
export const UPI_REGEX = /^[\w.-]+@[\w.-]+$/; // Standard UPI VPA format (e.g. name@okhdfcbank)
export const HSN_REGEX = /^[0-9]{2,8}$/; // 2 to 8 digit HSN/SAC code

export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone || !phone.trim()) return false;
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.length >= 7 && digits.length <= 15;
}

export function isValidGstin(gstin: string | null | undefined): boolean {
  if (!gstin || !gstin.trim()) return false;
  const clean = gstin.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (clean.length !== 15) return false;
  return /^[0-9]{2}[A-Z0-9]{13}$/.test(clean);
}

export function isValidPan(pan: string | null | undefined): boolean {
  if (!pan || !pan.trim()) return false;
  const clean = pan.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean.length === 10 && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(clean);
}

export function isValidPincode(pincode: string | null | undefined): boolean {
  if (!pincode || !pincode.trim()) return false;
  const digits = pincode.replace(/[^0-9]/g, "");
  return digits.length === 6;
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

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || !email.trim()) return false;
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

export function isValidIndianMobile(phone: string | null | undefined): boolean {
  if (!phone || !phone.trim()) return false;
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.length >= 7 && digits.length <= 15;
}

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;
