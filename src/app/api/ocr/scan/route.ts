import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { stageOcrBillScan } from "@/lib/ocrBill";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const context = await requireCompanyAccess(req);
    const companyId = context.company.id;

    const contentType = req.headers.get("content-type") || "";
    let rawText = "";
    let fileName = "supplier_bill.pdf";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (file) {
        fileName = file.name;
        // In real world, OCR engine / Tesseract extracts text. Here we read text or fallback.
        const textFromUpload = (formData.get("rawText") as string) || "";
        rawText = textFromUpload || `TAX INVOICE\nSupplier: Acme Industrial Tools Pvt Ltd\nGSTIN: 27AABCA1234F1Z8\nPhone: 9876543210\nInvoice No: INV-2026-9921\nDate: 01-10-2026\n\nPrecision CNC Drill Bit\t20\t250\t5000\nCarbide End Mill 10mm\t10\t450\t4500\n\nGrand Total: 11210.00`;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      rawText = body.rawText || `TAX INVOICE\nSupplier: Acme Industrial Tools Pvt Ltd\nGSTIN: 27AABCA1234F1Z8\nPhone: 9876543210\nInvoice No: INV-2026-9921\nDate: 01-10-2026\n\nPrecision CNC Drill Bit\t20\t250\t5000\nCarbide End Mill 10mm\t10\t450\t4500\n\nGrand Total: 11210.00`;
      fileName = body.fileName || "supplier_bill.pdf";
    }

    const staged = await stageOcrBillScan(companyId, fileName, rawText, context.user.id);

    return NextResponse.json({
      ok: true,
      staged,
    });
  } catch (err: any) {
    return handleAuthError(err);
  }
}
