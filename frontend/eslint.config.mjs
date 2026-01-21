import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Repo-specific extras:
    'dist/**',
    'node_modules/**',
    // Test scripts with CommonJS require()
    'test-*.js',
    'quick-*.js',
    '*-test.js',
    // Test files with JSX/TSX syntax issues
    '**/__tests__/**',
    '**/*.test.ts',
    '**/*.test.tsx',
  ]),
])

export default eslintConfig
