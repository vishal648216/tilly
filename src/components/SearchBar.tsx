"use client";

import { useState } from "react";

export default function SearchBar({
  placeholder = "Search...",
  paramName = "q",
  defaultValue = "",
}: {
  placeholder?: string;
  paramName?: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = new URL(window.location.href);
    if (value.trim()) {
      url.searchParams.set(paramName, value.trim());
    } else {
      url.searchParams.delete(paramName);
    }
    window.location.href = url.pathname + url.search;
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="search"
        className="input w-64 pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <svg
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </form>
  );
}
