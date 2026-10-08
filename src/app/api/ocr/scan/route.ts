import { NextResponse } from "next/server";
import { requireCompanyAccess, handleAuthError } from "@/lib/auth";
import { stageOcrBillScan } from "@/lib/ocrBill";

export const dynamic = "force-dynamic";

function extractLargestJpegFromPdf(pdfBuffer: Buffer): Buffer | null {
  let best: Buffer | null = null;
  let startIndex = 0;
  const startMarker = Buffer.from([0xff, 0xd8, 0xff]);
  const endMarker = Buffer.from([0xff, 0xd9]);

  while ((startIndex = pdfBuffer.indexOf(startMarker, startIndex)) !== -1) {
    const endIndex = pdfBuffer.indexOf(endMarker, startIndex);
    if (endIndex !== -1) {
      const candidate = pdfBuffer.subarray(startIndex, endIndex + 2);
      if (candidate.length > 2000 && (!best || candidate.length > best.length)) {
        best = candidate;
      }
      startIndex = endIndex + 2;
    } else {
      break;
    }
  }
  return best;
}

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

        // 1. If it's a PDF, first attempt to extract the digital text layer
        if (lowerName.endsWith(".pdf") || file.type.includes("pdf")) {
          try {
            const pdfParse = require("pdf-parse");
            const pdfData = await pdfParse(buffer);
            if (pdfData && pdfData.text && pdfData.text.trim().length > 15) {
              rawText = pdfData.text.trim();
            }
          } catch (pdfErr) {
            console.warn("Digital PDF text parse failed:", pdfErr);
          }

          // If the PDF had no digital text (e.g., a photo or WhatsApp image saved as PDF)
          if (!rawText) {
            const extractedImage = extractLargestJpegFromPdf(buffer);
            if (extractedImage) {
              try {
                const Tesseract = require("tesseract.js");
                const ocrResult = await Tesseract.recognize(extractedImage, "eng");
                if (ocrResult?.data?.text && ocrResult.data.text.trim().length > 5) {
                  rawText = ocrResult.data.text.trim();
                }
              } catch (imgErr) {
                console.warn("OCR on embedded PDF image error:", imgErr);
              }
            }
          }
        }

        // 2. If it's a direct image file (.png, .jpg, .jpeg, .webp, .bmp)
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

      // Check if text was pasted in the raw text box
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
            "Could not extract text from the uploaded document. If this is a photo of a bill, try uploading the direct image file (PNG/JPG) or paste the bill text in the box on the right.",
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
