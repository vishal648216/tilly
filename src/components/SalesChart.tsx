"use client";

// Lightweight SVG bar chart - no external library needed (100% free)
type Bar = { label: string; value: number };

export default function SalesChart({ data }: { data: Bar[] }) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Abhi koi sales data nahi hai. Invoice banao to graph dikhega!
      </p>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartHeight = 160;

  return (
    <div>
      <div className="flex items-end justify-between gap-2" style={{ height: chartHeight + 30 }}>
        {data.map((d, i) => {
          const barHeight = (d.value / maxVal) * chartHeight;
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-xs font-medium text-slate-600">
                {d.value >= 1000
                  ? `₹${(d.value / 1000).toFixed(0)}k`
                  : d.value > 0
                  ? `₹${d.value.toFixed(0)}`
                  : ""}
              </span>
              <div
                className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400 transition-all hover:from-brand-700 hover:to-brand-500"
                style={{ height: `${barHeight}px`, minHeight: d.value > 0 ? "4px" : "0" }}
                title={`₹${d.value.toFixed(2)}`}
              />
              <span className="mt-1 text-xs text-slate-400">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
