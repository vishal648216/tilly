"use client";
import { useState } from "react";

type Preset = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "CURRENT_FY" | "PREVIOUS_FY" | "CUSTOM";

interface DateRangeFilterProps {
  defaultPreset?: Preset;
  onRangeChange: (preset: Preset, from?: string, to?: string) => void;
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: "TODAY", label: "Today" },
  { value: "THIS_WEEK", label: "This Week" },
  { value: "THIS_MONTH", label: "This Month" },
  { value: "CURRENT_FY", label: "Current FY" },
  { value: "PREVIOUS_FY", label: "Previous FY" },
  { value: "CUSTOM", label: "Custom Range" },
];

export default function DateRangeFilter({ defaultPreset = "CURRENT_FY", onRangeChange }: DateRangeFilterProps) {
  const [selected, setSelected] = useState<Preset>(defaultPreset);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const handlePresetChange = (preset: Preset) => {
    setSelected(preset);
    if (preset !== "CUSTOM") {
      onRangeChange(preset);
    }
  };

  const handleCustomApply = () => {
    if (from && to) {
      onRangeChange("CUSTOM", from, to);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-xs font-medium text-slate-500 uppercase">Period:</span>
      {PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => handlePresetChange(p.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            selected === p.value
              ? "bg-brand-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {p.label}
        </button>
      ))}
      {selected === "CUSTOM" && (
        <div className="flex items-center gap-2 mt-1 w-full sm:w-auto sm:mt-0">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <button
            onClick={handleCustomApply}
            disabled={!from || !to}
            className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
