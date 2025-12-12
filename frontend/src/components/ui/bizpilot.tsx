/**
 * BizPilot custom components.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success";
}

export function GradientButton({ 
  children, 
  className, 
  variant = "primary",
  ...props 
}: GradientButtonProps) {
  const gradients = {
    primary: "from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700",
    secondary: "from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800",
    success: "from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all",
        "bg-gradient-to-r text-white px-4 py-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "shadow-lg hover:shadow-xl",
        gradients[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  description?: string;
}

export function StatCard({ 
  title, 
  value, 
  change, 
  changeType = "neutral",
  icon: Icon,
  description 
}: StatCardProps) {
  const changeColors = {
    positive: "text-green-400",
    negative: "text-red-400",
    neutral: "text-gray-400",
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-400">{title}</p>
        {Icon && (
          <div className="rounded-lg bg-gray-700 p-2">
            <Icon className="h-5 w-5 text-blue-400" />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-semibold text-white">{value}</p>
        {change && (
          <span className={cn("text-sm", changeColors[changeType])}>
            {change}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-sm text-gray-400">{description}</p>
      )}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        {description && (
          <p className="mt-1 text-gray-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="mb-4 rounded-full bg-gray-800 p-4">
          <Icon className="h-8 w-8 text-gray-400" />
        </div>
      )}
      <h3 className="text-lg font-medium text-white">{title}</h3>
      <p className="mt-1 max-w-sm text-gray-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ size = "md" }: LoadingSpinnerProps) {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("animate-spin rounded-full border-2 border-gray-600 border-t-blue-500", sizes[size])} />
  );
}

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
}

export function Badge({ variant = "default", children }: BadgeProps) {
  const variants = {
    default: "bg-gray-700 text-gray-300",
    success: "bg-green-500/10 text-green-400 border border-green-500/20",
    warning: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
    danger: "bg-red-500/10 text-red-400 border border-red-500/20",
    info: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  };

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variants[variant])}>
      {children}
    </span>
  );
}
