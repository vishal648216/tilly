"use client";

import { useMemo } from "react";
import { encodeCode128B } from "@/lib/barcodeGenerator";

export default function BarcodeSvg({
  value,
  height = 42,
  barWidth = 1.6,
  showText = true,
  className = "",
}: {
  value: string;
  height?: number;
  barWidth?: number;
  showText?: boolean;
  className?: string;
}) {
  const bits = useMemo(() => {
    return encodeCode128B(value || "00000000");
  }, [value]);

  const svgWidth = bits.length * barWidth;

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg
        width={svgWidth}
        height={height}
        viewBox={`0 0 ${svgWidth} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        className="shape-rendering-crispEdges"
      >
        <rect x="0" y="0" width={svgWidth} height={height} fill="#ffffff" />
        {bits.map((isBar, idx) =>
          isBar ? (
            <rect
              key={idx}
              x={idx * barWidth}
              y={0}
              width={barWidth}
              height={height}
              fill="#000000"
            />
          ) : null
        )}
      </svg>
      {showText && (
        <span className="font-mono text-[10px] tracking-widest text-slate-900 font-bold mt-0.5">
          {value}
        </span>
      )}
    </div>
  );
}
