"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { MessageCircle, Printer, Share2, Check } from "lucide-react";

export default function InvoiceActions({
  invoiceNo,
  partyName,
  partyPhone,
  grandTotal,
  companyName,
  status,
  upiId,
}: {
  invoiceNo: string;
  partyName?: string | null;
  partyPhone?: string | null;
  grandTotal?: number;
  companyName?: string;
  status?: string;
  upiId?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function handlePrint() {
    window.print();
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this link:", url);
    }
  }

  const cleanPhone = partyPhone ? partyPhone.replace(/\D/g, "") : "";
  const whatsappNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  // Build WhatsApp text with payment link if UPI is configured
  const upiPayLink = upiId
    ? `\n💳 *Pay via UPI:* upi://pay?pa=${upiId}&pn=${encodeURIComponent(companyName || "Taily")}&am=${(grandTotal || 0).toFixed(2)}&tn=Invoice-${invoiceNo}&cu=INR`
    : "";

  const whatsappText = encodeURIComponent(
    `Hello ${partyName || "Customer"},\n\n` +
      `Here is your invoice *#${invoiceNo}* from *${companyName || "Taily"}*.\n` +
      `💰 Amount: *${grandTotal ? formatCurrency(grandTotal) : "₹0"}*\n` +
      `📌 Status: *${status || "UNPAID"}*${upiPayLink}\n\n` +
      `Thank you for doing business with us!`
  );

  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${whatsappText}`
    : `https://wa.me/?text=${whatsappText}`;

  return (
    <div className="flex items-center gap-2">
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
      <button onClick={handleShare} className="btn-secondary text-sm flex items-center gap-2">
        {copied ? (
          <>
            <Check className="h-4 w-4 text-emerald-600" /> Copied!
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" /> Share
          </>
        )}
      </button>
    </div>
  );
}
