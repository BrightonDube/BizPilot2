"use client";

/**
 * Console filter to suppress known hydration mismatch warnings in development.
 * These warnings are typically caused by browser extensions or timing differences
 * between server and client rendering.
 */

if (typeof window !== "undefined") {
  const originalError = console.error;
  const originalWarn = console.warn;

  const suppressedPatterns = [
    /Hydration failed because/i,
    /There was an error while hydrating/i,
    /Text content does not match/i,
    /did not match/i,
    /Hydration mismatch/i,
    /Extra attributes from the server/i,
  ];

  const shouldSuppress = (args: unknown[]): boolean => {
    const message = args.map((arg) => String(arg)).join(" ");
    return suppressedPatterns.some((pattern) => pattern.test(message));
  };

  console.error = (...args: unknown[]) => {
    if (!shouldSuppress(args)) {
      originalError.apply(console, args);
    }
  };

  console.warn = (...args: unknown[]) => {
    if (!shouldSuppress(args)) {
      originalWarn.apply(console, args);
    }
  };
}

export {};
