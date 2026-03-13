/**
 * BizPilot Mobile POS — Startup Performance Profiler
 *
 * Measures and logs the time each initialization phase takes during
 * app startup. This helps identify bottlenecks and track regressions.
 *
 * Why a custom profiler instead of React DevTools?
 * 1. DevTools only measures render time, not pre-render init (DB, auth)
 * 2. We need production-safe measurement (no devtools overhead)
 * 3. Need to measure across the full sequence: DB → Auth → Sync → UI
 *
 * Usage:
 *   StartupProfiler.markStart("db-init");
 *   await initDatabase();
 *   StartupProfiler.markEnd("db-init");
 *   ...
 *   StartupProfiler.report(); // logs a summary table
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhaseEntry {
  name: string;
  startMs: number;
  endMs: number | null;
  durationMs: number | null;
}

interface StartupReport {
  totalMs: number;
  phases: Array<{ name: string; durationMs: number }>;
}

// ---------------------------------------------------------------------------
// Profiler singleton
// ---------------------------------------------------------------------------

class StartupProfilerImpl {
  private phases: Map<string, PhaseEntry> = new Map();
  private appStartMs: number = Date.now();
  private reported: boolean = false;

  /**
   * Mark the beginning of a startup phase.
   */
  markStart(phaseName: string): void {
    this.phases.set(phaseName, {
      name: phaseName,
      startMs: Date.now(),
      endMs: null,
      durationMs: null,
    });
  }

  /**
   * Mark the end of a startup phase.
   */
  markEnd(phaseName: string): void {
    const phase = this.phases.get(phaseName);
    if (!phase) {
      console.warn(`[StartupProfiler] Unknown phase: ${phaseName}`);
      return;
    }
    phase.endMs = Date.now();
    phase.durationMs = phase.endMs - phase.startMs;
  }

  /**
   * Get the report data (for programmatic use / tests).
   */
  getReport(): StartupReport {
    const totalMs = Date.now() - this.appStartMs;
    const phases: Array<{ name: string; durationMs: number }> = [];

    for (const phase of this.phases.values()) {
      phases.push({
        name: phase.name,
        durationMs: phase.durationMs ?? Date.now() - phase.startMs,
      });
    }

    // Sort by start time (insertion order in Map)
    return { totalMs, phases };
  }

  /**
   * Log a summary of all startup phases.
   * Called once after the app is fully loaded.
   */
  report(): void {
    if (this.reported) return;
    this.reported = true;

    const { totalMs, phases } = this.getReport();

    console.log(`[StartupProfiler] App startup: ${totalMs}ms total`);
    for (const phase of phases) {
      const pct = totalMs > 0 ? ((phase.durationMs / totalMs) * 100).toFixed(1) : "0";
      console.log(`  ${phase.name}: ${phase.durationMs}ms (${pct}%)`);
    }
  }

  /**
   * Reset the profiler (for testing or hot reload).
   */
  reset(): void {
    this.phases.clear();
    this.appStartMs = Date.now();
    this.reported = false;
  }
}

/**
 * Global startup profiler singleton.
 * Safe for production use — no-ops are cheap (Map lookups).
 */
export const StartupProfiler = new StartupProfilerImpl();
