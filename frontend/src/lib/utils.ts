import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatCurrency(amount: unknown, currency: string = 'ZAR'): string {
  const n = toNumber(amount, 0);
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

export function safeToFixed(value: unknown, decimals: number = 2): string {
  const n = toNumber(value, 0);
  return n.toFixed(decimals);
}

export function safePercentage(value: unknown, decimals: number = 1): string {
  const n = toNumber(value, 0);
  return `${n.toFixed(decimals)}%`;
}

export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  }).format(date);
}
