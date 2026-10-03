"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Users,
  Package,
  Receipt,
  ShoppingCart,
  Wallet,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface SearchItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  badge?: string;
  url: string;
}

export default function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, SearchItem[]>>({});
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl + K / Cmd + K listener & custom trigger
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    function handleOpenEvent() {
      setIsOpen(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleOpenEvent);
    };
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery("");
      setResults({});
      setTotalResults(0);
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim()) {
      setResults({});
      setTotalResults(0);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.ok) {
          setResults(data.results || {});
          setTotalResults(data.totalResults || 0);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Flattened items for keyboard arrow navigation
  const flatItems: SearchItem[] = Object.values(results).flat();

  function handleSelect(url: string) {
    setIsOpen(false);
    router.push(url);
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < flatItems.length ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && flatItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatItems[selectedIndex].url);
    }
  }

  const categoryIcons: Record<string, any> = {
    CUSTOMERS: Users,
    SUPPLIERS: Users,
    PRODUCTS: Package,
    INVOICES: Receipt,
    PURCHASES: ShoppingCart,
    PAYMENTS: Wallet,
    EXPENSES: Wallet,
    VOUCHERS: FileSpreadsheet,
  };

  const categoryTitles: Record<string, string> = {
    CUSTOMERS: "Customers & Clients",
    SUPPLIERS: "Suppliers & Vendors",
    PRODUCTS: "Products & Stock Items",
    INVOICES: "Sales Invoices",
    PURCHASES: "Purchase Bills",
    PAYMENTS: "Receipts & Payments",
    EXPENSES: "Expenses",
    VOUCHERS: "Journal & Ledger Vouchers",
  };

  return (
    <>
      {/* Quick Search Button in Top Navbar */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-slate-100/80 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 transition-colors border border-slate-200/60"
        title="Search (Ctrl + K)"
      >
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <span className="hidden sm:inline">Search anything...</span>
        <kbd className="hidden lg:inline-flex items-center rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200 shadow-2xs">
          Ctrl K
        </kbd>
      </button>

      {/* Modal Backdrop & Palette */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <Search className="h-5 w-5 text-emerald-600 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search customers, products (name/SKU/barcode), invoices, bills..."
                className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-hidden font-medium"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <kbd
                onClick={() => setIsOpen(false)}
                className="cursor-pointer rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-200 hover:text-slate-600 shadow-2xs"
              >
                ESC
              </kbd>
            </div>

            {/* Results Container */}
            <div className="overflow-y-auto p-3 space-y-4 divide-y divide-slate-100/80">
              {loading && (
                <div className="py-8 text-center text-xs font-semibold text-slate-400">
                  Searching live database...
                </div>
              )}

              {!loading && query && totalResults === 0 && (
                <div className="py-12 text-center">
                  <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No matching records found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Try searching by customer name, phone, GSTIN, invoice number, or product SKU.
                  </p>
                </div>
              )}

              {!loading && !query && (
                <div className="p-4 text-center">
                  <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-50 text-emerald-600 mb-2">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">Quick Global Search</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Type to search across Customers, Suppliers, Products, Invoices, Purchases, Payments, Expenses, and Accounting Vouchers.
                  </p>
                </div>
              )}

              {!loading &&
                Object.entries(results).map(([catKey, items]) => {
                  const Icon = categoryIcons[catKey] || Search;
                  const catTitle = categoryTitles[catKey] || catKey;

                  return (
                    <div key={catKey} className="pt-3 first:pt-0">
                      <div className="flex items-center gap-1.5 px-2 mb-1.5">
                        <Icon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {catTitle} ({items.length})
                        </span>
                      </div>

                      <div className="space-y-1">
                        {items.map((item) => {
                          const itemGlobalIndex = flatItems.findIndex((f) => f.id === item.id);
                          const isHighlighted = itemGlobalIndex === selectedIndex;

                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelect(item.url)}
                              onMouseEnter={() => setSelectedIndex(itemGlobalIndex)}
                              className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                                isHighlighted
                                  ? "bg-emerald-50 text-emerald-950 border border-emerald-200"
                                  : "hover:bg-slate-50 text-slate-800 border border-transparent"
                              }`}
                            >
                              <div className="min-w-0 pr-3">
                                <p className="text-xs font-bold truncate">{item.title}</p>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {item.subtitle}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {item.badge && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                    {item.badge}
                                  </span>
                                )}
                                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Footer Navigation Hints */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
              <span>Use ↑ ↓ to navigate, Enter to select</span>
              <span>{totalResults} results found</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
