"use client";

export default function DateSelector({ defaultValue }: { defaultValue: string }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        defaultValue={defaultValue}
        className="input w-auto"
        onChange={(e) => {
          window.location.search = `?date=${e.target.value}`;
        }}
      />
    </div>
  );
}
