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
      const textFromUpload = (formData.get("rawText") as string) || "";

      // 1. If client provided extracted text (from client-side OCR or textarea), use it directly!
      if (textFromUpload && textFromUpload.trim().length > 0) {
        rawText = textFromUpload.trim();
      }

      if (file && file.size > 0) {
        fileName = file.name;
        const lowerName = file.name.toLowerCase();

        // 2. If it's a PDF and text was not yet extracted by client, parse PDF text layer
        if (!rawText && (lowerName.endsWith(".pdf") || file.type.includes("pdf"))) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const { PDFParse } = require("pdf-parse");
            const parser = new PDFParse({ data: buffer });
            const pdfData = await parser.getText();
            if (pdfData && pdfData.text && pdfData.text.trim().length > 15) {
              rawText = pdfData.text.trim();
            }
          } catch (pdfErr) {
            console.warn("Digital PDF text parse failed:", pdfErr);
          }
        }
      }
    } else {
      const body = await req.json().catch(() => ({}));
      rawText = body.rawText?.trim() || "";
      fileName = body.fileName || "supplier_bill.pdf";
    }

    if (!rawText) {
      return NextResponse.json(
        {
          error:
            "Could not extract text from the document. Please ensure the document is clear, or paste the invoice text in the box.",
        },
        { status: 400 }
      );
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
