module.exports = {
  root: true,
  extends: ["expo", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    // Boring code: no implicit any, no unused vars
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    // Enforce explicit return types on exported functions
    "@typescript-eslint/explicit-function-return-type": "off",
    // Allow require() for metro/babel configs
    "@typescript-eslint/no-require-imports": "off",
  },
};
