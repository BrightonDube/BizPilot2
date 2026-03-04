/**
 * Tests for useAppState hook (task 14.4)
 *
 * Verifies:
 * 1. Initial state reflects AppState.currentState
 * 2. isActive toggles correctly on state changes
 * 3. isBackground toggles correctly
 * 4. lastForegroundAt is set when transitioning to active
 * 5. lastBackgroundAt is set when transitioning to background
 * 6. onForeground callback fires on active transition
 * 7. onBackground callback fires on background transition
 * 8. Subscription is cleaned up on unmount
 */

import { renderHook, act } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useAppState } from "@/hooks/useAppState";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// We need to control AppState.currentState and the event listener
jest.mock("react-native", () => {
  const listeners: Array<(state: string) => void> = [];
  const mockAppState = {
    currentState: "active" as string,
    addEventListener: jest.fn((event: string, listener: (state: string) => void) => {
      listeners.push(listener);
      return {
        remove: jest.fn(() => {
          const idx = listeners.indexOf(listener);
          if (idx !== -1) listeners.splice(idx, 1);
        }),
      };
    }),
    // Helper for tests to fire events
    __simulateChange: (nextState: string) => {
      mockAppState.currentState = nextState;
      listeners.forEach((l) => l(nextState));
    },
    __reset: () => {
      listeners.length = 0;
      mockAppState.currentState = "active";
    },
  };

  return {
    AppState: mockAppState,
    StyleSheet: { create: (s: Record<string, unknown>) => s },
    View: "View",
    Text: "Text",
    ActivityIndicator: "ActivityIndicator",
    Platform: { OS: "ios", select: jest.fn((obj: Record<string, unknown>) => obj.ios) },
  };
});

// Cast AppState to our extended mock type for tests
const MockAppState = AppState as typeof AppState & {
  __simulateChange: (state: string) => void;
  __reset: () => void;
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  MockAppState.__reset();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAppState", () => {
  it("initial state is active when AppState.currentState is active", () => {
    const { result } = renderHook(() => useAppState());
    expect(result.current.appState).toBe("active");
    expect(result.current.isActive).toBe(true);
    expect(result.current.isBackground).toBe(false);
  });

  it("initial lastForegroundAt is set when starting in active state", () => {
    const { result } = renderHook(() => useAppState());
    expect(result.current.lastForegroundAt).not.toBeNull();
  });

  it("isActive becomes false when app goes to background", () => {
    const { result } = renderHook(() => useAppState());

    act(() => {
      MockAppState.__simulateChange("background");
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.isBackground).toBe(true);
    expect(result.current.appState).toBe("background");
  });

  it("lastBackgroundAt is set when transitioning to background", () => {
    const { result } = renderHook(() => useAppState());

    expect(result.current.lastBackgroundAt).toBeNull();

    act(() => {
      MockAppState.__simulateChange("background");
    });

    expect(result.current.lastBackgroundAt).not.toBeNull();
    expect(typeof result.current.lastBackgroundAt).toBe("number");
  });

  it("isActive becomes true again when app returns to foreground", () => {
    const { result } = renderHook(() => useAppState());

    act(() => { MockAppState.__simulateChange("background"); });
    expect(result.current.isActive).toBe(false);

    act(() => { MockAppState.__simulateChange("active"); });
    expect(result.current.isActive).toBe(true);
    expect(result.current.isBackground).toBe(false);
  });

  it("lastForegroundAt is updated on each foreground transition", () => {
    const { result } = renderHook(() => useAppState());
    const firstForeground = result.current.lastForegroundAt;

    act(() => { MockAppState.__simulateChange("background"); });
    // Advance time so timestamps differ
    jest.advanceTimersByTime(1000);
    act(() => { MockAppState.__simulateChange("active"); });

    expect(result.current.lastForegroundAt).not.toBe(firstForeground);
  });

  it("onForeground callback fires when transitioning from background to active", () => {
    const onForeground = jest.fn();
    renderHook(() => useAppState({ onForeground }));

    act(() => { MockAppState.__simulateChange("background"); });
    act(() => { MockAppState.__simulateChange("active"); });

    expect(onForeground).toHaveBeenCalledTimes(1);
  });

  it("onBackground callback fires when transitioning from active to background", () => {
    const onBackground = jest.fn();
    renderHook(() => useAppState({ onBackground }));

    act(() => { MockAppState.__simulateChange("background"); });

    expect(onBackground).toHaveBeenCalledTimes(1);
  });

  it("callbacks are not fired for same-state transitions", () => {
    const onForeground = jest.fn();
    const onBackground = jest.fn();
    renderHook(() => useAppState({ onForeground, onBackground }));

    // Fire "active" again while already active — should not call onForeground
    act(() => { MockAppState.__simulateChange("active"); });
    expect(onForeground).not.toHaveBeenCalled();

    act(() => { MockAppState.__simulateChange("background"); });
    act(() => { MockAppState.__simulateChange("background"); });
    // Only called once (the first background transition)
    expect(onBackground).toHaveBeenCalledTimes(1);
  });

  it("event listener is removed on unmount", () => {
    const { unmount } = renderHook(() => useAppState());
    unmount();

    // After unmount, firing a change should not cause errors
    expect(() => {
      act(() => { MockAppState.__simulateChange("background"); });
    }).not.toThrow();
  });
});
