import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { handleAuthError } from "@/lib/auth";
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getDayBook,
  getCashBook,
  getBankBook,
  getJournalRegister,
  getReceivablePayableSummary,
  checkAccountingIntegrity,
} from "@/lib/accounting";
import { resolveDateRange } from "@/lib/financialYear";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const company = await getCurrentCompany();
    if (!company) return NextResponse.json({ error: "No active company" }, { status: 400 });

    const url = new URL(req.url);
    const reportType = url.searchParams.get("report") || "trial-balance";
    const preset = url.searchParams.get("preset") || "CURRENT_FY";
    const fromParam = url.searchParams.get("from") || undefined;
    const toParam = url.searchParams.get("to") || undefined;
    const accountId = url.searchParams.get("accountId") || undefined;

    // Resolve date range using financial year engine
    const dateRange = await resolveDateRange({
      companyId: company.id,
      preset,
      from: fromParam,
      to: toParam,
    });

    switch (reportType) {
      case "trial-balance": {
        const data = await getTrialBalance({
          companyId: company.id,
          from: dateRange.from,
          to: dateRange.to,
        });
        return NextResponse.json({ ok: true, report: "trial-balance", dateRange, data });
      }

      case "profit-loss": {
        const data = await getProfitAndLoss({
          companyId: company.id,
          from: dateRange.from,
          to: dateRange.to,
        });
        return NextResponse.json({ ok: true, report: "profit-loss", dateRange, data });
      }

      case "balance-sheet": {
        const data = await getBalanceSheet({
          companyId: company.id,
          from: dateRange.from,
          to: dateRange.to,
        });
        return NextResponse.json({ ok: true, report: "balance-sheet", dateRange, data });
      }

      case "day-book": {
        const voucherType = url.searchParams.get("voucherType") || undefined;
        const data = await getDayBook({
          companyId: company.id,
          from: dateRange.from,
          to: dateRange.to,
          voucherType,
        });
        return NextResponse.json({ ok: true, report: "day-book", dateRange, count: data.length, data });
      }

      case "cash-book": {
        const data = await getCashBook({
          companyId: company.id,
          from: dateRange.from,
          to: dateRange.to,
        });
        return NextResponse.json({ ok: true, report: "cash-book", dateRange, data });
      }

      case "bank-book": {
        const data = await getBankBook({
          companyId: company.id,
          from: dateRange.from,
          to: dateRange.to,
        });
        return NextResponse.json({ ok: true, report: "bank-book", dateRange, data });
      }

      case "journal-register": {
        const data = await getJournalRegister({
          companyId: company.id,
          from: dateRange.from,
          to: dateRange.to,
        });
        return NextResponse.json({ ok: true, report: "journal-register", dateRange, count: data.length, data });
      }

      case "receivable-payable": {
        const data = await getReceivablePayableSummary({
          companyId: company.id,
          from: dateRange.from,
          to: dateRange.to,
        });
        return NextResponse.json({ ok: true, report: "receivable-payable", dateRange, data });
      }

      case "integrity-check": {
        const data = await checkAccountingIntegrity(company.id);
        return NextResponse.json({ ok: true, report: "integrity-check", data });
      }

      default:
        return NextResponse.json({ error: `Unknown report type: ${reportType}` }, { status: 400 });
    }
  } catch (error) {
    return handleAuthError(error);
  }
}
