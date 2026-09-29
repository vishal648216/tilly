"use client";

import { useState } from "react";
import { Printer, Download, Image as ImageIcon, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";

export default function PublicInvoiceActions({ invoiceNo }: { invoiceNo: string }) {
  const [downloadingImg, setDownloadingImg] = useState(false);

  function handlePrint() {
    window.print();
  }

  async function handleDownloadImage() {
    setDownloadingImg(true);
    try {
      const el = document.getElementById("invoice-paper");
      if (!el) throw new Error("Invoice paper element not found");

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `Invoice-${invoiceNo}.png`;
      a.click();
    } catch (err: any) {
      alert("Failed to download image: " + err.message);
    } finally {
      setDownloadingImg(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDownloadImage}
        disabled={downloadingImg}
        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        {downloadingImg ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" /> Generating...
          </>
        ) : (
          <>
            <ImageIcon className="h-4 w-4 text-brand-600" /> Save Image (PNG)
          </>
        )}
      </button>

      <button
        onClick={handlePrint}
        className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 transition-colors"
      >
        <Printer className="h-4 w-4" /> Print / PDF
      </button>
    </div>
  );
}
