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
  X,
} from "lucide-react";
import Link from "next/link";

function preprocessImageForOcr(file: File): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const scale = Math.max(1.5, Math.min(2.5, 2200 / Math.max(1, img.width)));
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.filter = "grayscale(100%) contrast(150%) brightness(105%)";
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png"));
            return;
          }
        } catch {
          // fallback
        }
        resolve("");
      };
      img.onerror = () => resolve("");
      img.src = URL.createObjectURL(file);
    } catch {
      resolve("");
    }
  });
}

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
        setStatusText("Preprocessing image for clarity...");
        const enhancedDataUrl = await preprocessImageForOcr(file);
        setStatusText("Scanning characters with OCR (0%)...");
        try {
          const Tesseract = (await import("tesseract.js")).default;
          const result = await Tesseract.recognize(enhancedDataUrl || file, "eng", {
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

  const [showAddColMenu, setShowAddColMenu] = useState(false);
  const [customColName, setCustomColName] = useState("");
  const [customColType, setCustomColType] = useState<"text" | "number">("text");

  // Dynamic columns resolution
  const activeColumns: Array<{ id: string; label: string; type: "text" | "number" | "select"; width?: string; required?: boolean }> =
    billData?.columns && billData.columns.length > 0
      ? billData.columns
      : [
          { id: "name", label: "Item Description", type: "text", required: true },
          { id: "qty", label: "Qty", type: "number", width: "w-20" },
          { id: "rate", label: "Rate (₹)", type: "number", width: "w-24" },
          { id: "gstRate", label: "GST %", type: "select", width: "w-20" },
          { id: "amount", label: "Amount (₹)", type: "number", width: "w-28", required: true },
        ];

  function handleAddColumn(col: { id: string; label: string; type: "text" | "number" | "select"; width?: string }) {
    if (!billData) return;
    const exists = activeColumns.some((c) => c.id === col.id);
    if (exists) {
      setShowAddColMenu(false);
      return;
    }
    const updatedCols = [...activeColumns, col];
    const updatedItems = billData.items.map((item: any) => ({
      ...item,
      [col.id]: item[col.id] ?? (col.type === "number" ? 0 : ""),
    }));
    setBillData({
      ...billData,
      columns: updatedCols,
      items: updatedItems,
    });
    setShowAddColMenu(false);
    setCustomColName("");
  }

  function handleRemoveColumn(colId: string) {
    if (!billData || colId === "name" || colId === "amount") return;
    const updatedCols = activeColumns.filter((c) => c.id !== colId);
    setBillData({
      ...billData,
      columns: updatedCols,
    });
  }

  function handleLineChange(index: number, field: string, value: any) {
    const lines = [...billData.items];
    lines[index] = { ...lines[index], [field]: value };

    // Intelligent recalculation
    const qty = Number(lines[index].qty || 0);
    const rate = Number(lines[index].rate || 0);
    const discount = Number(lines[index].discount || 0);
    const gstRate = Number(lines[index].gstRate !== undefined ? lines[index].gstRate : 18);

    if (field === "taxableAmount") {
      const taxable = Number(value || 0);
      if (lines[index].cgstAmount !== undefined || lines[index].sgstAmount !== undefined) {
        lines[index].cgstAmount = Math.round((taxable * (gstRate / 2) / 100) * 100) / 100;
        lines[index].sgstAmount = Math.round((taxable * (gstRate / 2) / 100) * 100) / 100;
      }
      lines[index].amount = Math.round((taxable + (lines[index].cgstAmount || 0) + (lines[index].sgstAmount || 0) + (lines[index].igstAmount || 0)) * 100) / 100;
    } else if (field === "qty" || field === "rate" || field === "discount") {
      const taxable = Math.max(0, qty * rate - discount);
      if (lines[index].taxableAmount !== undefined) {
        lines[index].taxableAmount = taxable;
      }
      if (lines[index].cgstAmount !== undefined || lines[index].sgstAmount !== undefined) {
        lines[index].cgstAmount = Math.round((taxable * (gstRate / 2) / 100) * 100) / 100;
        lines[index].sgstAmount = Math.round((taxable * (gstRate / 2) / 100) * 100) / 100;
      }
      const itemTax = (lines[index].cgstAmount || 0) + (lines[index].sgstAmount || 0) + (lines[index].igstAmount || 0);
      lines[index].amount = Math.round((taxable + (itemTax > 0 ? itemTax : (taxable * gstRate) / 100)) * 100) / 100;
    } else if (field === "gstRate") {
      const taxable = Number(lines[index].taxableAmount || Math.max(0, qty * rate - discount));
      if (lines[index].cgstAmount !== undefined || lines[index].sgstAmount !== undefined) {
        lines[index].cgstAmount = Math.round((taxable * (Number(value) / 2) / 100) * 100) / 100;
        lines[index].sgstAmount = Math.round((taxable * (Number(value) / 2) / 100) * 100) / 100;
      }
      const itemTax = (lines[index].cgstAmount || 0) + (lines[index].sgstAmount || 0) + (lines[index].igstAmount || 0);
      lines[index].amount = Math.round((taxable + (itemTax > 0 ? itemTax : (taxable * Number(value)) / 100)) * 100) / 100;
    } else if (field === "cgstAmount" || field === "sgstAmount" || field === "igstAmount") {
      const taxable = Number(lines[index].taxableAmount || Math.max(0, qty * rate - discount));
      lines[index].amount = Math.round((taxable + Number(lines[index].cgstAmount || 0) + Number(lines[index].sgstAmount || 0) + Number(lines[index].igstAmount || 0)) * 100) / 100;
    }

    // Totals roll-up
    const newSubTotal = lines.reduce((acc: number, it: any) => acc + (it.taxableAmount !== undefined ? Number(it.taxableAmount || 0) : (Number(it.qty || 0) * Number(it.rate || 0))), 0);
    const newCgst = lines.reduce((acc: number, it: any) => acc + Number(it.cgstAmount || 0), 0);
    const newSgst = lines.reduce((acc: number, it: any) => acc + Number(it.sgstAmount || 0), 0);
    const newIgst = lines.reduce((acc: number, it: any) => acc + Number(it.igstAmount || 0), 0);
    const totalTaxCalculated = (newCgst + newSgst + newIgst) > 0
      ? (newCgst + newSgst + newIgst)
      : lines.reduce((acc: number, it: any) => acc + ((Number(it.amount || 0) * Number(it.gstRate || 0)) / 100), 0);
    const newGrandTotal = Math.round(lines.reduce((acc: number, it: any) => acc + Number(it.amount || 0), 0) * 100) / 100;

    setBillData({
      ...billData,
      items: lines,
      subTotal: newSubTotal,
      cgstTotal: newCgst,
      sgstTotal: newSgst,
      igstTotal: newIgst,
      taxTotal: totalTaxCalculated,
      grandTotal: newGrandTotal,
    });
  }

  function addEmptyLine() {
    const newItem: any = { name: "", qty: 1, rate: 0, gstRate: 18, amount: 0 };
    for (const col of activeColumns) {
      if (newItem[col.id] === undefined) {
        newItem[col.id] = col.type === "number" ? 0 : "";
      }
    }
    setBillData({ ...billData, items: [...billData.items, newItem] });
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
    <div className="max-w-6xl mx-auto space-y-6">
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
              Upload PDF or image bill, or paste raw text below to trigger intelligent OCR parsing with dynamic columns.
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
                placeholder="Invoice#: 004&#10;Billed by: Foobar Labs&#10;GSTIN: 29ABCED1234F2Z5&#10;Billed to: Wox Studio&#10;1. Basic Web Development 02 10 9% 10,000.00 900 900 11,800.00&#10;Grand Total: 42,480"
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

      {/* STEP 2: REVIEW SCREEN WITH DYNAMIC COLUMNS & ROWS */}
      {step === "REVIEW" && billData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 inline-block mb-1">
                Staged for Review (Dynamic Columns Generated)
              </span>
              <h2 className="text-lg font-bold text-slate-900">Review & Correct Extracted Invoice Details</h2>
              <p className="text-xs text-slate-500">
                Columns and fields have been dynamically adapted to match your bill. Add or customize columns and verify values before posting.
              </p>
            </div>
            <button
              onClick={() => setStep("UPLOAD")}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Scan another bill
            </button>
          </div>

          {/* Supplier, Customer & Invoice Header Fields */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Supplier Name (Billed By)</label>
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
              <label className="text-[11px] font-semibold text-slate-500">Invoice Date</label>
              <input
                type="date"
                value={billData.invoiceDate || ""}
                onChange={(e) => setBillData({ ...billData, invoiceDate: e.target.value })}
                className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 mt-1"
              />
            </div>

            {/* Additional Detected Fields */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Due Date</label>
              <input
                type="date"
                value={billData.dueDate || ""}
                onChange={(e) => setBillData({ ...billData, dueDate: e.target.value })}
                className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Place of Supply</label>
              <input
                type="text"
                placeholder="e.g. Karnataka"
                value={billData.placeOfSupply || ""}
                onChange={(e) => setBillData({ ...billData, placeOfSupply: e.target.value })}
                className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Billed To (Customer)</label>
              <input
                type="text"
                placeholder="e.g. Wox Studio"
                value={billData.customerName || ""}
                onChange={(e) => setBillData({ ...billData, customerName: e.target.value })}
                className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Supplier Address</label>
              <input
                type="text"
                placeholder="Address"
                value={billData.supplierAddress || ""}
                onChange={(e) => setBillData({ ...billData, supplierAddress: e.target.value })}
                className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 mt-1"
              />
            </div>
          </div>

          {/* Line Items Table with Dynamic Columns */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">
                  Extracted Line Items ({billData.items.length} items, {activeColumns.length} columns)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Add Column Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowAddColMenu(!showAddColMenu)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-500" />
                    <span>Add Column</span>
                  </button>

                  {showAddColMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-30 space-y-2">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quick Presets</p>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <button
                          onClick={() => handleAddColumn({ id: "hsn", label: "HSN / SAC", type: "text", width: "w-20" })}
                          className="text-left px-2 py-1.5 hover:bg-slate-100 rounded text-slate-700"
                        >
                          + HSN / SAC
                        </button>
                        <button
                          onClick={() => handleAddColumn({ id: "taxableAmount", label: "Taxable Amt", type: "number", width: "w-28" })}
                          className="text-left px-2 py-1.5 hover:bg-slate-100 rounded text-slate-700"
                        >
                          + Taxable Amt
                        </button>
                        <button
                          onClick={() => handleAddColumn({ id: "rate", label: "Rate (₹)", type: "number", width: "w-24" })}
                          className="text-left px-2 py-1.5 hover:bg-slate-100 rounded text-slate-700"
                        >
                          + Rate (₹)
                        </button>
                        <button
                          onClick={() => handleAddColumn({ id: "discount", label: "Discount", type: "number", width: "w-20" })}
                          className="text-left px-2 py-1.5 hover:bg-slate-100 rounded text-slate-700"
                        >
                          + Discount
                        </button>
                        <button
                          onClick={() => handleAddColumn({ id: "cgstAmount", label: "CGST (₹)", type: "number", width: "w-24" })}
                          className="text-left px-2 py-1.5 hover:bg-slate-100 rounded text-slate-700"
                        >
                          + CGST (₹)
                        </button>
                        <button
                          onClick={() => handleAddColumn({ id: "sgstAmount", label: "SGST (₹)", type: "number", width: "w-24" })}
                          className="text-left px-2 py-1.5 hover:bg-slate-100 rounded text-slate-700"
                        >
                          + SGST (₹)
                        </button>
                        <button
                          onClick={() => handleAddColumn({ id: "unit", label: "Unit", type: "text", width: "w-16" })}
                          className="text-left px-2 py-1.5 hover:bg-slate-100 rounded text-slate-700"
                        >
                          + Unit
                        </button>
                        <button
                          onClick={() => handleAddColumn({ id: "batchNo", label: "Batch No", type: "text", width: "w-24" })}
                          className="text-left px-2 py-1.5 hover:bg-slate-100 rounded text-slate-700"
                        >
                          + Batch No
                        </button>
                      </div>

                      <div className="border-t border-slate-100 pt-2 space-y-1.5">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Custom Column</p>
                        <input
                          type="text"
                          placeholder="Column Name (e.g. Brand)"
                          value={customColName}
                          onChange={(e) => setCustomColName(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                        />
                        <div className="flex gap-2">
                          <select
                            value={customColType}
                            onChange={(e) => setCustomColType(e.target.value as any)}
                            className="text-xs border border-slate-200 rounded px-2 py-1 flex-1"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                          </select>
                          <button
                            onClick={() => {
                              if (!customColName.trim()) return;
                              const safeId = customColName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
                              handleAddColumn({ id: safeId, label: customColName.trim(), type: customColType });
                            }}
                            className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={addEmptyLine}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item (Row)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
                  <tr>
                    {activeColumns.map((col) => (
                      <th key={col.id} className={`py-2.5 px-3 ${col.width || ""}`}>
                        <div className="flex items-center justify-between gap-1 group">
                          <span>{col.label}</span>
                          {col.id !== "name" && col.id !== "amount" && (
                            <button
                              title={`Remove ${col.label} column`}
                              onClick={() => handleRemoveColumn(col.id)}
                              className="text-slate-400 hover:text-rose-600 opacity-60 group-hover:opacity-100 transition-opacity ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {billData.items.map((line: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      {activeColumns.map((col) => {
                        if (col.id === "gstRate") {
                          return (
                            <td key={col.id} className="py-2 px-3">
                              <select
                                value={line.gstRate !== undefined ? line.gstRate : 18}
                                onChange={(e) => handleLineChange(idx, "gstRate", parseFloat(e.target.value) || 0)}
                                className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2 py-1"
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={9}>9%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            </td>
                          );
                        }

                        if (col.id === "amount") {
                          return (
                            <td key={col.id} className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                              ₹{(Number(line.amount) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                          );
                        }

                        if (col.type === "number") {
                          return (
                            <td key={col.id} className="py-2 px-3">
                              <input
                                type="number"
                                value={line[col.id] !== undefined ? line[col.id] : ""}
                                onChange={(e) => handleLineChange(idx, col.id, parseFloat(e.target.value) || 0)}
                                className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2 py-1"
                              />
                            </td>
                          );
                        }

                        return (
                          <td key={col.id} className="py-2 px-3">
                            <input
                              type="text"
                              value={line[col.id] || ""}
                              onChange={(e) => handleLineChange(idx, col.id, e.target.value)}
                              className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2 py-1"
                            />
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => removeLine(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Delete row"
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

          {/* Dynamic Totals Summary Breakdown */}
          <div className="flex justify-end pt-2">
            <div className="w-80 space-y-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span>Sub Total:</span>
                <span className="font-mono font-bold text-slate-800">
                  ₹{(billData.subTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {Boolean(billData.discountTotal && billData.discountTotal > 0) && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount {billData.discountPercent ? `(${billData.discountPercent}%)` : ""}:</span>
                  <span className="font-mono font-bold">
                    -₹{(billData.discountTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {Boolean(billData.taxableAmount && billData.taxableAmount > 0) && (
                <div className="flex justify-between font-medium text-slate-700">
                  <span>Taxable Amount:</span>
                  <span className="font-mono">
                    ₹{(billData.taxableAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {Boolean(billData.cgstTotal && billData.cgstTotal > 0) && (
                <div className="flex justify-between">
                  <span>CGST:</span>
                  <span className="font-mono">
                    ₹{(billData.cgstTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {Boolean(billData.sgstTotal && billData.sgstTotal > 0) && (
                <div className="flex justify-between">
                  <span>SGST:</span>
                  <span className="font-mono">
                    ₹{(billData.sgstTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {Boolean(billData.igstTotal && billData.igstTotal > 0) && (
                <div className="flex justify-between">
                  <span>IGST:</span>
                  <span className="font-mono">
                    ₹{(billData.igstTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-xs font-semibold text-slate-700">
                <span>Total Tax:</span>
                <span className="font-mono">
                  ₹{(billData.taxTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-700 text-base">
                  ₹{(billData.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {Boolean(billData.earlyPayAmount && billData.earlyPayAmount > 0) && (
                <div className="flex justify-between pt-1 border-t border-dashed border-slate-200 text-[11px] text-indigo-700">
                  <span>EarlyPay Amount (Disc ₹{billData.earlyPayDiscount}):</span>
                  <span className="font-mono font-bold">
                    ₹{(billData.earlyPayAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
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
