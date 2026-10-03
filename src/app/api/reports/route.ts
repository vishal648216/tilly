import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { resolveDateRange } from "@/lib/financialYear";
import { generateCsv, generateExcelXml } from "@/lib/export";
import {
  getSalesRegisterReport,
  getCustomerWiseSalesReport,
  getItemWiseSalesReport,
  getSalespersonSalesReport,
  getDiscountReport,
  getTaxReport,
  getSalesProfitabilityReport,
  getPurchaseRegisterReport,
  getSupplierWisePurchaseReport,
  getItemWisePurchaseReport,
  getPurchaseRateHistoryReport,
  getStockSummaryReport,
  getStockValuationReport,
  getLowStockReport,
  getInventoryMovementVelocityReport,
  getPartyAgingReport,
  getJournalRegisterReport,
  getDashboardAnalytics,
  getTaxPurchaseReport,
  getStockLedgerReport,
  getStockAdjustmentReport,
  getStockTransferReport,
  getItemProfitabilityReport,
  getPartyOverdueReport,
  getPartyPaymentHistoryReport,
  getSupplierPurchaseHistoryReport,
} from "@/lib/reports";
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getGeneralLedger,
  getDayBook,
  getCashBook,
  getBankBook,
} from "@/lib/accounting";

export async function GET(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;
    const { searchParams } = new URL(req.url);

    const reportType = searchParams.get("report") || "SALES_REGISTER";
    const preset = searchParams.get("preset") || "CURRENT_FY";
    const fromParam = searchParams.get("from") || undefined;
    const toParam = searchParams.get("to") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const partyId = searchParams.get("partyId") || undefined;
    const itemId = searchParams.get("itemId") || undefined;
    const warehouseId = searchParams.get("warehouseId") || undefined;
    const format = (searchParams.get("format") || "json").toLowerCase();

    const dateRange = await resolveDateRange({
      companyId,
      preset,
      from: fromParam,
      to: toParam,
    });

    let reportResult: any;
    let exportHeaders: string[] = [];
    let exportRows: any[][] = [];
    let reportTitle = reportType.toLowerCase().replace(/_/g, "-");

    switch (reportType.toUpperCase()) {
      case "SALES_REGISTER": {
        reportResult = await getSalesRegisterReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
          partyId,
        });
        exportHeaders = ["Date", "Invoice #", "Customer", "GSTIN", "Taxable (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total (₹)", "Paid (₹)", "Balance (₹)", "Status"];
        exportRows = reportResult.data.map((r: any) => [
          new Date(r.date).toLocaleDateString("en-IN"),
          r.invoiceNo,
          r.customerName,
          r.customerGstin,
          r.subTotal,
          r.cgst,
          r.sgst,
          r.igst,
          r.grandTotal,
          r.paidAmount,
          r.balanceDue,
          r.status,
        ]);
        break;
      }

      case "CUSTOMER_SALES": {
        reportResult = await getCustomerWiseSalesReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Customer Name", "GSTIN", "Phone", "City", "Invoices", "Taxable (₹)", "Tax (₹)", "Total Sales (₹)", "Collected (₹)", "Outstanding (₹)", "Avg Order (₹)"];
        exportRows = reportResult.data.map((r: any) => [
          r.customerName,
          r.gstin,
          r.phone,
          r.city,
          r.invoiceCount,
          r.taxableAmount,
          r.taxAmount,
          r.grandTotal,
          r.paidAmount,
          r.outstandingAmount,
          r.avgOrderValue,
        ]);
        break;
      }

      case "ITEM_SALES": {
        reportResult = await getItemWiseSalesReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Item Name", "SKU", "HSN", "Unit", "Qty Sold", "Avg Rate (₹)", "Taxable (₹)", "Discount (₹)", "Tax (₹)", "Total (₹)", "COGS (₹)", "Gross Profit (₹)", "Margin %"];
        exportRows = reportResult.data.map((r: any) => [
          r.name,
          r.sku,
          r.hsn,
          r.unit,
          r.qtySold,
          r.avgRate,
          r.totalTaxable,
          r.totalDiscount,
          r.totalTax,
          r.totalAmount,
          r.cogs,
          r.grossProfit,
          `${r.profitMargin}%`,
        ]);
        break;
      }

      case "SALESPERSON_SALES": {
        reportResult = await getSalespersonSalesReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Salesperson", "Invoices", "Taxable (₹)", "Grand Total (₹)", "Collected (₹)", "Pending (₹)"];
        exportRows = reportResult.data.map((r: any) => [
          r.salesperson,
          r.invoiceCount,
          r.taxableAmount,
          r.grandTotal,
          r.collectedAmount,
          r.pendingCollection,
        ]);
        break;
      }

      case "DISCOUNT_REPORT": {
        reportResult = await getDiscountReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Date", "Invoice #", "Customer", "Gross Total (₹)", "Item Discounts (₹)", "Bill Discount (₹)", "Total Discount (₹)", "Discount %", "Net Bill (₹)"];
        exportRows = reportResult.data.map((r: any) => [
          new Date(r.date).toLocaleDateString("en-IN"),
          r.invoiceNo,
          r.customerName,
          r.grossBeforeDiscount,
          r.lineDiscounts,
          r.invoiceDiscount,
          r.totalDiscount,
          `${r.discountPercent}%`,
          r.grandTotal,
        ]);
        break;
      }

      case "TAX_REPORT": {
        reportResult = await getTaxReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          type: (searchParams.get("taxType") as any) || "SALES",
        });
        exportHeaders = ["Tax Slab", "Taxable Amount (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total Tax (₹)"];
        exportRows = reportResult.slabs.map((r: any) => [
          r.rate,
          r.taxable,
          r.cgst,
          r.sgst,
          r.igst,
          r.totalTax,
        ]);
        break;
      }

      case "SALES_PROFITABILITY": {
        reportResult = await getSalesProfitabilityReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Date", "Invoice #", "Customer", "Net Revenue (₹)", "COGS Cost (₹)", "Gross Profit (₹)", "Margin %", "Profitable"];
        exportRows = reportResult.data.map((r: any) => [
          new Date(r.date).toLocaleDateString("en-IN"),
          r.invoiceNo,
          r.customerName,
          r.netRevenue,
          r.cogs,
          r.grossMargin,
          `${r.marginPercent}%`,
          r.isProfitable ? "Yes" : "Loss",
        ]);
        break;
      }

      case "PURCHASE_REGISTER": {
        reportResult = await getPurchaseRegisterReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
          partyId,
        });
        exportHeaders = ["Date", "Bill #", "Supplier Inv #", "Supplier", "GSTIN", "Taxable (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total (₹)", "Paid (₹)", "Balance (₹)", "Status"];
        exportRows = reportResult.data.map((r: any) => [
          new Date(r.date).toLocaleDateString("en-IN"),
          r.billNo,
          r.supplierInvoiceNo,
          r.supplierName,
          r.supplierGstin,
          r.subTotal,
          r.cgst,
          r.sgst,
          r.igst,
          r.grandTotal,
          r.paidAmount,
          r.balanceDue,
          r.status,
        ]);
        break;
      }

      case "SUPPLIER_PURCHASE": {
        reportResult = await getSupplierWisePurchaseReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Supplier Name", "GSTIN", "Phone", "City", "Bills Count", "Taxable (₹)", "Tax (₹)", "Total Purchase (₹)", "Paid (₹)", "Outstanding Payable (₹)"];
        exportRows = reportResult.data.map((r: any) => [
          r.supplierName,
          r.gstin,
          r.phone,
          r.city,
          r.billCount,
          r.taxableAmount,
          r.taxAmount,
          r.grandTotal,
          r.paidAmount,
          r.outstandingPayable,
        ]);
        break;
      }

      case "ITEM_PURCHASE": {
        reportResult = await getItemWisePurchaseReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Item Name", "SKU", "Unit", "Qty Received", "Avg Rate (₹)", "Taxable (₹)", "Tax (₹)", "Total Spend (₹)"];
        exportRows = reportResult.data.map((r: any) => [
          r.name,
          r.sku,
          r.unit,
          r.qtyReceived,
          r.avgPurchaseRate,
          r.totalTaxable,
          r.totalTax,
          r.totalSpend,
        ]);
        break;
      }

      case "PURCHASE_RATE_HISTORY": {
        reportResult = await getPurchaseRateHistoryReport({
          companyId,
          itemId,
          page,
          limit,
        });
        exportHeaders = ["Date", "Bill #", "Supplier Inv #", "Supplier", "Item Name", "SKU", "Qty", "Unit", "Purchase Rate (₹)", "Tax %", "Taxable (₹)"];
        exportRows = reportResult.data.map((r: any) => [
          new Date(r.date).toLocaleDateString("en-IN"),
          r.billNo,
          r.supplierInvoiceNo,
          r.supplierName,
          r.itemName,
          r.sku,
          r.qty,
          r.unit,
          r.purchaseRate,
          `${r.taxRate}%`,
          r.taxableAmount,
        ]);
        break;
      }

      case "STOCK_SUMMARY": {
        reportResult = await getStockSummaryReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          warehouseId,
          page,
          limit,
        });
        exportHeaders = ["Item Name", "SKU", "Category", "Unit", "Opening Qty", "Inward Qty", "Outward Qty", "Closing Qty", "Cost Rate (₹)", "Stock Value (₹)", "Reorder Level"];
        exportRows = reportResult.data.map((r: any) => [
          r.name,
          r.sku,
          r.category,
          r.unit,
          r.openingStock,
          r.inward,
          r.outward,
          r.closingStock,
          r.purchasePrice,
          r.stockValue,
          r.reorderLevel,
        ]);
        break;
      }

      case "STOCK_VALUATION": {
        reportResult = await getStockValuationReport({
          companyId,
          warehouseId,
          page,
          limit,
        });
        exportHeaders = ["Item Name", "SKU", "Unit", "Stock Qty", "Cost Price (₹)", "Valuation (₹)", "Sale Price (₹)", "Potential Revenue (₹)", "Potential Margin (₹)"];
        exportRows = reportResult.data.map((r: any) => [
          r.name,
          r.sku,
          r.unit,
          r.stock,
          r.costPrice,
          r.valuation,
          r.salePrice,
          r.potentialRevenue,
          r.potentialMargin,
        ]);
        break;
      }

      case "LOW_STOCK": {
        reportResult = await getLowStockReport({
          companyId,
          warehouseId,
          page,
          limit,
        });
        exportHeaders = ["Item Name", "SKU", "Unit", "Current Stock", "Min Stock", "Reorder Level", "Deficit", "Suggested Order Qty", "Cost Rate (₹)", "Estimated Investment (₹)"];
        exportRows = reportResult.data.map((r: any) => [
          r.name,
          r.sku,
          r.unit,
          r.currentStock,
          r.minStock,
          r.reorderLevel,
          r.deficit,
          r.suggestedOrderQty,
          r.purchasePrice,
          r.estimatedReorderCost,
        ]);
        break;
      }

      case "INVENTORY_VELOCITY": {
        reportResult = await getInventoryMovementVelocityReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          limit: 15,
        });
        break;
      }

      case "CUSTOMER_AGING": {
        reportResult = await getPartyAgingReport({
          companyId,
          type: "CUSTOMER",
          asOfDate: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Customer Name", "GSTIN", "Phone", "Total Due (₹)", "0-30 Days (₹)", "31-60 Days (₹)", "61-90 Days (₹)", "90+ Days (₹)", "Oldest (Days)"];
        exportRows = reportResult.data.map((r: any) => [
          r.partyName,
          r.gstin,
          r.phone,
          r.totalOutstanding,
          r.days0To30,
          r.days31To60,
          r.days61To90,
          r.days90Plus,
          r.oldestInvoiceDays,
        ]);
        break;
      }

      case "SUPPLIER_AGING": {
        reportResult = await getPartyAgingReport({
          companyId,
          type: "VENDOR",
          asOfDate: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Supplier Name", "GSTIN", "Phone", "Total Payable (₹)", "0-30 Days (₹)", "31-60 Days (₹)", "61-90 Days (₹)", "90+ Days (₹)", "Oldest (Days)"];
        exportRows = reportResult.data.map((r: any) => [
          r.partyName,
          r.gstin,
          r.phone,
          r.totalOutstanding,
          r.days0To30,
          r.days31To60,
          r.days61To90,
          r.days90Plus,
          r.oldestInvoiceDays,
        ]);
        break;
      }

      case "JOURNAL_REGISTER": {
        reportResult = await getJournalRegisterReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Date", "Voucher #", "Narration", "Total Amount (₹)", "Balanced"];
        exportRows = reportResult.data.map((r: any) => [
          new Date(r.date).toLocaleDateString("en-IN"),
          r.voucherNo,
          r.narration,
          r.totalAmount,
          r.isBalanced ? "Balanced" : "Imbalance",
        ]);
        break;
      }

      case "TAX_PURCHASE": {
        reportResult = await getTaxPurchaseReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Date", "Bill #", "Supplier Inv #", "Supplier", "GSTIN", "Taxable (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total Tax (₹)", "Total (₹)"];
        exportRows = reportResult.data.map((r: any) => [
          new Date(r.date).toLocaleDateString("en-IN"),
          r.billNo,
          r.supplierInvoiceNo,
          r.supplierName,
          r.supplierGstin,
          r.taxableAmount,
          r.cgst,
          r.sgst,
          r.igst,
          r.totalTax,
          r.grandTotal,
        ]);
        break;
      }

      case "STOCK_LEDGER": {
        reportResult = await getStockLedgerReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          itemId,
          warehouseId,
          page,
          limit,
        });
        exportHeaders = ["Date", "Item Name", "SKU", "Unit", "Movement", "Ref Type", "Ref ID", "Qty In", "Qty Out", "Running Balance", "Cost (₹)"];
        exportRows = reportResult.data.map((r: any) => [
          new Date(r.date).toLocaleDateString("en-IN"),
          r.itemName,
          r.sku,
          r.unit,
          r.movementType,
          r.referenceType,
          r.referenceId,
          r.qtyIn,
          r.qtyOut,
          r.runningBalance,
          r.unitCost,
        ]);
        break;
      }

      case "STOCK_ADJUSTMENT": {
        reportResult = await getStockAdjustmentReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          warehouseId,
          page,
          limit,
        });
        exportHeaders = ["Date", "Item Name", "SKU", "Unit", "Adjustment Type", "Qty In", "Qty Out", "Unit Cost (₹)", "Total Value (₹)", "Notes"];
        exportRows = reportResult.data.map((r: any) => [
          new Date(r.date).toLocaleDateString("en-IN"),
          r.itemName,
          r.sku,
          r.unit,
          r.type,
          r.qtyIn,
          r.qtyOut,
          r.unitCost,
          r.totalValue,
          r.notes,
        ]);
        break;
      }

      case "STOCK_TRANSFER": {
        reportResult = await getStockTransferReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Date", "Item Name", "SKU", "Unit", "Transfer Type", "Qty", "Cost (₹)", "Ref ID", "Notes"];
        exportRows = reportResult.data.map((r: any) => [
          new Date(r.date).toLocaleDateString("en-IN"),
          r.itemName,
          r.sku,
          r.unit,
          r.transferType,
          r.qty,
          r.unitCost,
          r.referenceId,
          r.notes,
        ]);
        break;
      }

      case "ITEM_PROFITABILITY": {
        reportResult = await getItemProfitabilityReport({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Item Name", "SKU", "Unit", "Qty Sold", "Revenue (₹)", "COGS (₹)", "Gross Profit (₹)", "Margin %"];
        exportRows = reportResult.data.map((r: any) => [
          r.name,
          r.sku,
          r.unit,
          r.qtySold,
          r.revenue,
          r.cogs,
          r.grossProfit,
          `${r.marginPercent}%`,
        ]);
        break;
      }

      case "CUSTOMER_OVERDUE": {
        reportResult = await getPartyOverdueReport({
          companyId,
          type: "CUSTOMER",
          page,
          limit,
        });
        exportHeaders = ["Invoice #", "Customer", "Date", "Due Date", "Total (₹)", "Paid (₹)", "Balance Due (₹)", "Overdue (Days)"];
        exportRows = reportResult.data.map((r: any) => [
          r.invoiceNo,
          r.partyName,
          new Date(r.date).toLocaleDateString("en-IN"),
          r.dueDate ? new Date(r.dueDate).toLocaleDateString("en-IN") : "—",
          r.grandTotal,
          r.paidAmount,
          r.balanceDue,
          r.overdueDays,
        ]);
        break;
      }

      case "VENDOR_OVERDUE": {
        reportResult = await getPartyOverdueReport({
          companyId,
          type: "VENDOR",
          page,
          limit,
        });
        exportHeaders = ["Bill #", "Supplier", "Date", "Due Date", "Total (₹)", "Paid (₹)", "Balance Due (₹)", "Overdue (Days)"];
        exportRows = reportResult.data.map((r: any) => [
          r.invoiceNo,
          r.partyName,
          new Date(r.date).toLocaleDateString("en-IN"),
          r.dueDate ? new Date(r.dueDate).toLocaleDateString("en-IN") : "—",
          r.grandTotal,
          r.paidAmount,
          r.balanceDue,
          r.overdueDays,
        ]);
        break;
      }

      case "PAYMENT_HISTORY": {
        reportResult = await getPartyPaymentHistoryReport({
          companyId,
          partyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Payment #", "Date", "Type", "Party", "Mode", "Amount (₹)", "Invoice #", "Ref #", "Status"];
        exportRows = reportResult.data.map((r: any) => [
          r.paymentNo,
          new Date(r.date).toLocaleDateString("en-IN"),
          r.type,
          r.partyName,
          r.paymentMode,
          r.amount,
          r.invoiceNo,
          r.reference,
          r.status,
        ]);
        break;
      }

      case "SUPPLIER_PURCHASE_HISTORY": {
        reportResult = await getSupplierPurchaseHistoryReport({
          companyId,
          supplierId: partyId,
          from: dateRange.from,
          to: dateRange.to,
          page,
          limit,
        });
        exportHeaders = ["Date", "Bill #", "Supplier Inv #", "Supplier", "Taxable (₹)", "Tax (₹)", "Total (₹)", "Paid (₹)", "Balance (₹)"];
        exportRows = reportResult.data.map((r: any) => [
          new Date(r.date).toLocaleDateString("en-IN"),
          r.billNo,
          r.supplierInvoiceNo,
          r.supplierName,
          r.taxableAmount,
          r.taxAmount,
          r.grandTotal,
          r.paidAmount,
          r.balanceDue,
        ]);
        break;
      }

      case "TRIAL_BALANCE": {
        reportResult = await getTrialBalance({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
        });
        exportHeaders = ["Account Code", "Account Name", "Group", "Debit (₹)", "Credit (₹)"];
        exportRows = (reportResult.rows || []).map((r: any) => [
          r.code,
          r.name,
          r.type,
          r.drColumn,
          r.crColumn,
        ]);
        break;
      }

      case "PROFIT_LOSS": {
        reportResult = await getProfitAndLoss({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
        });
        exportHeaders = ["Category", "Amount (₹)"];
        exportRows = [
          ["Sales Revenue", reportResult.salesRevenue],
          ["Sales Return", reportResult.salesReturn],
          ["Net Sales", reportResult.netSales],
          ["COGS", reportResult.cogs],
          ["Gross Profit", reportResult.grossProfit],
          ["Operating Expenses", reportResult.totalExpenses],
          ["Net Profit", reportResult.netProfit],
        ];
        break;
      }

      case "BALANCE_SHEET": {
        reportResult = await getBalanceSheet({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
        });
        exportHeaders = ["Section", "Account / Category", "Amount (₹)"];
        exportRows = [
          ...((reportResult.currentAssets || []).map((a: any) => ["Current Assets", a.name, a.closingBalance])),
          ...((reportResult.fixedAssets || []).map((a: any) => ["Fixed Assets", a.name, a.closingBalance])),
          ...((reportResult.currentLiabilities || []).map((l: any) => ["Current Liabilities", l.name, l.closingBalance])),
          ...((reportResult.longTermLiabilities || []).map((l: any) => ["Long-term Liabilities", l.name, l.closingBalance])),
          ...((reportResult.equityAccounts || []).map((e: any) => ["Equity", e.name, e.closingBalance])),
          ["Equity", "Retained Earnings", reportResult.retainedEarnings],
        ];
        break;
      }

      case "DASHBOARD_ANALYTICS": {
        reportResult = await getDashboardAnalytics({
          companyId,
          from: dateRange.from,
          to: dateRange.to,
          periodLabel: dateRange.label,
        });
        break;
      }

      default: {
        return NextResponse.json({ ok: false, error: `Unknown report type: ${reportType}` }, { status: 400 });
      }
    }

    // Handle CSV Export
    if (format === "csv" && exportHeaders.length > 0) {
      const csvContent = generateCsv(exportHeaders, exportRows);
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${reportTitle}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // Handle Excel Export (True Excel SpreadsheetML)
    if (format === "xls" && exportHeaders.length > 0) {
      const excelXmlContent = generateExcelXml(reportTitle, exportHeaders, exportRows);
      return new NextResponse(excelXmlContent, {
        headers: {
          "Content-Type": "application/vnd.ms-excel",
          "Content-Disposition": `attachment; filename="${reportTitle}-${new Date().toISOString().slice(0, 10)}.xls"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      report: reportType,
      period: {
        preset,
        from: dateRange.from,
        to: dateRange.to,
        label: dateRange.label,
      },
      ...reportResult,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
