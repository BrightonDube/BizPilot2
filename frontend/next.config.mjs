/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Temporarily ignore ESLint errors during builds
    // TODO: Fix lint errors and remove this
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  // Turbopack configuration for Next.js 16+
  turbopack: {
    resolveAlias: {
      // Ensure single React instance
      'react': 'react',
      'react-dom': 'react-dom',
    },
  },
  // Webpack fallback for older builds
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'react': require.resolve('react'),
      'react-dom': require.resolve('react-dom'),
    };
    return config;
  },
};

export default nextConfig;
