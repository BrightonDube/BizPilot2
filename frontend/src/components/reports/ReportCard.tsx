"use client";

/**
 * ReportCard — summary stat card for report dashboards.
 *
 * Usage:
 *   <ReportCard
 *     title="Total Sales"
 *     value="R 48,250.00"
 *     subtitle="Last 30 days"
 *     trend={{ value: 12.4, label: "vs previous period" }}
 *   />
 */

import React from "react";

interface Trend {
  value: number; // positive = up, negative = down
  label?: string;
}

interface ReportCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: Trend;
  icon?: React.ReactNode;
  className?: string;
}

export function ReportCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  className = "",
}: ReportCardProps) {
  const trendUp = trend && trend.value >= 0;
  const trendColor = trendUp ? "text-green-600" : "text-red-600";
  const trendArrow = trendUp ? "↑" : "↓";

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-2 ${className}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>

      <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>

      <div className="flex items-center gap-2 flex-wrap">
        {trend && (
          <span className={`text-sm font-medium ${trendColor}`}>
            {trendArrow} {Math.abs(trend.value).toFixed(1)}%
            {trend.label && (
              <span className="text-gray-400 font-normal ml-1">{trend.label}</span>
            )}
          </span>
        )}
        {subtitle && !trend && (
          <span className="text-sm text-gray-400">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
