"use client";

import { useState, useEffect } from "react";
import {
  Factory,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  RefreshCw,
  Box,
  FileSpreadsheet,
} from "lucide-react";

export default function ManufacturingPage() {
  const [boms, setBoms] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"ORDERS" | "BOMS">("ORDERS");
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateBomModal, setShowCreateBomModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [executingOrder, setExecutingOrder] = useState<any | null>(null);

  // New BOM Form State
  const [newBomName, setNewBomName] = useState("");
  const [newBomFinishedItem, setNewBomFinishedItem] = useState("");
  const [newBomOutputQty, setNewBomOutputQty] = useState(1);
  const [newBomLaborCost, setNewBomLaborCost] = useState(0);
  const [newBomRawMaterials, setNewBomRawMaterials] = useState<Array<{ itemId: string; quantity: number }>>([
    { itemId: "", quantity: 1 },
  ]);

  // Production Execution State
  const [producedQty, setProducedQty] = useState(1);
  const [wastageQty, setWastageQty] = useState(0);
  const [wastageReason, setWastageReason] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [banner, setBanner] = useState<{ type: "SUCCESS" | "ERROR"; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      const [bomRes, orderRes, itemRes] = await Promise.all([
        fetch("/api/manufacturing/bom"),
        fetch("/api/manufacturing/orders"),
        fetch("/api/items"),
      ]);

      const bData = await bomRes.json();
      const oData = await orderRes.json();
      const iData = await itemRes.json();

      if (bomRes.ok) setBoms(bData.boms || []);
      if (orderRes.ok) setOrders(oData.orders || []);
      if (itemRes.ok) setItems(iData.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateBom() {
    try {
      const res = await fetch("/api/manufacturing/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBomName,
          finishedItemId: newBomFinishedItem,
          outputQty: newBomOutputQty,
          laborCost: newBomLaborCost,
          rawMaterials: newBomRawMaterials.filter((rm) => rm.itemId && rm.quantity > 0),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBanner({ type: "SUCCESS", message: `Bill of Materials '${data.bom.name}' created.` });
      setShowCreateBomModal(false);
      fetchData();
    } catch (err: any) {
      setBanner({ type: "ERROR", message: err.message });
    }
  }

  async function handleExecuteOrder() {
    if (!executingOrder) return;
    setIsExecuting(true);
    setBanner(null);

    try {
      const res = await fetch(`/api/manufacturing/orders/${executingOrder.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producedQty,
          wastageQty,
          wastageReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBanner({
        type: "SUCCESS",
        message: `Order ${data.orderNo} completed! Capitalized ${data.producedQty} x ${data.finishedItemName} (Unit Cost: ₹${data.unitCost}, Journal Voucher: ${data.voucherNo}).`,
      });
      setExecutingOrder(null);
      fetchData();
    } catch (err: any) {
      setBanner({ type: "ERROR", message: err.message });
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Factory className="w-6 h-6 text-emerald-600" />
            Manufacturing & Production
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Bill of Materials (BOM), atomic raw material consumption, scrap tracking, and double-entry finished goods capitalization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateBomModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New BOM</span>
          </button>

          <button
            onClick={() => setShowCreateOrderModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Production Run</span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            banner.type === "SUCCESS"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {banner.type === "SUCCESS" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{banner.message}</span>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("ORDERS")}
          className={`pb-2.5 px-3 border-b-2 transition-colors ${
            activeTab === "ORDERS"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Production Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab("BOMS")}
          className={`pb-2.5 px-3 border-b-2 transition-colors ${
            activeTab === "BOMS"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Bills of Materials (Recipes) ({boms.length})
        </button>
      </div>

      {/* TAB 1: PRODUCTION ORDERS */}
      {activeTab === "ORDERS" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Order No</th>
                  <th className="py-2.5 px-4">Finished Item</th>
                  <th className="py-2.5 px-4">BOM Reference</th>
                  <th className="py-2.5 px-4">Planned Qty</th>
                  <th className="py-2.5 px-4">Produced Qty</th>
                  <th className="py-2.5 px-4">Total Cost</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      No production orders found. Create a BOM and start a production run.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{o.orderNo}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {o.finishedItem?.name}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{o.bom?.name || "-"}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-700">{o.plannedQty}</td>
                      <td className="py-2.5 px-4 font-bold text-emerald-700">
                        {o.status === "COMPLETED" ? o.producedQty : "-"}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-900">
                        {o.totalCost > 0 ? `₹${o.totalCost.toFixed(2)}` : "-"}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            o.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : "bg-amber-100 text-amber-800 border-amber-200"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {o.status !== "COMPLETED" && (
                          <button
                            onClick={() => {
                              setExecutingOrder(o);
                              setProducedQty(o.plannedQty);
                              setWastageQty(0);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs"
                          >
                            <Play className="w-3 h-3" />
                            <span>Execute Run</span>
                          </button>
                        )}
                        {o.voucher && (
                          <span className="font-mono text-[10px] text-slate-500">
                            JV: {o.voucher.voucherNo}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BILLS OF MATERIALS */}
      {activeTab === "BOMS" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {boms.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{b.name}</h3>
                  <p className="text-xs text-slate-500">Output: {b.outputQty} x {b.finishedItem?.name}</p>
                </div>
                <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                  {b.code || "BOM"}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-600">Raw Materials Required:</p>
                <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
                  {b.items.map((rm: any) => (
                    <li key={rm.id} className="p-2 flex justify-between items-center text-[11px]">
                      <span className="font-medium text-slate-800">{rm.item.name}</span>
                      <span className="font-mono text-slate-600 font-bold">
                        {rm.quantity} {rm.item.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {b.laborCost > 0 && (
                <div className="text-[11px] text-slate-500 flex justify-between pt-1">
                  <span>Labor Absorption:</span>
                  <span className="font-mono font-bold text-slate-700">₹{b.laborCost}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* EXECUTE RUN MODAL */}
      {executingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Execute Production Run: {executingOrder.orderNo}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Consumes raw materials and capitalizes finished goods with double-entry voucher.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Produced Quantity</label>
                <input
                  type="number"
                  value={producedQty}
                  onChange={(e) => setProducedQty(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Wastage / Scrap Quantity (Optional)</label>
                <input
                  type="number"
                  value={wastageQty}
                  onChange={(e) => setWastageQty(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Wastage Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Trimming scrap and startup testing"
                  value={wastageReason}
                  onChange={(e) => setWastageReason(e.target.value)}
                  className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setExecutingOrder(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteOrder}
                disabled={isExecuting || producedQty <= 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2"
              >
                {isExecuting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Execute & Capitalize</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE BOM MODAL */}
      {showCreateBomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create Bill of Materials (BOM)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Specify output finished item and consumed raw materials.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Recipe / BOM Name</label>
                <input
                  type="text"
                  placeholder="e.g. Standard Wooden Chair v1"
                  value={newBomName}
                  onChange={(e) => setNewBomName(e.target.value)}
                  className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Finished Product</label>
                <select
                  value={newBomFinishedItem}
                  onChange={(e) => setNewBomFinishedItem(e.target.value)}
                  className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 mt-1"
                >
                  <option value="">-- Select Output Item --</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.sku || it.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Batch Output Qty</label>
                  <input
                    type="number"
                    value={newBomOutputQty}
                    onChange={(e) => setNewBomOutputQty(parseFloat(e.target.value) || 1)}
                    className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Labor Absorption (₹)</label>
                  <input
                    type="number"
                    value={newBomLaborCost}
                    onChange={(e) => setNewBomLaborCost(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 mt-1"
                  />
                </div>
              </div>

              {/* Raw Materials Rows */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Raw Materials</span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewBomRawMaterials([...newBomRawMaterials, { itemId: "", quantity: 1 }])
                    }
                    className="text-xs text-emerald-700 font-semibold"
                  >
                    + Add Material
                  </button>
                </div>

                {newBomRawMaterials.map((rm, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={rm.itemId}
                      onChange={(e) => {
                        const copy = [...newBomRawMaterials];
                        copy[idx].itemId = e.target.value;
                        setNewBomRawMaterials(copy);
                      }}
                      className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5"
                    >
                      <option value="">-- Select Material --</option>
                      {items
                        .filter((it) => it.id !== newBomFinishedItem)
                        .map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Qty"
                      value={rm.quantity}
                      onChange={(e) => {
                        const copy = [...newBomRawMaterials];
                        copy[idx].quantity = parseFloat(e.target.value) || 0;
                        setNewBomRawMaterials(copy);
                      }}
                      className="w-20 text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 font-bold"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowCreateBomModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBom}
                disabled={!newBomName || !newBomFinishedItem}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Save BOM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
