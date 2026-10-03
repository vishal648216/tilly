// Taily - Financial Year Engine
// Computes financial year boundaries based on company configuration.
// Default: April 1 – March 31 (Indian FY). Fully configurable.

import { prisma } from "./prisma";

export interface FinancialYear {
  label: string;         // e.g. "FY 2024-25"
  startDate: Date;       // April 1 of start year
  endDate: Date;         // March 31 of end year
  startYear: number;
  endYear: number;
}

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

/**
 * Parse company financialYear config string.
 * Supported formats:
 *   "04-01"      → April 1 start (Indian default)
 *   "01-01"      → January 1 start (Calendar year)
 *   "07-01"      → July 1 start (Australian/NZ)
 *
 * If no config, defaults to "04-01" (India).
 */
export function parseFyStartMonth(financialYear?: string | null): { month: number; day: number } {
  if (!financialYear || financialYear.trim() === "") {
    return { month: 4, day: 1 }; // India default: April 1
  }

  const parts = financialYear.split("-");
  if (parts.length === 2) {
    const m = parseInt(parts[0]);
    const d = parseInt(parts[1]);
    if (!isNaN(m) && !isNaN(d) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { month: m, day: d };
    }
  }

  return { month: 4, day: 1 };
}

/**
 * Get Financial Year boundaries for a given date.
 * Returns start and end dates for the FY containing that date.
 */
export function getFinancialYearForDate(
  date: Date,
  fyStartMonth: number,
  fyStartDay: number = 1
): FinancialYear {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed

  let startYear: number;
  if (month > fyStartMonth || (month === fyStartMonth && date.getDate() >= fyStartDay)) {
    startYear = year;
  } else {
    startYear = year - 1;
  }

  const endYear = startYear + 1;

  const startDate = new Date(startYear, fyStartMonth - 1, fyStartDay, 0, 0, 0, 0);
  // End date: day before next FY start
  const endDate = new Date(endYear, fyStartMonth - 1, fyStartDay - 1, 23, 59, 59, 999);
  if (fyStartDay === 1) {
    // End of previous month
    endDate.setFullYear(endYear);
    endDate.setMonth(fyStartMonth - 2);
    endDate.setDate(new Date(endYear, fyStartMonth - 1, 0).getDate());
    endDate.setHours(23, 59, 59, 999);
  }

  const label = fyStartMonth === 4
    ? `FY ${startYear}-${String(endYear).slice(2)}`  // Indian format: FY 2024-25
    : `FY ${startYear}-${endYear}`;                   // Calendar format: FY 2024-2025

  return { label, startDate, endDate, startYear, endYear };
}

/**
 * Get current Financial Year based on company settings.
 */
export async function getCurrentFinancialYear(companyId: string): Promise<FinancialYear> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { financialYear: true },
  });

  const { month, day } = parseFyStartMonth(company?.financialYear);
  return getFinancialYearForDate(new Date(), month, day);
}

/**
 * Get previous Financial Year.
 */
export async function getPreviousFinancialYear(companyId: string): Promise<FinancialYear> {
  const currentFy = await getCurrentFinancialYear(companyId);
  const prevYearDate = new Date(currentFy.startDate);
  prevYearDate.setFullYear(prevYearDate.getFullYear() - 1);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { financialYear: true },
  });

  const { month, day } = parseFyStartMonth(company?.financialYear);
  return getFinancialYearForDate(prevYearDate, month, day);
}

/**
 * Standard date range presets used in all reports.
 * All report filters must use exactly these ranges for consistency.
 */
export function getDateRangePreset(
  preset: "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "CURRENT_FY" | "PREVIOUS_FY" | "CUSTOM",
  currentFy: FinancialYear,
  previousFy: FinancialYear,
  customFrom?: Date,
  customTo?: Date
): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  switch (preset) {
    case "TODAY":
      return {
        from: todayStart,
        to: today,
        label: "Today",
      };

    case "THIS_WEEK": {
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
      const monday = new Date(todayStart);
      monday.setDate(todayStart.getDate() - ((dayOfWeek + 6) % 7)); // Monday
      return {
        from: monday,
        to: today,
        label: "This Week",
      };
    }

    case "THIS_MONTH": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return {
        from: monthStart,
        to: today,
        label: "This Month",
      };
    }

    case "CURRENT_FY":
      return {
        from: currentFy.startDate,
        to: currentFy.endDate,
        label: currentFy.label,
      };

    case "PREVIOUS_FY":
      return {
        from: previousFy.startDate,
        to: previousFy.endDate,
        label: previousFy.label,
      };

    case "CUSTOM":
      return {
        from: customFrom || todayStart,
        to: customTo || today,
        label: "Custom Range",
      };

    default:
      return {
        from: currentFy.startDate,
        to: currentFy.endDate,
        label: currentFy.label,
      };
  }
}

/**
 * Parse date preset from query string parameters.
 * Used in API routes to decode ?preset=CURRENT_FY&from=2024-04-01&to=2025-03-31
 */
export async function resolveDateRange(params: {
  companyId: string;
  preset?: string;
  from?: string;
  to?: string;
}): Promise<DateRange> {
  const currentFy = await getCurrentFinancialYear(params.companyId);
  const previousFy = await getPreviousFinancialYear(params.companyId);

  const preset = (params.preset?.toUpperCase() || "CURRENT_FY") as any;

  let customFrom: Date | undefined;
  let customTo: Date | undefined;

  if (params.from) customFrom = new Date(params.from + "T00:00:00");
  if (params.to) {
    customTo = new Date(params.to + "T23:59:59");
  }

  return getDateRangePreset(preset, currentFy, previousFy, customFrom, customTo);
}

/**
 * Generate FY-aware document numbering prefix.
 * Example: For FY 2024-25, prefix = "24-25"
 */
export function getFyDocumentPrefix(fy: FinancialYear): string {
  const startYY = String(fy.startYear).slice(2);
  const endYY = String(fy.endYear).slice(2);
  return `${startYY}-${endYY}`;
}
