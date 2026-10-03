"use client";

import { useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  RefreshCw,
  HelpCircle,
  FileText,
} from "lucide-react";

export default function ImportWizardPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [entityType, setEntityType] = useState<string>("PRODUCTS");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [validation, setValidation] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const entityOptions = [
    { id: "PRODUCTS", label: "Products / Items", desc: "Catalog items, pricing, tax rates & opening stock" },
    { id: "CUSTOMERS", label: "Customers", desc: "Customer profiles, GSTIN, phone & opening balances" },
    { id: "SUPPLIERS", label: "Suppliers / Vendors", desc: "Vendor details, GSTIN, payment terms & payables" },
    { id: "OPENING_STOCK", label: "Opening Stock", desc: "Location-wise inventory quantities & valuations" },
    { id: "OPENING_BALANCES", label: "Opening Balances", desc: "Ledger account and party debit/credit opening balances" },
  ];

  async function handleFileUpload(selectedFile: File) {
    setFile(selectedFile);
    setIsProcessing(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("entityType", entityType);

    try {
      const res = await fetch("/api/import/validate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process import file.");
      }

      setRawHeaders(data.headers || []);
      setColumnMapping(data.columnMapping || {});
      setValidation(data.validation);
      setParsedRows(data.validation?.previewRows || []);
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function revalidateMapping() {
    if (!file) return;
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityType", entityType);
    formData.append("mapping", JSON.stringify(columnMapping));

    try {
      const res = await fetch("/api/import/validate", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setValidation(data.validation);
      setStep(3);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function executeFinalImport() {
    if (!file || !validation) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Re-read or pass validated rows
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("mapping", JSON.stringify(columnMapping));

      // Fetch all parsed rows for execution
      const valRes = await fetch("/api/import/validate", { method: "POST", body: formData });
      const valData = await valRes.json();

      const execRes = await fetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          fileName: file.name,
          mapping: columnMapping,
          rows: valData.validation.previewRows, // or rows
          requireAllValid: false,
        }),
      });

      const execData = await execRes.json();
      if (!execRes.ok) throw new Error(execData.error);

      setImportResult(execData.result);
      setStep(4);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function downloadErrorReport() {
    if (!validation?.errors) return;
    try {
      const res = await fetch("/api/import/error-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validation.previewRows || [],
          errors: validation.errors,
        }),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `import_errors_${entityType.toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert("Failed to download error report: " + err.message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            Data Import Wizard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Bulk import catalog, contacts, opening inventory, and balances with strict validation.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <span className={step >= 1 ? "text-emerald-700 font-bold" : ""}>1. Upload</span>
          <span>→</span>
          <span className={step >= 2 ? "text-emerald-700 font-bold" : ""}>2. Map Columns</span>
          <span>→</span>
          <span className={step >= 3 ? "text-emerald-700 font-bold" : ""}>3. Validate</span>
          <span>→</span>
          <span className={step >= 4 ? "text-emerald-700 font-bold" : ""}>4. Result</span>
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

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h2 className="text-base font-semibold text-slate-900 mb-3">1. Select Entity to Import</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {entityOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setEntityType(opt.id)}
                  className={`p-4 rounded-xl text-left border transition-all ${
                    entityType === opt.id
                      ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-semibold text-slate-900 text-sm">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Upload Spreadsheet (CSV or XLSX)</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Supports .csv, .xlsx, and .xls files. Invalid rows will be flagged with suggested corrections.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-xs cursor-pointer transition-colors text-sm">
                <span>{isProcessing ? "Reading spreadsheet..." : "Choose File to Upload"}</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                  disabled={isProcessing}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: MAP COLUMNS */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">2. Map Spreadsheet Columns</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                We auto-matched columns based on aliases. Adjust mappings if needed.
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-slate-600 hover:text-slate-900 underline"
            >
              Choose different file
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(columnMapping).map((targetField) => (
              <div key={targetField} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{targetField}</span>
                  <p className="text-[11px] text-slate-400">Target Field</p>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={columnMapping[targetField] || ""}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, [targetField]: e.target.value })
                    }
                    className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
                  >
                    <option value="">-- Ignore --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={revalidateMapping}
              disabled={isProcessing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2"
            >
              {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Validate & Review Errors →</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: VALIDATION & ERROR REPORT */}
      {step === 3 && validation && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-xs font-medium text-slate-500 uppercase">Total Rows Scanned</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{validation.totalRows}</p>
            </div>
            <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200 shadow-xs">
              <p className="text-xs font-medium text-emerald-700 uppercase">Valid Rows Ready</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{validation.validRowsCount}</p>
            </div>
            <div className={`p-5 rounded-2xl border shadow-xs ${validation.invalidRowsCount > 0 ? "bg-rose-50/50 border-rose-200" : "bg-slate-50 border-slate-200"}`}>
              <p className="text-xs font-medium text-rose-700 uppercase">Invalid Rows Flagged</p>
              <p className="text-2xl font-bold text-rose-700 mt-1">{validation.invalidRowsCount}</p>
            </div>
          </div>

          {validation.errors.length > 0 && (
            <div className="bg-white rounded-2xl border border-rose-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-900 font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Import Error Report ({validation.errors.length} issue(s) detected)</span>
                </div>
                <button
                  onClick={downloadErrorReport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-300 text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-50 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Error CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">Field</th>
                      <th className="py-2.5 px-3">Input Value</th>
                      <th className="py-2.5 px-3">Validation Failure</th>
                      <th className="py-2.5 px-3">Suggested Correction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validation.errors.map((err: any, idx: number) => (
                      <tr key={idx} className="hover:bg-rose-50/30">
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">#{err.row}</td>
                        <td className="py-2 px-3 font-mono text-emerald-800 font-semibold">{err.field}</td>
                        <td className="py-2 px-3 text-slate-600">{String(err.value || "(empty)")}</td>
                        <td className="py-2 px-3 text-rose-700 font-medium">{err.error}</td>
                        <td className="py-2 px-3 text-slate-500 italic">{err.suggestedCorrection}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Back to Mapping
            </button>

            <button
              onClick={executeFinalImport}
              disabled={isProcessing || validation.validRowsCount === 0}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2"
            >
              {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>
                Confirm & Import {validation.validRowsCount} Valid Row(s) →
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: RESULT */}
      {step === 4 && importResult && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Import Completed Successfully</h2>
            <p className="text-sm text-slate-500 mt-1">
              Successfully imported {importResult.importedCount} record(s) into company ledger and catalog.
            </p>
          </div>

          <div className="inline-flex gap-3 pt-3">
            <button
              onClick={() => {
                setStep(1);
                setFile(null);
                setValidation(null);
                setImportResult(null);
              }}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs hover:bg-slate-800"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
