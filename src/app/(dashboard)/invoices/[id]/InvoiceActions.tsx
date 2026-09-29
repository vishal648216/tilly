"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import {
  MessageCircle,
  Printer,
  Share2,
  Check,
  RotateCcw,
  Image as ImageIcon,
  Download,
  Link as LinkIcon,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";
import html2canvas from "html2canvas";

export default function InvoiceActions({
  invoiceId,
  invoiceNo,
  invoiceType,
  partyName,
  partyPhone,
  grandTotal,
  companyName,
  status,
  upiId,
}: {
  invoiceId?: string;
  invoiceNo: string;
  invoiceType?: string;
  partyName?: string | null;
  partyPhone?: string | null;
  grandTotal?: number;
  companyName?: string;
  status?: string;
  upiId?: string | null;
}) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatingImg, setGeneratingImg] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);

  function handlePrint() {
    window.print();
  }

  // Public URL that doesn't require any login/password
  const publicUrl = invoiceId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/view/invoice/${invoiceId}`
    : "";

  async function handleDownloadImage() {
    setGeneratingImg(true);
    try {
      const el = document.getElementById("invoice-paper");
      if (!el) throw new Error("Invoice element not found");

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
      alert("Error generating image: " + err.message);
    } finally {
      setGeneratingImg(false);
    }
  }

  async function handleNativeShareImage() {
    setGeneratingImg(true);
    try {
      const el = document.getElementById("invoice-paper");
      if (!el) throw new Error("Invoice element not found");

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          handleDownloadImage();
          return;
        }
        const file = new File([blob], `Invoice-${invoiceNo}.png`, { type: "image/png" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Invoice #${invoiceNo}`,
              text: `Invoice #${invoiceNo} from ${companyName || "Taily"} - ₹${grandTotal?.toFixed(2) || "0"}`,
              files: [file],
            });
          } catch (shareErr) {
            // User cancelled or share dismissed
          }
        } else {
          // Fallback to downloading image and opening share modal
          const dataUrl = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = `Invoice-${invoiceNo}.png`;
          a.click();
          setShowShareModal(true);
        }
        setGeneratingImg(false);
      }, "image/png");
    } catch (err: any) {
      alert("Error sharing image: " + err.message);
      setGeneratingImg(false);
    }
  }

  async function handleCopyPublicLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedPublicLink(true);
      setTimeout(() => setCopiedPublicLink(false), 2500);
    } catch {
      prompt("Copy this public link:", publicUrl);
    }
  }

  const cleanPhone = partyPhone ? partyPhone.replace(/\D/g, "") : "";
  const whatsappNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  // Build WhatsApp text with public view link & UPI payment
  const upiPayLink = upiId
    ? `\n💳 *Pay via UPI:* upi://pay?pa=${upiId}&pn=${encodeURIComponent(companyName || "Taily")}&am=${(grandTotal || 0).toFixed(2)}&tn=Invoice-${invoiceNo}&cu=INR`
    : "";

  const viewBillLinkText = publicUrl ? `\n📄 *View/Print Bill Online:* ${publicUrl}` : "";

  const whatsappText = encodeURIComponent(
    `Hello ${partyName || "Customer"},\n\n` +
      `Here is your invoice *#${invoiceNo}* from *${companyName || "Taily"}*.\n` +
      `💰 Amount: *${grandTotal ? formatCurrency(grandTotal) : "₹0"}*\n` +
      `📌 Status: *${status || "UNPAID"}*${viewBillLinkText}${upiPayLink}\n\n` +
      `Thank you for doing business with us!`
  );

  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${whatsappText}`
    : `https://wa.me/?text=${whatsappText}`;

  return (
    <>
      <div className="flex items-center gap-2">
        {invoiceType === "SALES" && invoiceId && (
          <Link
            href={`/sales-return/new?invoiceId=${invoiceId}`}
            className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 shadow-xs hover:bg-amber-100 transition-colors"
          >
            <RotateCcw className="h-4 w-4 text-amber-700" /> Sales Return
          </Link>
        )}

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp Bill
        </a>

        <button onClick={handlePrint} className="btn-primary text-sm flex items-center gap-2">
          <Printer className="h-4 w-4" /> Print / PDF
        </button>

        <button
          onClick={() => setShowShareModal(true)}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>

      {/* Share Modal Dialog */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-brand-600" /> Share Invoice #{invoiceNo}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Send as high-resolution image, PDF, WhatsApp, or public link (no login required)
                </p>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* Option 1: Share / Download Image (PNG) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Invoice Image (PNG)</h4>
                    <p className="text-xs text-slate-500">
                      High-resolution full invoice image ready for WhatsApp & Gallery
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleNativeShareImage}
                    disabled={generatingImg}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {generatingImg ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Share2 className="h-3.5 w-3.5" />
                    )}
                    Share / Send
                  </button>
                  <button
                    onClick={handleDownloadImage}
                    disabled={generatingImg}
                    title="Download PNG image directly"
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Option 2: Print / PDF */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-purple-100 p-2.5 text-purple-700">
                    <Printer className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Print or Save PDF</h4>
                    <p className="text-xs text-slate-500">
                      Standard A4 print / Save as PDF via browser dialog
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setTimeout(handlePrint, 300);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition-colors shrink-0"
                >
                  <Printer className="h-3.5 w-3.5" /> Print / PDF
                </button>
              </div>

              {/* Option 3: WhatsApp with Bill details */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">WhatsApp Message</h4>
                    <p className="text-xs text-slate-500">
                      Send formatted bill details, UPI QR payment & view link
                    </p>
                  </div>
                </div>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowShareModal(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors shrink-0"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              </div>

              {/* Option 4: Public View Link (No Login Required) */}
              {publicUrl && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-emerald-700" />
                      <h4 className="text-sm font-bold text-slate-900">
                        Public Bill Link (No Login Required)
                      </h4>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Direct Access
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Anyone with this link can view and download this bill without entering login/password.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      readOnly
                      value={publicUrl}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 font-mono select-all outline-none"
                    />
                    <button
                      onClick={handleCopyPublicLink}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 shrink-0 transition-colors"
                    >
                      {copiedPublicLink ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <LinkIcon className="h-3.5 w-3.5" /> Copy
                        </>
                      )}
                    </button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 shrink-0"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
