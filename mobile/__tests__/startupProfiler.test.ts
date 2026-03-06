/**
 * Tests for StartupProfiler utility (Task 14.5).
 *
 * Validates:
 * - Phase marking (start/end)
 * - Duration calculation
 * - Report generation
 * - Reset functionality
 */

import { StartupProfiler } from "@/utils/StartupProfiler";

beforeEach(() => {
  StartupProfiler.reset();
});

describe("StartupProfiler", () => {
  it("records a phase with start and end", () => {
    StartupProfiler.markStart("test-phase");
    StartupProfiler.markEnd("test-phase");

    const report = StartupProfiler.getReport();
    expect(report.phases.length).toBe(1);
    expect(report.phases[0].name).toBe("test-phase");
    expect(report.phases[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records multiple phases", () => {
    StartupProfiler.markStart("phase-a");
    StartupProfiler.markEnd("phase-a");
    StartupProfiler.markStart("phase-b");
    StartupProfiler.markEnd("phase-b");

    const report = StartupProfiler.getReport();
    expect(report.phases.length).toBe(2);
    expect(report.phases[0].name).toBe("phase-a");
    expect(report.phases[1].name).toBe("phase-b");
  });

  it("reports total time since app start", () => {
    const report = StartupProfiler.getReport();
    expect(report.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("handles markEnd for unknown phase gracefully", () => {
    // Should not throw
    StartupProfiler.markEnd("nonexistent");
    const report = StartupProfiler.getReport();
    expect(report.phases.length).toBe(0);
  });

  it("reset clears all phases", () => {
    StartupProfiler.markStart("phase-a");
    StartupProfiler.markEnd("phase-a");
    StartupProfiler.reset();

    const report = StartupProfiler.getReport();
    expect(report.phases.length).toBe(0);
  });

  it("report() does not throw", () => {
    StartupProfiler.markStart("phase-a");
    StartupProfiler.markEnd("phase-a");

    // Should not throw
    expect(() => StartupProfiler.report()).not.toThrow();
  });

  it("report() is idempotent (only logs once)", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    StartupProfiler.markStart("phase-a");
    StartupProfiler.markEnd("phase-a");
    StartupProfiler.report();
    const callCount1 = consoleSpy.mock.calls.length;

    StartupProfiler.report(); // second call should be no-op
    const callCount2 = consoleSpy.mock.calls.length;

    expect(callCount2).toBe(callCount1);
    consoleSpy.mockRestore();
  });

  it("handles phase that was started but not ended", () => {
    StartupProfiler.markStart("incomplete");

    const report = StartupProfiler.getReport();
    expect(report.phases.length).toBe(1);
    // Duration should be computed as Date.now() - startMs
    expect(report.phases[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});
