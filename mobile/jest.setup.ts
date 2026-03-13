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
// Mock @react-native-async-storage/async-storage — for Zustand persist
// ---------------------------------------------------------------------------

const asyncStorageData: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(async (key: string, value: string) => {
    asyncStorageData[key] = value;
  }),
  getItem: jest.fn(async (key: string) => asyncStorageData[key] ?? null),
  removeItem: jest.fn(async (key: string) => {
    delete asyncStorageData[key];
  }),
  clear: jest.fn(async () => {
    Object.keys(asyncStorageData).forEach((k) => delete asyncStorageData[k]);
  }),
  getAllKeys: jest.fn(async () => Object.keys(asyncStorageData)),
  multiGet: jest.fn(async (keys: string[]) =>
    keys.map((k) => [k, asyncStorageData[k] ?? null])
  ),
  multiSet: jest.fn(async (pairs: [string, string][]) => {
    pairs.forEach(([k, v]) => { asyncStorageData[k] = v; });
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((k) => { delete asyncStorageData[k]; });
  }),
}));

// ---------------------------------------------------------------------------
// Mock expo-local-authentication — for biometric auth tests
// ---------------------------------------------------------------------------

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  supportedAuthenticationTypesAsync: jest.fn(async () => [2]),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
  },
  SecurityLevel: {
    NONE: 0,
    SECRET: 1,
    BIOMETRIC: 2,
  },
}));

// ---------------------------------------------------------------------------
// Mock WatermelonDB — prevent real SQLite in test env
// ---------------------------------------------------------------------------

jest.mock("@nozbe/watermelondb", () => {
  const actual = jest.requireActual("@nozbe/watermelondb");
  return {
    ...actual,
    Database: jest.fn().mockImplementation(() => ({
      get: jest.fn(() => ({
        query: jest.fn(() => ({
          fetch: jest.fn(async () => []),
          fetchCount: jest.fn(async () => 0),
          observe: jest.fn(() => ({ subscribe: jest.fn() })),
        })),
        find: jest.fn(async () => null),
        create: jest.fn(async (builder: unknown) => ({})),
      })),
      write: jest.fn(async (fn: () => unknown) => fn()),
      batch: jest.fn(async () => []),
    })),
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
