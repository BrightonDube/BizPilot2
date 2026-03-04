module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    // Transform all React Native / Expo packages that ship as ES modules.
    // @react-native-async-storage and @react-native-community/netinfo added
    // to ensure Zustand persist middleware and network hooks can be tested.
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|@react-native-async-storage|@shopify/flash-list)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Map native packages that aren't installed in the test environment
    // to stub implementations so jest.mock() calls in jest.setup.ts can resolve.
    "^@react-native-async-storage/async-storage$": "<rootDir>/__mocks__/async-storage.js",
    // Silence native modules that can't resolve in Jest's Node.js environment
    "^react-native-reanimated$": "<rootDir>/node_modules/react-native-reanimated/mock",
  },
  collectCoverageFrom: [
    "**/*.{ts,tsx}",
    "!**/node_modules/**",
    "!**/coverage/**",
    "!**/*.config.*",
    "!**/babel.config.js",
  ],
};
