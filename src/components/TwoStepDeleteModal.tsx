"use client";

import { useState } from "react";
import { AlertTriangle, ShieldAlert, Trash2, X, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

interface TwoStepDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;
  itemIdentifier: string; // e.g. "INV-2026-0001" or "CN-2026-0001"
  itemTypeLabel?: string; // e.g. "Invoice", "Purchase Bill", "Credit Note"
  itemDetails?: { label: string; value: string }[];
}

export default function TwoStepDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Bill",
  itemIdentifier,
  itemTypeLabel = "Bill",
  itemDetails = [],
}: TwoStepDeleteModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  function handleClose() {
    if (loading) return;
    setStep(1);
    setError("");
    onClose();
  }

  async function handleFinalDelete() {
    setLoading(true);
    setError("");
    try {
      await onConfirm();
      setStep(1);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                step === 1 ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-rose-100 text-rose-800 border border-rose-200"
              }`}
            >
              Step {step} of 2 Confirmation
            </span>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            /* ================= STEP 1 ================= */
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shrink-0">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {title} — {itemIdentifier}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    First verification step before deleting {itemTypeLabel.toLowerCase()}
                  </p>
                </div>
              </div>

              {/* Summary Details */}
              {itemDetails.length > 0 && (
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs space-y-1.5">
                  {itemDetails.map((d, i) => (
                    <div key={i} className="flex justify-between text-slate-600">
                      <span className="text-slate-400 font-medium">{d.label}:</span>
                      <span className="font-bold text-slate-800">{d.value}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 leading-relaxed">
                <p className="font-semibold text-amber-800">
                  Are you sure you want to delete this {itemTypeLabel.toLowerCase()}?
                </p>
                <p className="mt-1 text-[11px] text-amber-700">
                  All associated inventory movements, ledger vouchers, and payment allocations for this document will be reversed or removed.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow-sm transition-all"
                >
                  <span>Continue to Step 2</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* ================= STEP 2 ================= */
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 shrink-0 animate-pulse">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-950">
                    Final Confirmation — Permanent Action
                  </h3>
                  <p className="text-xs text-rose-600 font-medium mt-0.5">
                    This action is permanent and cannot be undone!
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 space-y-2">
                <p className="font-bold text-rose-950 text-sm">
                  Confirm permanent deletion of: <span className="font-mono underline">{itemIdentifier}</span>?
                </p>
                <p className="text-[11px] leading-relaxed text-rose-800">
                  This is your second and final confirmation. Once confirmed, this {itemTypeLabel.toLowerCase()} will be permanently removed from the system and cannot be restored.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Go Back</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleClose}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleFinalDelete}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 shadow-md shadow-red-600/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Yes, Permanently Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
