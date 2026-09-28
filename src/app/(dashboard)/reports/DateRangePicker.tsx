"use client";

import { useState } from "react";

export default function DateRangePicker({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);

  function applyFilter() {
    const url = new URL(window.location.href);
    url.searchParams.set("from", fromVal);
    url.searchParams.set("to", toVal);
    window.location.href = url.pathname + url.search;
  }

  return (
    <div className="flex items-end gap-2">
      <div>
        <label className="label text-xs">From</label>
        <input
          type="date"
          className="input w-auto"
          value={fromVal}
          onChange={(e) => setFromVal(e.target.value)}
        />
      </div>
      <div>
        <label className="label text-xs">To</label>
        <input
          type="date"
          className="input w-auto"
          value={toVal}
          onChange={(e) => setToVal(e.target.value)}
        />
      </div>
      <button onClick={applyFilter} className="btn-primary text-sm">
        Apply
      </button>
    </div>
  );
}
