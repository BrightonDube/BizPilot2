/**
 * BizPilot Mobile POS — Jest Setup
 *
 * Mocks native modules that don't exist in the Node.js test environment.
 * Required for testing React Native components outside a device.
 */

// ---------------------------------------------------------------------------
// Mock expo-haptics — no vibration hardware in test env
// ---------------------------------------------------------------------------

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

// ---------------------------------------------------------------------------
// Mock expo-secure-store — no keychain in test env
// ---------------------------------------------------------------------------

const secureStoreData: Record<string, string> = {};

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    secureStoreData[key] = value;
  }),
  getItemAsync: jest.fn(async (key: string) => secureStoreData[key] ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete secureStoreData[key];
  }),
}));

// ---------------------------------------------------------------------------
// Mock expo-router — no navigation stack in test env
// ---------------------------------------------------------------------------

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  }),
  useSegments: jest.fn(() => []),
  useLocalSearchParams: jest.fn(() => ({})),
  Link: "Link",
  Redirect: "Redirect",
  Stack: {
    Screen: "Stack.Screen",
  },
  Tabs: {
    Screen: "Tabs.Screen",
  },
}));

// ---------------------------------------------------------------------------
// Mock expo-splash-screen — no splash screen in test env
// ---------------------------------------------------------------------------

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @expo/vector-icons — return simple text in tests
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: (props: { name: string }) => Text({ children: props.name }),
  };
});

// ---------------------------------------------------------------------------
// Silence React Native warnings in test output
// ---------------------------------------------------------------------------

const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === "string" ? args[0] : "";
  if (msg.includes("componentWillReceiveProps")) return;
  if (msg.includes("componentWillMount")) return;
  originalWarn(...args);
};
