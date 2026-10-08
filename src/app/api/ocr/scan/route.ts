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

      if (file && file.size > 0) {
        fileName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const lowerName = file.name.toLowerCase();

        // 1. Try PDF text stream extraction first
        if (lowerName.endsWith(".pdf") || file.type.includes("pdf")) {
          try {
            const pdfParse = require("pdf-parse");
            const pdfData = await pdfParse(buffer);
            if (pdfData && pdfData.text && pdfData.text.trim().length > 10) {
              rawText = pdfData.text.trim();
            }
          } catch (pdfErr) {
            console.warn("PDF text parse error, will try OCR fallback if needed:", pdfErr);
          }
        }

        // 2. If it's an image OR a scanned PDF with no text stream, perform Tesseract OCR
        if (
          !rawText &&
          (lowerName.endsWith(".png") ||
            lowerName.endsWith(".jpg") ||
            lowerName.endsWith(".jpeg") ||
            lowerName.endsWith(".webp") ||
            lowerName.endsWith(".bmp") ||
            file.type.includes("image"))
        ) {
          try {
            const Tesseract = require("tesseract.js");
            const ocrResult = await Tesseract.recognize(buffer, "eng");
            if (ocrResult?.data?.text && ocrResult.data.text.trim().length > 5) {
              rawText = ocrResult.data.text.trim();
            }
          } catch (ocrErr) {
            console.warn("Tesseract OCR recognition error:", ocrErr);
          }
        }
      }

      // If file didn't yield text, check if text was pasted in the rawText input
      if (!rawText && textFromUpload) {
        rawText = textFromUpload.trim();
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
            "Could not extract text from the uploaded document. Please ensure the file is clear or paste the bill text in the text box.",
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
