"use client";

/**
 * ReportTable — sortable, paginated data table for report pages.
 *
 * Usage:
 *   <ReportTable
 *     columns={[{ key: "date", label: "Date", sortable: true }, ...]}
 *     data={rows}
 *     onSort={(key, dir) => setSortState(...)}
 *     sortKey="date"
 *     sortDir="desc"
 *   />
 */

import React from "react";

export type SortDirection = "asc" | "desc";

export interface ReportColumn<T = Record<string, unknown>> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface ReportTableProps<T = Record<string, unknown>> {
  columns: ReportColumn<T>[];
  data: T[];
  sortKey?: string;
  sortDir?: SortDirection;
  onSort?: (key: string, dir: SortDirection) => void;
  emptyMessage?: string;
  className?: string;
}

export function ReportTable<T = Record<string, unknown>>({
  columns,
  data,
  sortKey,
  sortDir = "asc",
  onSort,
  emptyMessage = "No data available.",
  className = "",
}: ReportTableProps<T>) {
  function handleSort(col: ReportColumn<T>) {
    if (!col.sortable || !onSort) return;
    const key = String(col.key);
    const nextDir: SortDirection =
      sortKey === key && sortDir === "asc" ? "desc" : "asc";
    onSort(key, nextDir);
  }

  function SortIcon({ col }: { col: ReportColumn<T> }) {
    if (!col.sortable) return null;
    const active = sortKey === String(col.key);
    return (
      <span className={`ml-1 text-xs ${active ? "text-blue-600" : "text-gray-300"}`}>
        {active && sortDir === "desc" ? "↓" : "↑"}
      </span>
    );
  }

  const alignClass = (align?: "left" | "right" | "center") => {
    if (align === "right") return "text-right";
    if (align === "center") return "text-center";
    return "text-left";
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                onClick={() => handleSort(col)}
                className={`px-4 py-3 font-medium text-gray-600 whitespace-nowrap ${alignClass(col.align)} ${
                  col.sortable ? "cursor-pointer select-none hover:text-gray-900" : ""
                }`}
              >
                {col.label}
                <SortIcon col={col} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
                {columns.map((col) => {
                  const rawValue = (row as Record<string, unknown>)[String(col.key)];
                  return (
                    <td
                      key={String(col.key)}
                      className={`px-4 py-3 text-gray-700 ${alignClass(col.align)}`}
                    >
                      {col.render ? col.render(rawValue, row) : String(rawValue ?? "—")}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
