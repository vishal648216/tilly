"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatCurrency } from "@/lib/currency";

export default function UpiQrCode({
  upiId,
  payeeName,
  amount,
  invoiceNo,
}: {
  upiId: string;
  payeeName: string;
  amount: number;
  invoiceNo: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Construct NPCI standard UPI Payment Intent URL
  const cleanUpiId = upiId.trim();
  const upiUrl = `upi://pay?pa=${cleanUpiId}&pn=${encodeURIComponent(
    payeeName
  )}&am=${amount.toFixed(2)}&tn=${encodeURIComponent(
    `Invoice ${invoiceNo}`
  )}&cu=INR`;

  useEffect(() => {
    if (cleanUpiId) {
      QRCode.toDataURL(upiUrl, {
        width: 160,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR Code Generation Error:", err));
    }
  }, [cleanUpiId, upiUrl]);

  if (!cleanUpiId) {
    return (
      <div className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 rounded-lg bg-slate-50 text-center max-w-[170px]">
        <div className="mb-1 text-slate-400">
          <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </div>
        <p className="text-[11px] font-semibold text-slate-700">UPI QR Code</p>
        <p className="text-[9px] text-slate-400 mt-0.5">
          Add UPI ID in Settings to display live payment QR code
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-center max-w-[170px]">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs font-bold text-slate-800">Scan to Pay</span>
        <span className="text-[10px] font-bold text-brand-600">₹{amount.toFixed(0)}</span>
      </div>

      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt={`UPI QR Code for ${invoiceNo}`}
          className="w-28 h-28 object-contain rounded"
        />
      ) : (
        <div className="w-28 h-28 flex items-center justify-center bg-slate-50 text-xs text-slate-400">
          Loading QR...
        </div>
      )}

      <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-semibold text-slate-500">
        <span>GPay</span> • <span>PhonePe</span> • <span>Paytm</span>
      </div>
      <p className="text-[9px] font-mono text-slate-400 truncate max-w-[150px] mt-0.5">
        {cleanUpiId}
      </p>
    </div>
  );
}
