module.exports = function (api) {
  // Use api.cache.invalidate() to allow env-based conditional presets.
  // Why invalidate instead of cache(true)?
  // babel-preset-expo calls api.cache.forever() internally, which conflicts
  // with api.env() usage. By using invalidate(), we allow env checking
  // while still benefiting from caching in most scenarios.
  api.cache.invalidate(() => process.env.NODE_ENV);

  const isTest = process.env.NODE_ENV === "test";

  return {
    presets: [
      // In test env, skip the NativeWind jsxImportSource — it pulls in
      // react-native-worklets/plugin which requires native linking and
      // won't resolve in Jest's Node.js environment.
      isTest
        ? "babel-preset-expo"
        : ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      // NativeWind babel plugin also only needed at build time, not in Jest.
      ...(!isTest ? ["nativewind/babel"] : []),
    ],
  };
};
