// Taily - Currency & Number utilities
// All money stored as Decimal (never floats!). Helpers for display.

export function formatCurrency(amount: number | string | { toNumber(): number } | null | undefined): string {
  const num =
    typeof amount === "string"
      ? parseFloat(amount)
      : amount && typeof amount === "object"
      ? amount.toNumber()
      : (amount ?? 0);
  if (isNaN(num)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(amount: number | string | { toNumber(): number } | null | undefined): string {
  const num =
    typeof amount === "string"
      ? parseFloat(amount)
      : amount && typeof amount === "object"
      ? amount.toNumber()
      : (amount ?? 0);
  if (isNaN(num)) return "0.00";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(num);
}

// Indian number words (for invoice "Amount in words")
export function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
    "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + inWords(n % 100) : "");
    if (n < 100000)
      return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + inWords(n % 1000) : "");
    if (n < 10000000)
      return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let result = inWords(rupees) + " Rupees";
  if (paise > 0) result += " and " + inWords(paise) + " Paise";
  return result + " Only";
}

export function roundTo2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
