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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
  icon?: React.ReactNode;
  description?: string;
  trend?: { value: number; isPositive: boolean };
  badge?: React.ReactNode;
}

export function StatCard({ 
  title, 
  value, 
  change, 
  changeType = "neutral",
  icon,
  description,
  trend,
  badge
}: StatCardProps) {
  const changeColors = {
    positive: "text-green-400",
    negative: "text-red-400",
    neutral: "text-muted-foreground",
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 text-card-foreground p-6 transition-all duration-200 will-change-transform hover:-translate-y-1 hover:scale-[1.01] hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && (
          <div className="rounded-lg bg-muted p-2 text-primary">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-semibold text-foreground">{value}</p>
        {badge}
        {change && (
          <span className={cn("text-sm", changeColors[changeType])}>
            {change}
          </span>
        )}
        {trend && (
          <span className={cn("text-sm", trend.isPositive ? "text-green-400" : "text-red-400")}>
            {trend.isPositive ? "+" : "-"}{trend.value}%
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 rounded-full bg-muted p-4">
          {typeof icon === 'function' ? (
            // It's a component (LucideIcon)
            React.createElement(icon as LucideIcon, { className: "h-8 w-8 text-muted-foreground" })
          ) : (
            // It's an element or other node
            icon
          )}
        </div>
      )}
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-muted-foreground">{description}</p>
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
    <div className={cn("animate-spin rounded-full border-2 border-border border-t-primary", sizes[size])} />
  );
}

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "secondary";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  const variants = {
    default: "bg-muted text-muted-foreground",
    secondary: "bg-muted text-muted-foreground",
    success: "bg-green-500/10 text-green-400 border border-green-500/20",
    warning: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
    danger: "bg-red-500/10 text-red-400 border border-red-500/20",
    info: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  };

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
