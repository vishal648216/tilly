"use client";

import { useState } from "react";
import {
  ScanLine,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Trash2,
  RefreshCw,
  FileText,
  DollarSign,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";

export default function OcrBillImportPage() {
  const [step, setStep] = useState<"UPLOAD" | "REVIEW" | "CONFIRMED">("UPLOAD");
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanRecordId, setScanRecordId] = useState<string | null>(null);
  const [billData, setBillData] = useState<any>(null);
  const [statusText, setStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);

  async function handleOcrScan() {
    setIsProcessing(true);
    setErrorMessage(null);
    setStatusText("Reading file...");

    try {
      let extractedText = rawText;

      // If user selected an image file, run OCR directly in the browser with live progress!
      if (file && (file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(file.name))) {
        setStatusText("Scanning characters with OCR (0%)...");
        try {
          const Tesseract = (await import("tesseract.js")).default;
          const result = await Tesseract.recognize(file, "eng", {
            logger: (m: any) => {
              if (m.status === "recognizing text") {
                const pct = Math.round((m.progress || 0) * 100);
                setStatusText(`Scanning text with OCR (${pct}%)...`);
              } else if (m.status) {
                setStatusText(`${m.status.charAt(0).toUpperCase() + m.status.slice(1)}...`);
              }
            },
          });
          if (result?.data?.text) {
            extractedText = result.data.text;
          }
        } catch (ocrErr: any) {
          console.warn("Client OCR error:", ocrErr);
        }
      }

      setStatusText("Extracting invoice details...");

      const formData = new FormData();
      if (file) formData.append("file", file);
      if (extractedText) formData.append("rawText", extractedText);

      const res = await fetch("/api/ocr/scan", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "OCR extraction failed.");
      }

      setScanRecordId(data.staged.scanId);
      setBillData(data.staged.extracted);
      setStep("REVIEW");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
      setStatusText("");
    }
  }

  function handleLineChange(index: number, field: string, value: any) {
    const lines = [...billData.items];
    lines[index] = { ...lines[index], [field]: value };

    // Recalculate line amount
    const qty = Number(lines[index].qty || 0);
    const rate = Number(lines[index].rate || 0);
    const discount = Number(lines[index].discount || 0);
    lines[index].amount = Math.max(0, qty * rate - discount);

    const newSubTotal = lines.reduce((acc: number, it: any) => acc + (it.amount || 0), 0);
    const newTax = lines.reduce(
      (acc: number, it: any) => acc + ((it.amount || 0) * (it.gstRate || 0)) / 100,
      0
    );
    const newGrandTotal = Math.round((newSubTotal + newTax) * 100) / 100;

    setBillData({
      ...billData,
      items: lines,
      subTotal: newSubTotal,
      taxTotal: newTax,
      grandTotal: newGrandTotal,
    });
  }

  function addEmptyLine() {
    const lines = [...billData.items, { name: "", qty: 1, rate: 0, gstRate: 18, amount: 0 }];
    setBillData({ ...billData, items: lines });
  }

  function removeLine(idx: number) {
    const lines = billData.items.filter((_: any, i: number) => i !== idx);
    setBillData({ ...billData, items: lines });
  }

  async function handleConfirmAndPostPurchase() {
    if (!scanRecordId || !billData) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/ocr/review/${scanRecordId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalData: billData }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to post verified purchase invoice.");
      }

      setCreatedInvoice(data.result);
      setStep("CONFIRMED");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-emerald-600" />
            OCR Bill & Receipt Import
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Extract supplier bills from PDF or images, review staged items, and confirm verified purchase entries.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <span className={step === "UPLOAD" ? "text-emerald-700 font-bold" : ""}>1. OCR Scan</span>
          <span>→</span>
          <span className={step === "REVIEW" ? "text-emerald-700 font-bold" : ""}>2. User Review</span>
          <span>→</span>
          <span className={step === "CONFIRMED" ? "text-emerald-700 font-bold" : ""}>3. Purchase Created</span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-xs underline hover:text-rose-900">
            Dismiss
          </button>
        </div>
      )}

      {/* STEP 1: UPLOAD & SCAN */}
      {step === "UPLOAD" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-6">
          <div className="text-center max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
              <Upload className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Upload Supplier Invoice or Receipt</h2>
            <p className="text-xs text-slate-500">
              Upload PDF or image bill, or paste raw text below to trigger intelligent OCR parsing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-emerald-500 transition-colors flex flex-col justify-center items-center">
              <FileText className="w-10 h-10 text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-800">Choose Image or PDF</p>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG, or PDF up to 10MB</p>
              <label className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs cursor-pointer">
                <span>{file ? file.name : "Select File"}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Or Paste Bill Text / Simulated OCR:</label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="TAX INVOICE&#10;Supplier: Acme Industrial Tools Pvt Ltd&#10;GSTIN: 27AABCA1234F1Z8&#10;Invoice No: INV-2026-9921&#10;Date: 01-10-2026&#10;&#10;Precision CNC Drill Bit	20	250	5000&#10;Carbide End Mill 10mm	10	450	4500&#10;&#10;Grand Total: 11210.00"
                rows={7}
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div>
              {isProcessing && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 inline-flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  <span>{statusText || "Processing document..."}</span>
                </span>
              )}
            </div>
            <button
              onClick={handleOcrScan}
              disabled={isProcessing}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 disabled:opacity-60"
            >
              {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Extract & Review Bill →</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW SCREEN (Never post unverified OCR directly) */}
      {step === "REVIEW" && billData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 inline-block mb-1">
                Staged for Review (Unverified)
              </span>
              <h2 className="text-lg font-bold text-slate-900">Review & Correct Extracted Invoice Details</h2>
              <p className="text-xs text-slate-500">
                Verify supplier, dates, items and tax rates. Edits made here will update the bill before posting.
              </p>
            </div>
            <button
              onClick={() => setStep("UPLOAD")}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Scan another bill
            </button>
          </div>

          {/* Supplier & Invoice Header */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Supplier Name</label>
              <input
                type="text"
                value={billData.supplierName || ""}
                onChange={(e) => setBillData({ ...billData, supplierName: e.target.value })}
                className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Supplier GSTIN</label>
              <input
                type="text"
                value={billData.supplierGstin || ""}
                onChange={(e) => setBillData({ ...billData, supplierGstin: e.target.value })}
                className="w-full text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Supplier Invoice No</label>
              <input
                type="text"
                value={billData.invoiceNo || ""}
                onChange={(e) => setBillData({ ...billData, invoiceNo: e.target.value })}
                className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Bill Date</label>
              <input
                type="date"
                value={billData.invoiceDate || ""}
                onChange={(e) => setBillData({ ...billData, invoiceDate: e.target.value })}
                className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 mt-1"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Extracted Line Items</h3>
              <button
                onClick={addEmptyLine}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100"
              >
                <Plus className="w-3 h-3" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3 w-20">Qty</th>
                    <th className="py-2.5 px-3 w-24">Rate (₹)</th>
                    <th className="py-2.5 px-3 w-20">GST %</th>
                    <th className="py-2.5 px-3 w-28">Amount (₹)</th>
                    <th className="py-2.5 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {billData.items.map((line: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={line.name}
                          onChange={(e) => handleLineChange(idx, "name", e.target.value)}
                          className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={line.qty}
                          onChange={(e) => handleLineChange(idx, "qty", parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={line.rate}
                          onChange={(e) => handleLineChange(idx, "rate", parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={line.gstRate}
                          onChange={(e) => handleLineChange(idx, "gstRate", parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2 py-1"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">
                        ₹{(line.amount || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => removeLine(idx)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end pt-2">
            <div className="w-64 space-y-1.5 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span>Sub Total:</span>
                <span className="font-mono font-bold">₹{billData.subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax Total (GST):</span>
                <span className="font-mono font-bold">₹{billData.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-700">₹{billData.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep("UPLOAD")}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              onClick={handleConfirmAndPostPurchase}
              disabled={isProcessing}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2"
            >
              {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Post Verified Purchase Invoice</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CONFIRMED */}
      {step === "CONFIRMED" && createdInvoice && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Purchase Invoice Created & Posted</h2>
            <p className="text-sm text-slate-500 mt-1">
              Supplier invoice <strong className="text-slate-800">{createdInvoice.invoiceNo}</strong> from{" "}
              <strong className="text-slate-800">{createdInvoice.supplierName}</strong> for ₹{createdInvoice.grandTotal} has been posted to accounting ledger and stock in hand.
            </p>
          </div>

          <div className="inline-flex gap-3 pt-3">
            <button
              onClick={() => {
                setStep("UPLOAD");
                setFile(null);
                setRawText("");
                setBillData(null);
                setCreatedInvoice(null);
              }}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200"
            >
              Scan Another Bill
            </button>
            <Link
              href={`/invoices/${createdInvoice.invoiceId}`}
              className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-xs hover:bg-emerald-700"
            >
              View Posted Invoice →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
