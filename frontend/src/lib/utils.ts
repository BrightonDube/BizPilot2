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
